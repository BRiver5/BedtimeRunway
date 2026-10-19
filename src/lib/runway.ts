// Взлётная полоса режима: план отбоя/подъёма на каждую ночь до цели.
//
// Состояние — сдвиг внутренних часов δ от текущей оценки (шаг 5 мин), действие
// на ночь — сдвиг s в пределах темпа (раньше не больше pace, позже не больше
// maxDelay). Сон ночи центрирован на новой фазе, длина = потребность; если в
// это утро есть жёсткий подъём (будильник/цель), сон обрезается. Цена ночи:
// недосып² + усилие сдвига + провал бодрости на событиях следующего дня;
// в конце — штраф за недоход до фазы цели. Решается точным ДП по ночам.

import { addDays, weekdayIndex } from "./time.ts";
import { eventInNightFrame, fromClock, snap } from "./clock.ts";
import { alertnessAt, napTimeFor } from "./alertness.ts";

export const STEP = 5;
export const RANGE = 420; // |δ| ≤ 7 ч
export const ALERT_TARGET = 55;
const W_LOSS = 10; // за (час недосыпа)²
const W_SHIFT = 0.012; // за минуту сдвига
const W_TERMINAL = 6; // за (час до фазы цели)²
const W_ANCHOR = 1; // × важность × (дефицит/10)²
const W_AWAKE = 4; // за (час без сна в постели)²
// Насколько раньше "естественного" отбоя ещё можно заснуть. Отбой, заданный
// руками, не двигает часы быстрее темпа: лёг раньше — лежишь без сна.
export const EARLY_SLEEP = 30;

export type Anchor = { id: string; name: string; date: string; time: number; importance: number; nap: boolean };
export type Rule = { clock: number; days: number } | null; // days — маска утр, бит 0 = Mon
export type Goal = { clock: number; from: string; days: number } | null; // from — первое утро

export type RunwayInput = {
  tonight: string;
  phase: number; // середина сна, от полудня
  need: number;
  pace: number; // макс. сдвиг раньше за ночь
  maxDelay: number; // макс. сдвиг позже за ночь
  alarm: Rule; // нынешний подъём до цели
  goal: Goal;
  anchors: Anchor[];
  tonightBed?: number | null; // жест "а если лечь в это время сегодня"
};

export type AnchorResult = { id: string; score: number; deficit: number };

export type Night = {
  night: string;
  bed: number;
  wake: number; // естественный подъём по плану
  wakeBy: number | null; // жёсткий подъём этого утра
  actualWake: number;
  sleep: number;
  loss: number;
  mid: number;
  delta: number; // сдвиг фазы после ночи от текущей
  shift: number; // сдвиг этой ночи
  anchors: AnchorResult[];
  onset: number; // когда реально уснёшь
  awakeInBed: number; // минут без сна после отбоя
  cost: { loss: number; shift: number; anchors: number; awake: number };
};

export type Plan = {
  nights: Night[];
  totalLoss: number;
  worst: AnchorResult | null;
  goalDelta: number | null; // нужный сдвиг фазы для цели
  finalGap: number | null; // недошли до фазы цели в конце, мин
  onTrack: string | null; // первая ночь на фазе цели (±15)
  cost: number;
};

export function wakeRuleFor(input: Pick<RunwayInput, "alarm" | "goal">, night: string): number | null {
  const morning = addDays(night, 1);
  const wd = weekdayIndex(morning);
  const g = input.goal;
  if (g && morning >= g.from) return g.days & (1 << wd) ? fromClock(g.clock) : null;
  const a = input.alarm;
  if (a && a.days & (1 << wd)) return fromClock(a.clock);
  return null;
}

export function horizon(input: RunwayInput): number {
  let last = addDays(input.tonight, 6);
  if (input.goal) {
    const g = addDays(input.goal.from, 3);
    if (g > last) last = g;
  }
  for (const a of input.anchors) if (a.date > last) last = a.date;
  let n = 0;
  for (let d = input.tonight; d < last && n < 28; d = addDays(d, 1)) n++;
  return Math.max(1, n);
}

type NightEval = { night: Night; cost: number };

