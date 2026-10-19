import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, GitCompareArrows, RotateCcw, TriangleAlert, Wand } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp, usePhaseSd } from "../src/store/appStore";
import { SleepBand } from "../src/components/SleepBand";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { whatIf } from "../src/lib/changes";
import { explainTonight } from "../src/lib/explain";
import type { Fix } from "../src/lib/conflicts";
import { fmtDuration, fmtNoon, fmtShift } from "../src/lib/clock";
import { addDays, dayLabel, weekdayLabel } from "../src/lib/time";
import { haptics } from "../src/services/haptics";

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ night?: string }>();
  const app = useApp();
  const sd = usePhaseSd();
  const [tryBed, setTryBed] = useState<number | null>(null); // зафиксирован на отпускании
  const [dragBed, setDragBed] = useState<number | null>(null); // пока палец на полосе
  const [burst, setBurst] = useState(false);
  const { input, plan } = app;

  const probe = dragBed ?? tryBed;
  const preview = useMemo(() => (input && plan && probe !== null ? whatIf(input, [{ kind: "tonightBed", bed: probe }], plan) : null), [app.version, probe]);
  const committed = useMemo(() => (input && plan && tryBed !== null ? whatIf(input, [{ kind: "tonightBed", bed: tryBed }], plan).after.nights[0] : null), [app.version, tryBed]);
  if (!input || !plan) return null;
  const why = explainTonight(input, plan, sd);
  const tonight = plan.nights[0];
  const conflicts = app.conflicts;
  const name = (id: string) => app.anchors.find((a) => a.id === id)?.name ?? "Event";

  const applyFix = async (f: Fix) => {
    for (const c of f.changes) await app.applyChange(c);
    haptics.success();
    setBurst(true);
  };

  const shown = preview ? preview.after.nights[0] : tonight;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Runway plan</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {plan.nights.length} nights · {plan.totalLoss >= 5 ? `${fmtDuration(plan.totalLoss)} short in total` : "no lost sleep"}
          </Text>
        </View>
        <PressableScale onPress={() => router.push("/whatif")} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.colors.accent }}>
          <GitCompareArrows size={14} color={t.colors.onAccent} />
          <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
            What{" "}if
          </Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {/* Сегодня: перетащить отбой */}
        <Animated.View entering={FadeInDown.duration(380)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 10 }]}>
          <SectionTitle
            title="Tonight · drag to try another bedtime"
            right={
              tryBed !== null ? (
                <PressableScale onPress={() => { setTryBed(null); setDragBed(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <RotateCcw size={13} color={t.colors.accentMid} />
                  <Text style={{ ...t.typography.label, color: t.colors.accentMid }}>Plan</Text>
                </PressableScale>
              ) : undefined
            }
          />
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink }}>{fmtNoon(shown.bed)}</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              up {fmtNoon(shown.actualWake)} · {fmtDuration(shown.sleep)}
            </Text>
          </View>
          <SleepBand
            bed={(committed ?? tonight).bed}
            wake={(committed ?? tonight).wake}
            actualWake={(committed ?? tonight).actualWake}
            wakeBy={tonight.wakeBy}
            height={30}
            draggable
            onPreview={setDragBed}
            onRelease={(b) => {
              setDragBed(null);
              setTryBed(Math.abs(b - tonight.bed) < 1 ? null : b);
            }}
            highlight
          />
          {preview ? (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt, gap: 4 }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                {fmtShift(preview.after.nights[0].bed - tonight.bed)} than planned
              </Text>
              <Text style={{ ...t.typography.caption, color: preview.lossDelta > 5 ? t.colors.danger : t.colors.inkMuted }}>
                Lost sleep this week: {fmtDuration(preview.before.totalLoss)} → {fmtDuration(preview.after.totalLoss)}
              </Text>
              {plan.goalDelta !== null ? (
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                  On the goal schedule: {preview.before.onTrack ? weekdayLabel(preview.before.onTrack) : "—"} → {preview.after.onTrack ? weekdayLabel(preview.after.onTrack) : "not in the plan"}
                </Text>
              ) : null}
              {preview.worstDelta !== null ? (
                <Text style={{ ...t.typography.caption, color: preview.worstDelta < -1 ? t.colors.danger : t.colors.inkMuted }}>
                  Hardest event: {Math.round(preview.before.worst!.score)} → {Math.round(preview.after.worst!.score)} alertness
                </Text>
              ) : null}
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>A preview only — the rest of the plan re-balances around it.</Text>
            </View>
          ) : (
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Amber line = a fixed wake time. Pale tail = sleep the alarm cuts off.</Text>
          )}
        </Animated.View>

        {/* Почему */}
        {why ? (
          <Animated.View entering={FadeInDown.delay(60).duration(380)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
            <SectionTitle title="Why this bedtime" />
            <Text style={{ ...t.typography.body, fontWeight: "700", color: t.colors.ink }}>{why.reason}</Text>
            <Row k="Body clock now" v={`mid-sleep ${fmtNoon(why.phase)} ± ${Math.round(why.phaseSd)} min`} />
            {why.goalPhase !== null ? <Row k="Goal needs" v={`mid-sleep ${fmtNoon(why.goalPhase)}`} /> : null}
            <Row k="Tonight moves it" v={fmtShift(why.night.shift)} />
            {why.gap !== null ? <Row k="Still to go after tonight" v={Math.abs(why.gap) < 5 ? "nothing" : fmtDuration(why.gap)} /> : null}
            {why.nightsLeft !== null ? <Row k="Nights before the goal starts" v={String(why.nightsLeft)} /> : null}
            <Row k="Your pace" v={`up to ${fmtDuration(input.pace)} earlier, ${fmtDuration(input.maxDelay)} later a night`} />
            {why.truncated ? <Text style={{ ...t.typography.caption, color: t.colors.signal }}>Tomorrow's fixed wake time ({fmtNoon(why.night.wakeBy!)}) cuts {fmtDuration(why.night.loss)} off the night.</Text> : null}
          </Animated.View>
        ) : null}

        {/* Конфликты */}
        {conflicts === null ? (
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Checking the plan for conflicts…</Text>
        ) : (
          conflicts.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(staggerDelay(i)).duration(380)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.dangerSoft }]}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TriangleAlert size={18} color={t.colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...t.typography.body, fontWeight: "700", color: t.colors.ink }}>{c.title}</Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 2 }}>{c.reason}</Text>
                </View>
              </View>
              {c.fixes.length ? (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <Text style={{ ...t.typography.overline, color: t.colors.inkFaint }}>Ways out, checked by re-planning</Text>
                  {c.fixes.map((f, j) => (
                    <PressableScale key={j} onPress={() => applyFix(f)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: j === 0 ? t.colors.accentSoft : t.colors.surfaceAlt }}>
                      <Wand size={15} color={j === 0 ? t.colors.accent : t.colors.inkMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{f.label}</Text>
                        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{f.effect}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ) : (
                <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, marginTop: 8 }}>No single change makes this better.</Text>
              )}
            </Animated.View>
          ))
        )}

        {/* Ночи */}
        <SectionTitle title="Night by night" style={{ marginTop: 8 }} />
        {plan.nights.map((n, i) => {
          const hl = params.night === n.night;
          return (
            <Animated.View key={n.night} entering={FadeInDown.delay(staggerDelay(i, 40)).duration(340)} style={[styles.card, { backgroundColor: hl ? t.colors.accentSoft : t.colors.surface, borderColor: hl ? t.colors.accentMid : t.colors.border, gap: 6, paddingVertical: 10 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                  {i === 0 ? "Tonight" : `${weekdayLabel(n.night)} ${dayLabel(n.night)}`} · {fmtNoon(n.bed)} → {fmtNoon(n.actualWake)}
                </Text>
                <Text style={{ ...t.typography.caption, color: n.loss >= 15 ? t.colors.danger : t.colors.inkMuted }}>{n.loss >= 15 ? `−${fmtDuration(n.loss)}` : fmtShift(n.shift)}</Text>
              </View>
              <SleepBand bed={n.bed} wake={n.wake} actualWake={n.actualWake} wakeBy={n.wakeBy} height={16} />
              {n.anchors.map((r) => (
                <Text key={r.id} onPress={() => router.push({ pathname: "/event/[id]", params: { id: r.id } })} style={{ ...t.typography.caption, color: r.score >= 55 ? t.colors.success : t.colors.danger }}>
                  {weekdayLabel(addDays(n.night, 1))}: {name(r.id)} at alertness {Math.round(r.score)} →
                </Text>
              ))}
            </Animated.View>
          );
        })}
      </ScrollView>
      {burst ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <SuccessBurst visible size={110} onDone={() => setTimeout(() => setBurst(false), 250)} />
        </View>
      ) : null}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{k}</Text>
      <Text style={{ ...t.typography.caption, color: t.colors.ink, fontWeight: "700", flexShrink: 1, textAlign: "right" }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, borderWidth: 1 },
});
