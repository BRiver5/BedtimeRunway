// История для Stats: ночи, социальный джетлаг, траектория оценки часов,
// соблюдение плана, качество по длительности сна с интервалами Уилсона.

import { replay, type SleepLog } from "./phase.ts";
import { addDays } from "./time.ts";

export type PlannedNight = { night: string; bed: number; wake: number };

export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}

export function lastNights(logs: SleepLog[], today: string, n: number): { night: string; log: SleepLog | null }[] {
  const byNight = new Map(logs.map((l) => [l.night, l]));
  return Array.from({ length: n }, (_, i) => {
    const night = addDays(today, -n + i);
    return { night, log: byNight.get(night) ?? null };
  });
}

// Разница середины сна свободных и рабочих ночей (MSF − MSW): насколько
// будильник сдвигает тебя против внутренних часов.
export function socialJetlag(logs: SleepLog[]): { free: number | null; alarm: number | null; gap: number | null; nFree: number; nAlarm: number } {
  const mid = (l: SleepLog) => (l.bed + l.wake) / 2;
  const free = logs.filter((l) => !l.alarm);
  const alarm = logs.filter((l) => l.alarm);
  const avg = (xs: SleepLog[]) => (xs.length ? xs.reduce((s, l) => s + mid(l), 0) / xs.length : null);
  const f = avg(free);
  const a = avg(alarm);
  return { free: f, alarm: a, gap: f !== null && a !== null ? f - a : null, nFree: free.length, nAlarm: alarm.length };
}

export function trajectory(logs: SleepLog[]): { night: string; mu: number; sd: number }[] {
  return replay(logs).steps.map((s) => ({ night: s.night, mu: s.after, sd: s.sd }));
}

export function adherence(logs: SleepLog[], planned: PlannedNight[]): { night: string; diff: number }[] {
  const byNight = new Map(logs.map((l) => [l.night, l]));
  return planned
    .filter((p) => byNight.has(p.night))
    .sort((a, b) => (a.night < b.night ? -1 : 1))
    .map((p) => ({ night: p.night, diff: (byNight.get(p.night) as SleepLog).bed - p.bed }));
}

export type QualityBucket = { label: string; n: number; good: number; rate: number; lo: number; hi: number };

export function qualityByDuration(logs: SleepLog[]): QualityBucket[] {
  const edges: [string, number, number][] = [
    ["< 6 h", 0, 360],
    ["6–7 h", 360, 420],
    ["7–8 h", 420, 480],
    ["8 h +", 480, 2000],
  ];
  return edges.map(([label, a, b]) => {
    const inB = logs.filter((l) => l.wake - l.bed >= a && l.wake - l.bed < b);
    const good = inB.filter((l) => l.quality >= 4).length;
    const [lo, hi] = wilson(good, inB.length);
    return { label, n: inB.length, good, rate: inB.length ? good / inB.length : 0, lo, hi };
  });
}