function evalNight(input: RunwayInput, night: string, from: number, to: number, forcedBed: number | null = null): NightEval {
  const mid = input.phase + to;
  const natural = mid - input.need / 2;
  const wakeBy = wakeRuleFor(input, night);
  const wake = mid + input.need / 2;
  // Если утро обрежет будильник — лечь раньше "естественного" отбоя, насколько
  // ещё получается заснуть (до EARLY_SLEEP), чтобы смягчить недосып.
  const early = forcedBed === null && wakeBy !== null && wake > wakeBy ? Math.min(EARLY_SLEEP, wake - wakeBy) : 0;
  const bed = forcedBed ?? natural - early;
  const onset = forcedBed === null ? bed : Math.max(forcedBed, natural - EARLY_SLEEP);
  const awakeInBed = onset - bed;
  const actualWake = wakeBy !== null ? Math.min(wake, wakeBy) : wake;
  const sleep = Math.max(0, actualWake - onset);
  const loss = Math.max(0, input.need - sleep);
  const morning = addDays(night, 1);
  const anchors: AnchorResult[] = [];
  let anchorCost = 0;
  for (const a of input.anchors) {
    if (a.date !== morning) continue;
    const t = eventInNightFrame(a.time);
    const score = alertnessAt(t, actualWake, sleep, mid, a.nap ? napTimeFor(t) : undefined).score;
    const deficit = Math.max(0, ALERT_TARGET - score);
    anchors.push({ id: a.id, score, deficit });
    anchorCost += W_ANCHOR * a.importance * (deficit / 10) ** 2;
  }
  const shift = to - from;
  const c = { loss: W_LOSS * (loss / 60) ** 2, shift: W_SHIFT * Math.abs(shift), anchors: anchorCost, awake: W_AWAKE * (awakeInBed / 60) ** 2 };
  return { night: { night, bed, wake, wakeBy, actualWake, sleep, loss, mid, delta: to, shift, onset, awakeInBed, anchors, cost: c }, cost: c.loss + c.shift + c.anchors + c.awake };
}

export function goalDelta(input: RunwayInput): number | null {
  if (!input.goal) return null;
  return fromClock(input.goal.clock) - input.need / 2 - input.phase;
}

export function buildRunway(input: RunwayInput): Plan {
  const N = horizon(input);
  const S = (2 * RANGE) / STEP + 1;
  const idx = (d: number) => Math.round((d + RANGE) / STEP);
  const val = (i: number) => i * STEP - RANGE;
  const gd = goalDelta(input);
  const nights = Array.from({ length: N }, (_, n) => addDays(input.tonight, n));
  const lo = -snap(input.pace, STEP);
  const hi = snap(input.maxDelay, STEP);

  // cost[n][i] — минимальная цена ночей n..N−1 из состояния i (после ночи n−1).
  const cost: Float64Array[] = Array.from({ length: N + 1 }, () => new Float64Array(S));
  const choice: Int16Array[] = Array.from({ length: N }, () => new Int16Array(S));
  for (let i = 0; i < S; i++) cost[N][i] = gd === null ? 0 : W_TERMINAL * ((val(i) - Math.max(-RANGE, Math.min(RANGE, gd))) / 60) ** 2;

  for (let n = N - 1; n >= 0; n--) {
    for (let i = 0; i < S; i++) {
      let best = Infinity;
      let arg = i;
      const from = val(i);
      const jLo = Math.max(0, idx(from + lo));
      const jHi = Math.min(S - 1, idx(from + hi));
      // Сегодняшний отбой задан жестом: сдвиг часов ДП по-прежнему выбирает в
      // пределах темпа, а сон считается от реального засыпания.
      const forced = n === 0 && input.tonightBed !== null && input.tonightBed !== undefined ? input.tonightBed : null;
      for (let j = jLo; j <= jHi; j++) {
        const c = evalNight(input, nights[n], from, val(j), forced).cost + cost[n + 1][j];
        if (c < best) {
          best = c;
          arg = j;
        }
      }
      cost[n][i] = best;
      choice[n][i] = arg;
    }
  }

  const out: Night[] = [];
  let i = idx(0);
  for (let n = 0; n < N; n++) {
    const j = choice[n][i];
    out.push(evalNight(input, nights[n], val(i), val(j), n === 0 ? (input.tonightBed ?? null) : null).night);
    i = j;
  }
  const finalDelta = out.length ? out[out.length - 1].delta : 0;
  const all = out.flatMap((x) => x.anchors);
  const worst = all.length ? all.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const onTrack = gd === null ? null : (out.find((x) => Math.abs(x.delta - gd) <= 15)?.night ?? null);
  return {
    nights: out,
    totalLoss: out.reduce((s, x) => s + x.loss, 0),
    worst,
    goalDelta: gd,
    finalGap: gd === null ? null : gd - finalDelta,
    onTrack,
    cost: cost[0][idx(0)],
  };
}

// Цена произвольной последовательности фаз (δ после каждой ночи) — для
// проверки ДП полным перебором и для оценки плана, заданного руками.
export function scoreSequence(input: RunwayInput, deltas: number[]): number {
  const N = horizon(input);
  const gd = goalDelta(input);
  let from = 0;
  let total = 0;
  for (let n = 0; n < N; n++) {
    const to = deltas[n];
    total += evalNight(input, addDays(input.tonight, n), from, to, n === 0 ? (input.tonightBed ?? null) : null).cost;
    from = to;
  }
  if (gd !== null) total += W_TERMINAL * ((from - Math.max(-RANGE, Math.min(RANGE, gd))) / 60) ** 2;
  return total;
}

// Сколько ночей минимум нужно при темпе, чтобы дойти до цели.
export function nightsNeeded(input: RunwayInput): number | null {
  const gd = goalDelta(input);
  if (gd === null) return null;
  const rate = gd < 0 ? input.pace : input.maxDelay;
  return rate > 0 ? Math.ceil(Math.abs(gd) / rate) : Infinity;
}
