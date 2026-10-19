import { test } from "node:test";
import assert from "node:assert/strict";
import { eventInNightFrame, fmtClock, fromClock, toClock } from "./clock.ts";
import { emptyPhase, observe, replay } from "./phase.ts";
import { alertnessAt } from "./alertness.ts";
import { buildRunway, goalDelta, nightsNeeded, scoreSequence, wakeRuleFor, type RunwayInput } from "./runway.ts";
import { findConflicts } from "./conflicts.ts";
import { whatIf } from "./changes.ts";
import { explainAnchor, explainTonight } from "./explain.ts";
import { qualityByDuration, socialJetlag, trajectory } from "./history.ts";

const EVERY = 0b1111111;
const WEEKDAYS = 0b0011111;

function input(over: Partial<RunwayInput>): RunwayInput {
  return {
    tonight: "2026-10-19", // понедельник
    phase: fromClock(4 * 60), // середина сна 4:00 (отбой 0:00, подъём 8:00)
    need: 480,
    pace: 30,
    maxDelay: 60,
    alarm: null,
    goal: null,
    anchors: [],
    ...over,
  };
}

test("noon-anchored clock round-trips and formats", () => {
  assert.equal(fromClock(23 * 60 + 30), 690);
  assert.equal(toClock(1140), 7 * 60);
  assert.equal(fmtClock(6 * 60 + 5), "6:05 am");
  assert.equal(fmtClock(0), "12:00 am");
});

test("phase filter accumulates, trusts free nights more and corrects alarm nights", () => {
  const s = emptyPhase();
  observe(s, { night: "2026-10-01", bed: fromClock(0), wake: fromClock(480), alarm: false, quality: 4 });
  const mu1 = s.mu!;
  const free = { ...s };
  const alarm = { ...s };
  const late = { night: "2026-10-02", bed: fromClock(60), wake: fromClock(540), quality: 4 };
  const fStep = observe(free, { ...late, alarm: false });
  const aStep = observe(alarm, { ...late, alarm: true });
  assert.ok(fStep.gain > aStep.gain, "free night moves the estimate more");
  assert.ok(free.mu! > mu1 && alarm.mu! > mu1);
  // Будильник обрезал сон до 6 ч → естественная середина позже на час.
  const cut = { ...s };
  const c = observe(cut, { night: "2026-10-02", bed: fromClock(0), wake: fromClock(360), alarm: true, quality: 2 });
  assert.equal(c.correction, 60);
  // Потребность учится только по свободным ночам.
  const r = replay([
    { night: "2026-10-01", bed: 600, wake: 1140, alarm: false, quality: 4 },
    { night: "2026-10-02", bed: 600, wake: 1140, alarm: false, quality: 4 },
    { night: "2026-10-03", bed: 600, wake: 900, alarm: true, quality: 2 },
  ]).state;
  assert.ok(r.need > 480 && r.free === 2);
});

test("alertness: more sleep and later in the morning help, nap helps", () => {
  const mid = fromClock(4 * 60);
  const wake = fromClock(8 * 60);
  const t = eventInNightFrame(10 * 60);
  const full = alertnessAt(t, wake, 480, mid).score;
  const short = alertnessAt(t, wake, 300, mid).score;
  assert.ok(full > short);
  const early = alertnessAt(fromClock(6 * 60), fromClock(5 * 60 + 30), 330, mid).score;
  assert.ok(early < full);
  const late = eventInNightFrame(20 * 60);
  assert.ok(alertnessAt(late, wake, 480, mid, late - 180).score > alertnessAt(late, wake, 480, mid).score);
});

test("wake rules: current alarm before the goal, goal days after", () => {
  const inp = input({ alarm: { clock: 7 * 60 + 30, days: WEEKDAYS }, goal: { clock: 6 * 60, from: "2026-10-26", days: WEEKDAYS } });
  assert.equal(wakeRuleFor(inp, "2026-10-19"), fromClock(450)); // утро вт
  assert.equal(wakeRuleFor(inp, "2026-10-24"), null); // утро вс
  assert.equal(wakeRuleFor(inp, "2026-10-25"), fromClock(360)); // утро пн — цель
});

