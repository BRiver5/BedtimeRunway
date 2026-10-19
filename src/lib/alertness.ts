// Двухпроцессная модель Борбели (упрощённая, для оценки, не диагностики):
// • S — "давление сна": растёт во время бодрствования к 1 (τ 18.2 ч),
//   спадает во сне к 0 (τ 4.2 ч);
// • C — циркадная волна, минимум примерно через час после середины сна.
// Бодрость 0..100 = смесь (1 − S) и C.

import { DAY } from "./clock.ts";

export const TAU_WAKE = 18.2 * 60;
export const TAU_SLEEP = 4.2 * 60;
export const S_AT_BED = 0.65;
export const NADIR_AFTER_MID = 60;
export const W_HOMEOSTATIC = 0.55;
export const NAP_FACTOR = 0.8; // короткий дневной сон снимает ~20% давления
export const NAP_LEAD = 180; // за сколько минут до события

export function sAfterSleep(sleep: number, sBed = S_AT_BED): number {
  return sBed * Math.exp(-Math.max(0, sleep) / TAU_SLEEP);
}

export function sAwake(sWake: number, awake: number): number {
  return 1 - (1 - sWake) * Math.exp(-Math.max(0, awake) / TAU_WAKE);
}

export function circadian(t: number, mid: number): number {
  // −1 в надире, +1 через 12 часов
  return -Math.cos((2 * Math.PI * (t - (mid + NADIR_AFTER_MID))) / DAY);
}

export type AlertParts = { score: number; homeostatic: number; circadian: number; s: number; awake: number; asleep: boolean };

// t, wake, mid, napAt — в одной системе отсчёта (от полудня ночи перед событием).
// napAt — момент короткого дневного сна, если он был до t.
export function alertnessAt(t: number, wake: number, sleep: number, mid: number, napAt?: number): AlertParts {
  if (t < wake) return { score: 0, homeostatic: 0, circadian: 0, s: 1, awake: 0, asleep: true };
  const sWake = sAfterSleep(sleep);
  let s: number;
  if (napAt !== undefined && napAt > wake && napAt <= t) {
    const before = sAwake(sWake, napAt - wake) * NAP_FACTOR;
    s = sAwake(before, t - napAt);
  } else s = sAwake(sWake, t - wake);
  const c = circadian(t, mid);
  const homeostatic = W_HOMEOSTATIC * (1 - s) * 100;
  const circ = (1 - W_HOMEOSTATIC) * ((c + 1) / 2) * 100;
  return { score: homeostatic + circ, homeostatic, circadian: circ, s, awake: t - wake, asleep: false };
}

// Кривая бодрости дня после ночи: точки каждые step минут от подъёма до +18 ч.
export function curve(wake: number, sleep: number, mid: number, step = 30, napAt?: number): { t: number; score: number }[] {
  const out: { t: number; score: number }[] = [];
  for (let t = wake; t <= wake + 18 * 60; t += step) out.push({ t, score: alertnessAt(t, wake, sleep, mid, napAt).score });
  return out;
}

// Когда спать днём перед событием в момент t.
export function napTimeFor(t: number): number {
  return t - NAP_LEAD;
}
