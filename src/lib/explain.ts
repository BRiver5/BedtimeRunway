// "Почему такой отбой": разложение решения на сегодняшнюю ночь — откуда фаза,
// куда надо прийти, сколько ночей осталось, упёрлись ли в темп, что будет
// утром; плюс разложение бодрости события на две компоненты модели.

import { alertnessAt, napTimeFor } from "./alertness.ts";
import { eventInNightFrame } from "./clock.ts";
import { addDays, daysBetween } from "./time.ts";
import type { Night, Plan, RunwayInput } from "./runway.ts";

export type TonightWhy = {
  night: Night;
  phase: number;
  phaseSd: number;
  goalPhase: number | null;
  gap: number | null; // сколько ещё сдвигать после сегодняшней ночи
  nightsLeft: number | null; // до первого утра цели
  cappedByPace: boolean;
  reason: string; // главный мотив сдвига
  truncated: boolean; // утром обрежет будильник
  early: number; // минут раньше "естественного" отбоя, чтобы смягчить будильник
};

export function explainTonight(input: RunwayInput, plan: Plan, phaseSd: number): TonightWhy | null {
  const night = plan.nights[0];
  if (!night) return null;
  const goalPhase = plan.goalDelta === null ? null : input.phase + plan.goalDelta;
  const gap = plan.goalDelta === null ? null : plan.goalDelta - night.delta;
  const nightsLeft = input.goal ? Math.max(0, daysBetween(input.tonight, input.goal.from)) : null;
  const cappedByPace = night.shift <= -input.pace + 0.1 || night.shift >= input.maxDelay - 0.1;
  let reason: string;
  if (input.tonightBed !== null && input.tonightBed !== undefined) reason = "You set tonight's bedtime yourself.";
  else if (night.shift === 0) reason = gap === null || Math.abs(gap) < 10 ? "You're already where you need to be." : "Holding still tonight costs less than moving.";
  else if (cappedByPace) reason = "Moving as fast as your pace allows.";
  else if (night.anchors.length) reason = "Balanced against how alert you need to be tomorrow.";
  else reason = "A partial step: a bigger jump would cost more sleep than it saves later.";
  const early = input.tonightBed === null || input.tonightBed === undefined ? Math.max(0, night.mid - input.need / 2 - night.bed) : 0;
  return { night, phase: input.phase, phaseSd, goalPhase, gap, nightsLeft, cappedByPace, reason, truncated: night.wakeBy !== null && night.wakeBy < night.wake, early };
}

export function explainAnchor(input: RunwayInput, plan: Plan, anchorId: string) {
  const a = input.anchors.find((x) => x.id === anchorId);
  if (!a) return null;
  const night = plan.nights.find((n) => addDays(n.night, 1) === a.date);
  if (!night) return null;
  const t = eventInNightFrame(a.time);
  const napAt = a.nap ? napTimeFor(t) : undefined;
  const parts = alertnessAt(t, night.actualWake, night.sleep, night.mid, napAt);
  const other = alertnessAt(t, night.actualWake, night.sleep, night.mid, a.nap ? undefined : napTimeFor(t));
  // napGain: насколько сон днём меняет бодрость (с ним минус без него).
  return { anchor: a, night, t, napAt, parts, napGain: a.nap ? parts.score - other.score : other.score - parts.score };
}