test("runway respects pace every night and reaches the goal phase", () => {
  const inp = input({ goal: { clock: 6 * 60, from: "2026-10-27", days: EVERY } });
  const plan = buildRunway(inp);
  assert.equal(goalDelta(inp), -120);
  for (const n of plan.nights) assert.ok(n.shift >= -30 && n.shift <= 60, `shift ${n.shift}`);
  assert.ok(plan.onTrack !== null && plan.onTrack <= "2026-10-26");
  assert.ok(plan.totalLoss < 30);
  // Отбой монотонно сдвигается раньше до цели.
  const beds = plan.nights.slice(0, 5).map((n) => n.bed);
  for (let i = 1; i < beds.length; i++) assert.ok(beds[i] <= beds[i - 1]);
});

test("DP matches brute force over every shift sequence", () => {
  const inp = input({ tonight: "2026-10-24", goal: { clock: 7 * 60, from: "2026-10-26", days: EVERY }, pace: 15, maxDelay: 10, anchors: [{ id: "a", name: "Exam", date: "2026-10-27", time: 9 * 60, importance: 2, nap: false }] });
  const plan = buildRunway(inp);
  const N = plan.nights.length;
  const steps = [-15, -10, -5, 0, 5, 10];
  let best = Infinity;
  const rec = (n: number, from: number, acc: number[]) => {
    if (n === N) {
      best = Math.min(best, scoreSequence(inp, acc));
      return;
    }
    for (const s of steps) rec(n + 1, from + s, [...acc, from + s]);
  };
  rec(0, 0, []);
  assert.ok(N >= 3 && N <= 6);
  assert.ok(Math.abs(plan.cost - best) < 1e-9, `dp ${plan.cost} vs brute ${best}`);
  assert.equal(nightsNeeded({ ...inp, pace: 30 }), 2);
});

test("goal too soon is a conflict with verified exits ranked by gain", () => {
  const inp = input({ goal: { clock: 5 * 60, from: "2026-10-21", days: EVERY } });
  const plan = buildRunway(inp);
  const c = findConflicts(inp, plan).find((x) => x.kind === "late");
  assert.ok(c, "late conflict expected");
  assert.ok(c!.fixes.length >= 2);
  for (let i = 1; i < c!.fixes.length; i++) assert.ok(c!.fixes[i - 1].gain >= c!.fixes[i].gain);
  assert.ok(c!.fixes.every((f) => f.gain > 0));
});

test("an early event at low alertness offers a nap", () => {
  const inp = input({ anchors: [{ id: "x", name: "Flight", date: "2026-10-21", time: 16 * 60, importance: 3, nap: false }], alarm: { clock: 5 * 60, days: EVERY } });
  const plan = buildRunway(inp);
  const ex = explainAnchor(inp, plan, "x")!;
  assert.ok(ex.parts.score > 0);
  const c = findConflicts(inp, plan).find((x) => x.kind === "lowAnchor");
  if (c) assert.ok(c.fixes.some((f) => f.changes.some((ch) => ch.kind === "nap")));
});

test("what-if with a forced late bedtime tonight costs sleep", () => {
  const inp = input({ alarm: { clock: 8 * 60, days: EVERY } });
  const cmp = whatIf(inp, [{ kind: "tonightBed", bed: fromClock(2 * 60) }]);
  assert.ok(cmp.lossDelta > 0);
  assert.equal(cmp.after.nights[0].bed, fromClock(2 * 60));
  const why = explainTonight({ ...inp, tonightBed: fromClock(2 * 60) }, cmp.after, 20)!;
  assert.equal(why.reason, "You set tonight's bedtime yourself.");
});

test("history: social jet lag, trajectory and Wilson buckets", () => {
  const logs = [
    { night: "2026-10-10", bed: fromClock(60), wake: fromClock(600), alarm: false, quality: 5 },
    { night: "2026-10-11", bed: fromClock(0), wake: fromClock(420), alarm: true, quality: 3 },
    { night: "2026-10-12", bed: fromClock(0), wake: fromClock(420), alarm: true, quality: 4 },
  ];
  const sj = socialJetlag(logs);
  assert.equal(sj.gap, 120);
  const tr = trajectory(logs);
  assert.equal(tr.length, 3);
  assert.ok(tr[2].sd < tr[0].sd, "uncertainty shrinks as nights accumulate");
  const q = qualityByDuration(logs);
  assert.equal(q.find((b) => b.label === "7–8 h")!.n, 2);
});
