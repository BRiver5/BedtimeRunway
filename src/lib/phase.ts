// Накапливаемая оценка внутренних часов: середина сна (от полудня) и
// потребность во сне — два одномерных фильтра Калмана.
// • Середина сна дрейфует (шум процесса на каждый прошедший день).
// • Ночь с будильником меряет фазу хуже (больший шум) и смещена раньше: если
//   разбудили раньше потребности, "естественная" середина была бы позже на
//   половину недосыпа.
// • Потребность во сне учится только по свободным ночам (без будильника).

import { daysBetween } from "./time.ts";

export const MODEL_VERSION = 1;

export const PHASE_Q = 10 * 10; // дисперсия дрейфа фазы за день, мин²
export const PHASE_R_FREE = 30 * 30;
export const PHASE_R_ALARM = 60 * 60;
export const NEED_PRIOR = 480;
export const NEED_P0 = 60 * 60;
export const NEED_Q = 3 * 3;
export const NEED_R = 45 * 45;

export type SleepLog = { night: string; bed: number; wake: number; alarm: boolean; quality: number };

export type PhaseState = {
  mu: number | null;
  p: number;
  need: number;
  pNeed: number;
  last: string | null; // последняя учтённая ночь
  n: number;
  free: number; // свободных ночей учтено
};

export function emptyPhase(): PhaseState {
  return { mu: null, p: 60 * 60, need: NEED_PRIOR, pNeed: NEED_P0, last: null, n: 0, free: 0 };
}

export type Step = {
  night: string;
  z: number; // измерение фазы
  gain: number; // вес новой ночи в оценке
  before: number | null;
  after: number;
  correction: number; // поправка за недосып на будильнике
  sd: number; // неопределённость фазы после шага
};

// Одно наблюдение. Возвращает разложение шага — для экрана "почему".
export function observe(s: PhaseState, log: SleepLog): Step {
  const sleep = log.wake - log.bed;
  const mid = (log.bed + log.wake) / 2;
  const correction = log.alarm && sleep < s.need ? (s.need - sleep) / 2 : 0;
  const z = mid + correction;
  const before = s.mu;
  if (s.mu === null) {
    s.mu = z;
    s.p = log.alarm ? PHASE_R_ALARM : PHASE_R_FREE;
    s.last = log.night;
    s.n = 1;
  } else {
    const gap = s.last ? Math.max(1, daysBetween(s.last, log.night)) : 1;
    s.p += PHASE_Q * gap;
    const r = log.alarm ? PHASE_R_ALARM : PHASE_R_FREE;
    const k = s.p / (s.p + r);
    s.mu += k * (z - s.mu);
    s.p *= 1 - k;
    s.last = log.night;
    s.n++;
    if (!log.alarm) {
      s.pNeed += NEED_Q * gap;
      const kn = s.pNeed / (s.pNeed + NEED_R);
      s.need += kn * (sleep - s.need);
      s.pNeed *= 1 - kn;
      s.free++;
    }
    return { night: log.night, z, gain: k, before, after: s.mu, correction, sd: Math.sqrt(s.p) };
  }
  if (!log.alarm) {
    const kn = s.pNeed / (s.pNeed + NEED_R);
    s.need += kn * (sleep - s.need);
    s.pNeed *= 1 - kn;
    s.free++;
  }
  return { night: log.night, z, gain: 1, before, after: s.mu as number, correction, sd: Math.sqrt(s.p) };
}

export function replay(logs: SleepLog[]): { state: PhaseState; steps: Step[] } {
  const state = emptyPhase();
  const steps = [...logs].sort((a, b) => (a.night < b.night ? -1 : 1)).map((l) => observe(state, l));
  return { state, steps };
}

export function phaseSd(s: PhaseState): number {
  return Math.sqrt(s.p);
}

export function needSd(s: PhaseState): number {
  return Math.sqrt(s.pNeed);
}
