// Изменения входа планировщика — общий язык для выходов из конфликтов и
// режима "что если". Сравнение до/после — честный повторный прогон ДП.

import { buildRunway, type Plan, type RunwayInput } from "./runway.ts";
import { addDays, dayLabel } from "./time.ts";
import { fmtClock, fmtDuration } from "./clock.ts";

export type Change =
  | { kind: "pace"; minutes: number }
  | { kind: "goalClock"; clock: number }
  | { kind: "goalFrom"; from: string }
  | { kind: "need"; minutes: number }
  | { kind: "nap"; anchorId: string; on: boolean }
  | { kind: "tonightBed"; bed: number | null };

export function applyChange(input: RunwayInput, c: Change): RunwayInput {
  switch (c.kind) {
    case "pace":
      return { ...input, pace: Math.max(5, c.minutes) };
    case "goalClock":
      return input.goal ? { ...input, goal: { ...input.goal, clock: c.clock } } : input;
    case "goalFrom":
      return input.goal ? { ...input, goal: { ...input.goal, from: c.from } } : input;
    case "need":
      return { ...input, need: Math.max(300, c.minutes) };
    case "nap":
      return { ...input, anchors: input.anchors.map((a) => (a.id === c.anchorId ? { ...a, nap: c.on } : a)) };
    case "tonightBed":
      return { ...input, tonightBed: c.bed };
  }
}

export function describeChange(c: Change, anchorName: (id: string) => string): string {
  switch (c.kind) {
    case "pace":
      return `Shift up to ${fmtDuration(c.minutes)} a night`;
    case "goalClock":
      return `Aim for ${fmtClock(c.clock)} instead`;
    case "goalFrom":
      return `Start the new wake time on ${dayLabel(c.from)}`;
    case "need":
      return `Plan for ${fmtDuration(c.minutes)} of sleep`;
    case "nap":
      return c.on ? `Take a 20-min nap before ${anchorName(c.anchorId)}` : `No nap before ${anchorName(c.anchorId)}`;
    case "tonightBed":
      return c.bed === null ? "Follow the plan tonight" : "Try a different bedtime tonight";
  }
}

export type NightDiff = { night: string; bedBefore: number; bedAfter: number; lossBefore: number; lossAfter: number };

export type Comparison = {
  before: Plan;
  after: Plan;
  lossDelta: number; // минуты недосыпа (после − до)
  worstDelta: number | null; // бодрость худшего события (после − до)
  rows: NightDiff[];
};

export function compare(before: Plan, after: Plan): Comparison {
  const rows = before.nights.map((b) => {
    const a = after.nights.find((x) => x.night === b.night);
    return { night: b.night, bedBefore: b.bed, bedAfter: a ? a.bed : b.bed, lossBefore: b.loss, lossAfter: a ? a.loss : b.loss };
  });
  for (const a of after.nights) if (!before.nights.some((b) => b.night === a.night)) rows.push({ night: a.night, bedBefore: a.bed, bedAfter: a.bed, lossBefore: 0, lossAfter: a.loss });
  return {
    before,
    after,
    lossDelta: after.totalLoss - before.totalLoss,
    worstDelta: before.worst && after.worst ? after.worst.score - before.worst.score : null,
    rows,
  };
}

export function whatIf(input: RunwayInput, changes: Change[], base?: Plan): Comparison {
  const before = base ?? buildRunway(input);
  return compare(before, buildRunway(changes.reduce(applyChange, input)));
}

export function laterBy(from: string, days: number): string {
  return addDays(from, days);
}
