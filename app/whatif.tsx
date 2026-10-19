import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowRight, ChevronLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { Segmented } from "../src/components/Segmented";
import { Chip, IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { whatIf, describeChange, type Change } from "../src/lib/changes";
import { fmtClock, fmtDuration, fmtNoon } from "../src/lib/clock";
import { addDays, dayLabel, weekdayLabel } from "../src/lib/time";
import { haptics } from "../src/services/haptics";

type Mode = "pace" | "goal" | "start" | "need";

export default function WhatIf() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const goal = app.settings.goal;
  const [mode, setMode] = useState<Mode>("pace");
  const [pace, setPace] = useState(app.settings.pace + 15);
  const [clock, setClock] = useState(goal ? goal.clock + 30 : 7 * 60);
  const [from, setFrom] = useState(goal ? addDays(goal.from, 2) : addDays(app.tonight, 3));
  const [need, setNeed] = useState(Math.round((app.input?.need ?? 480) / 15) * 15 - 30);
  const [burst, setBurst] = useState(false);

  const change: Change | null =
    mode === "pace" ? { kind: "pace", minutes: pace } : mode === "need" ? { kind: "need", minutes: need } : !goal ? null : mode === "goal" ? { kind: "goalClock", clock } : { kind: "goalFrom", from };
  const cmp = useMemo(() => (app.input && app.plan && change ? whatIf(app.input, [change], app.plan) : null), [app.version, JSON.stringify(change)]);
  if (!app.input || !app.plan) return null;
  const name = (id: string) => app.anchors.find((a) => a.id === id)?.name ?? "event";
  const changed = cmp ? cmp.rows.filter((r) => Math.abs(r.bedAfter - r.bedBefore) >= 5 || Math.abs(r.lossAfter - r.lossBefore) >= 5) : [];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>What if…</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Re-plans every night with one change</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
        <Segmented
          items={[
            { key: "pace", label: "Pace" },
            { key: "goal", label: "Goal time" },
            { key: "start", label: "Start day" },
            { key: "need", label: "Sleep" },
          ]}
          value={mode}
          onChange={(k) => setMode(k as Mode)}
        />

        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 12 }]}>
          {mode === "pace" ? (
            <Control label="Earliest shift per night" hint={`Now ${fmtDuration(app.settings.pace)}. Faster gets there sooner but feels rougher.`}>
              <Stepper value={pace} min={5} max={90} step={5} onChange={setPace} format={(v) => `${v}m`} />
            </Control>
          ) : mode === "need" ? (
            <Control label="Plan for this much sleep" hint={`Estimated need ${fmtDuration(app.input.need)}.`}>
              <Stepper value={need} min={300} max={600} step={15} onChange={setNeed} format={(v) => fmtDuration(v)} />
            </Control>
          ) : !goal ? (
            <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>Set a goal wake time in Settings to try this.</Text>
          ) : mode === "goal" ? (
            <Control label="Goal wake time" hint={`Now ${fmtClock(goal.clock)}.`}>
              <Stepper value={clock} min={180} max={720} step={15} onChange={setClock} format={fmtClock} />
            </Control>
          ) : (
            <>
              <SectionTitle title={`New wake time starts · now ${dayLabel(goal.from)}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {Array.from({ length: 14 }, (_, i) => addDays(app.tonight, i + 1)).map((d) => (
                  <Chip key={d} label={`${weekdayLabel(d)} ${dayLabel(d)}`} active={d === from} onPress={() => setFrom(d)} />
                ))}
              </ScrollView>
            </>
          )}
        </View>

        {cmp ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Column title="Now" loss={cmp.before.totalLoss} onTrack={cmp.before.onTrack} worst={cmp.before.worst?.score ?? null} />
              <View style={{ justifyContent: "center" }}>
                <ArrowRight size={18} color={t.colors.inkFaint} />
              </View>
              <Column title="If" loss={cmp.after.totalLoss} onTrack={cmp.after.onTrack} worst={cmp.after.worst?.score ?? null} compareLoss={cmp.before.totalLoss} compareWorst={cmp.before.worst?.score ?? null} />
            </View>
            {cmp.after.worst ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Hardest event: {name(cmp.after.worst.id)}.</Text> : null}

            <SectionTitle title={changed.length ? `${changed.length} nights change` : "No night changes"} />
            {changed.map((r, i) => (
              <Animated.View key={r.night} entering={FadeInDown.delay(staggerDelay(i)).duration(320)} style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                <Text style={{ ...t.typography.label, color: t.colors.ink, width: 74 }}>
                  {r.night === app.tonight ? "Tonight" : `${weekdayLabel(r.night)} ${Number(r.night.slice(8, 10))}`}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {fmtNoon(r.bedBefore)} → <Text style={{ fontWeight: "800", color: t.colors.ink }}>{fmtNoon(r.bedAfter)}</Text>
                  </Text>
                </View>
                <Text style={{ ...t.typography.caption, color: r.lossAfter > r.lossBefore + 4 ? t.colors.danger : r.lossAfter < r.lossBefore - 4 ? t.colors.success : t.colors.inkFaint }}>
                  {r.lossBefore < 5 && r.lossAfter < 5 ? "full sleep" : `short ${Math.round(r.lossBefore)} → ${Math.round(r.lossAfter)} min`}
                </Text>
              </Animated.View>
            ))}

            {change ? (
              <PrimaryButton
                label={`Apply: ${describeChange(change, name)}`}
                disabled={!changed.length}
                onPress={async () => {
                  await app.applyChange(change);
                  haptics.success();
                  setBurst(true);
                }}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {burst ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <SuccessBurst visible size={110} onDone={() => setTimeout(() => setBurst(false), 250)} />
        </View>
      ) : null}
    </View>
  );
}

function Control({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{label}</Text>
        {children}
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{hint}</Text>
    </View>
  );
}

function Column({ title, loss, onTrack, worst, compareLoss, compareWorst }: { title: string; loss: number; onTrack: string | null; worst: number | null; compareLoss?: number; compareWorst?: number | null }) {
  const t = useTheme();
  const isIf = compareLoss !== undefined;
  const dl = isIf ? loss - (compareLoss as number) : 0;
  return (
    <View style={[styles.card, { flex: 1, backgroundColor: isIf ? t.colors.surface : t.colors.surfaceAlt, borderColor: t.colors.border, gap: 4 }]}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink }}>{loss < 5 ? "0 min" : fmtDuration(loss)}</Text>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>lost sleep</Text>
      {isIf && Math.abs(dl) >= 5 ? <Text style={{ ...t.typography.label, color: dl > 0 ? t.colors.danger : t.colors.success }}>{dl > 0 ? "+" : "−"}{fmtDuration(dl)}</Text> : null}
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 6 }}>On goal: {onTrack ? weekdayLabel(onTrack) : "—"}</Text>
      {worst !== null ? (
        <Text style={{ ...t.typography.caption, color: isIf && compareWorst !== null && compareWorst !== undefined && worst < compareWorst - 1 ? t.colors.danger : t.colors.inkMuted }}>Hardest event: {Math.round(worst)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 22, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
});
