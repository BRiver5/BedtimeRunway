// Конфликты плана и ранжированные выходы. Каждый выход проверен повторным
// прогоном ДП; показывается только то, что реально снижает цену плана, по
// убыванию выигрыша, с понятной метрикой (сон, бодрость).

import { buildRunway, goalDelta, nightsNeeded, ALERT_TARGET, type Plan, type RunwayInput } from "./runway.ts";
import { applyChange, describeChange, type Change } from "./changes.ts";
import { addDays, daysBetween, dayLabel, weekdayLabel } from "./time.ts";
import { fmtClock, fmtDuration } from "./clock.ts";

export type Fix = { changes: Change[]; label: string; gain: number; effect: string };

export type Conflict = {
  id: string;
  kind: "late" | "lowAnchor" | "shortNight";
  title: string;
  reason: string;
  fixes: Fix[];
};

const MIN_GAIN = 0.05;

function effectText(before: Plan, after: Plan, anchorId?: string): string {
  const parts: string[] = [];
  const dl = before.totalLoss - after.totalLoss;
  if (Math.abs(dl) >= 5) parts.push(dl > 0 ? `${fmtDuration(dl)} less lost sleep` : `${fmtDuration(-dl)} more lost sleep`);
  if (anchorId) {
    const b = before.nights.flatMap((n) => n.anchors).find((a) => a.id === anchorId);
    const a = after.nights.flatMap((n) => n.anchors).find((x) => x.id === anchorId);
    if (a && b && Math.abs(a.score - b.score) >= 1) parts.push(`alertness ${Math.round(b.score)} → ${Math.round(a.score)}`);
  }
  if (before.finalGap !== null && after.finalGap !== null && Math.abs(before.finalGap) - Math.abs(after.finalGap) >= 5) parts.push("reaches the goal sooner");
  return parts.join(" · ") || "smoother plan";
}

function verify(input: RunwayInput, plan: Plan, candidates: Change[][], name: (id: string) => string, anchorId?: string, labels?: string[]): Fix[] {
  const seen = new Set<string>();
  const out: Fix[] = [];
  candidates.forEach((changes, k) => {
    const key = JSON.stringify(changes);
    if (seen.has(key)) return;
    seen.add(key);
    const after = buildRunway(changes.reduce(applyChange, input));
    const gain = plan.cost - after.cost;
    if (gain > MIN_GAIN) out.push({ changes, label: labels?.[k] ?? changes.map((c) => describeChange(c, name)).join(" + "), gain, effect: effectText(plan, after, anchorId) });
  });
  return out.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

export function findConflicts(input: RunwayInput, plan: Plan): Conflict[] {
  const name = (id: string) => input.anchors.find((a) => a.id === id)?.name ?? "event";
  const out: Conflict[] = [];

  // 1. Цель начинается раньше, чем часы успеют сдвинуться.
  const gd = goalDelta(input);
  if (input.goal && gd !== null) {
    const available = Math.max(0, daysBetween(input.tonight, input.goal.from));
    const needN = nightsNeeded(input) ?? 0;
    const goalNights = plan.nights.filter((n) => addDays(n.night, 1) >= input.goal!.from);
    const goalLoss = goalNights.reduce((s, n) => s + n.loss, 0);
    if (needN > available && goalLoss >= 20) {
      const missing = needN - available;
      const cands: Change[][] = [
        [{ kind: "pace", minutes: input.pace + 15 }],
        [{ kind: "pace", minutes: input.pace + 30 }],
        [{ kind: "goalFrom", from: addDays(input.goal.from, missing) }],
        [{ kind: "goalClock", clock: input.goal.clock + Math.min(60, Math.ceil((Math.abs(gd) - available * input.pace) / 15) * 15) }],
      ];
      out.push({
        id: "late",
        kind: "late",
        title: `Not ready for ${fmtClock(input.goal.clock)} by ${dayLabel(input.goal.from)}`,
        reason: `Your body clock has to move ${fmtDuration(Math.abs(gd))} ${gd < 0 ? "earlier" : "later"}. At ${fmtDuration(gd < 0 ? input.pace : input.maxDelay)} a night that takes ${needN} nights, but only ${available} are left. The first mornings would cost ${fmtDuration(goalLoss)} of sleep.`,
        fixes: verify(input, plan, cands, name),
      });
    }
  }

  // 2. Событие с низкой бодростью.
  for (const n of plan.nights) {
    for (const r of n.anchors) {
      if (r.score >= ALERT_TARGET) continue;
      const a = input.anchors.find((x) => x.id === r.id)!;
      const cands: Change[][] = [];
      if (!a.nap) cands.push([{ kind: "nap", anchorId: a.id, on: true }]);
      cands.push([{ kind: "pace", minutes: input.pace + 15 }]);
      if (!a.nap) cands.push([{ kind: "nap", anchorId: a.id, on: true }, { kind: "pace", minutes: input.pace + 15 }]);
      out.push({
        id: `anchor-${a.id}`,
        kind: "lowAnchor",
        title: `${a.name} lands at low alertness`,
        reason: `${weekdayLabel(a.date)} ${fmtClock(a.time)}: about ${Math.round(r.score)} of 100, below the ${ALERT_TARGET} we aim for — ${n.loss > 10 ? `${fmtDuration(n.loss)} short on sleep the night before` : "it falls close to your body clock's low point"}.`,
        fixes: verify(input, plan, cands, name, a.id),
      });
    }
  }

  // 3. Короткая ночь вне цели (нынешний будильник раньше внутренних часов).
  const short = plan.nights.filter((n) => n.loss >= 45 && !(input.goal && addDays(n.night, 1) >= input.goal.from));
  if (short.length) {
    const worst = short.reduce((a, b) => (b.loss > a.loss ? b : a));
    out.push({
      id: "short",
      kind: "shortNight",
      title: `${short.length === 1 ? "A short night" : `${short.length} short nights`} on the way`,
      reason: `The alarm on ${weekdayLabel(addDays(worst.night, 1))} cuts sleep by ${fmtDuration(worst.loss)} — your clock isn't early enough yet.`,
      fixes: verify(input, plan, [[{ kind: "pace", minutes: input.pace + 15 }], [{ kind: "pace", minutes: input.pace + 30 }]], name),
    });
  }
  return out;
}
