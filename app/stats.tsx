import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp, usePhaseSd } from "../src/store/appStore";
import { IconButton, Legend, SectionTitle } from "../src/components/Bits";
import { Segmented } from "../src/components/Segmented";
import { NightBars } from "../src/components/NightBars";
import { PhaseTrend } from "../src/components/PhaseTrend";
import { DonutChart } from "../src/components/DonutChart";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { EmptyState } from "../src/components/EmptyState";
import { QUALITY } from "../src/components/LogSheet";
import { adherence, lastNights, qualityByDuration, socialJetlag, trajectory } from "../src/lib/history";
import { needSd } from "../src/lib/phase";
import { fmtDuration, fmtNoon, fromClock } from "../src/lib/clock";
import { addDays, dayLabel, weekStart, weekdayLabel } from "../src/lib/time";
import { pct } from "../src/ui/format";

type Range = "14" | "56";

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const sd = usePhaseSd();
  const [range, setRange] = useState<Range>("14");
  const [sel, setSel] = useState<string | null>(null);
  const days = Number(range);
  const from = addDays(app.tonight, -days);
  const logs = useMemo(() => app.logs.filter((l) => l.night >= from), [app.version, range]);
  const traj = useMemo(() => trajectory(app.logs).filter((p) => p.night >= from), [app.version, range]);
  if (!app.input) return null;

  if (app.logs.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="No nights yet" description="Log a few nights — your body clock, sleep need and how well the plan works show up here." />
      </View>
    );

  const need = app.input.need;
  const bars = lastNights(app.logs, app.tonight, days).map((n) => ({ night: n.night, label: days <= 14 ? weekdayLabel(n.night).slice(0, 1) : String(Number(n.night.slice(8, 10))), sleep: n.log ? n.log.wake - n.log.bed : null, alarm: n.log?.alarm ?? false }));
  const selLog = sel ? app.logs.find((l) => l.night === sel) : null;
  const selTraj = sel ? trajectory(app.logs).find((p) => p.night === sel) : null;
  const sj = socialJetlag(logs);
  const alarmN = logs.filter((l) => l.alarm).length;
  const adh = adherence(logs, app.planned);
  const meanAdh = adh.length ? adh.reduce((s, x) => s + Math.abs(x.diff), 0) / adh.length : null;
  const within = adh.filter((x) => Math.abs(x.diff) <= 30).length;
  const q = qualityByDuration(logs);
  const avgSleep = logs.length ? logs.reduce((s, l) => s + l.wake - l.bed, 0) / logs.length : 0;
  const goalMid = app.settings.goal ? fromClock(app.settings.goal.clock) - need / 2 : null;

  // Тепловая карта качества: 8 недель × 7 дней, колонки — недели.
  const weeks = Math.ceil(days / 7) + 1; // + текущая неделя, она ещё впереди
  const first = weekStart(addDays(app.tonight, -(weeks - 1) * 7));
  const qmap = new Map(app.logs.map((l) => [l.night, l.quality]));
  const cells = Array.from({ length: 7 * weeks }, (_, i) => {
    const night = addDays(first, (i % weeks) * 7 + Math.floor(i / weeks));
    const qq = qmap.get(night);
    return { key: night, intensity: night > app.tonight ? -1 : qq === undefined ? 0 : qq / 5 };
  });

  const sections = [
    <View key="cards" style={{ flexDirection: "row", gap: 10 }}>
      <View style={[styles.card, { flex: 1, backgroundColor: t.colors.surface, borderColor: t.colors.border, alignItems: "center" }]}>
        <AnimatedRing progress={Math.min(1, avgSleep / need)} size={92} strokeWidth={10} color={t.colors.sleep} trackColor={t.colors.backgroundAlt}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: t.colors.ink }}>{pct(avgSleep / need)}</Text>
        </AnimatedRing>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 6, textAlign: "center" }}>of your need, on average</Text>
      </View>
      <View style={{ flex: 1.2, gap: 10 }}>
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, paddingVertical: 10 }]}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: t.colors.ink }}>{fmtNoon(app.input.phase)}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>body-clock mid-sleep · ±{Math.round(sd)} min</Text>
        </View>
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, paddingVertical: 10 }]}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: t.colors.ink }}>{fmtDuration(need)}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{app.settings.needOverride ? "sleep need (set by you)" : `sleep need · ±${Math.round(needSd(app.model))} min from ${app.model.free} free nights`}</Text>
        </View>
      </View>
    </View>,

    <View key="bars" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="Sleep per night" right={sel ? <Text onPress={() => setSel(null)} style={{ ...t.typography.label, color: t.colors.accentMid }}>Clear</Text> : undefined} />
      <View style={{ height: 10 }} />
      <NightBars nights={bars} need={need} selected={sel} onSelect={setSel} />
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 10 }}>
        {selLog
          ? `${weekdayLabel(selLog.night)} ${dayLabel(selLog.night)}: ${fmtNoon(selLog.bed)} → ${fmtNoon(selLog.wake)} · ${fmtDuration(selLog.wake - selLog.bed)} · ${selLog.alarm ? "alarm" : "woke naturally"} · ${QUALITY[selLog.quality - 1]}`
          : "Dashed line = your need. Amber = more than 30 min short. Tap a night."}
      </Text>
    </View>,

    <View key="trend" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="Your body clock, night by night" />
      <View style={{ height: 10 }} />
      <PhaseTrend points={traj} raw={logs.map((l) => ({ night: l.night, mid: (l.bed + l.wake) / 2 }))} selected={sel} goalMid={goalMid} />
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 6 }}>
        {selTraj ? `After ${weekdayLabel(selTraj.night)}: ${fmtNoon(selTraj.mu)} ± ${Math.round(selTraj.sd)} min.` : "Line = the estimate, band = its uncertainty, dots = the nights themselves."}
        {goalMid !== null ? " Amber = where the goal needs it." : ""}
      </Text>
    </View>,

    <View key="sj" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, flexDirection: "row", gap: 16, alignItems: "center" }]}>
      <DonutChart segments={[{ value: alarmN, color: t.colors.accentMid }, { value: logs.length - alarmN, color: t.colors.sleep }]} size={96} strokeWidth={14} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Alarm vs free nights</Text>
        <Legend
          rows={[
            { color: t.colors.accentMid, label: "Alarm", value: String(alarmN) },
            { color: t.colors.sleep, label: "Woke naturally", value: String(logs.length - alarmN) },
          ]}
        />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          {sj.gap === null ? "Need both kinds of nights to measure social jet lag." : `Social jet lag: free nights sit ${fmtDuration(sj.gap)} ${sj.gap >= 0 ? "later" : "earlier"} than alarm nights.`}
        </Text>
      </View>
    </View>,

    <View key="heat" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="Sleep quality" />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <View style={{ gap: 3 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <Text key={w} style={{ fontSize: 9, lineHeight: 15, height: 15, color: t.colors.inkFaint }}>
              {w}
            </Text>
          ))}
        </View>
        <View style={{ width: weeks * 18 - 3 }}>
          <Heatmap
            cells={cells}
            cellSize={15}
            gap={3}
            onCellPress={(c) => (c.intensity > 0 ? setSel(c.key === sel ? null : c.key) : undefined)}
            colorForIntensity={(v) => (v < 0 ? "transparent" : v === 0 ? t.colors.backgroundAlt : v >= 0.8 ? t.colors.accent : v >= 0.6 ? t.colors.accentMid : v >= 0.4 ? t.colors.sleep : t.colors.dawn)}
          />
        </View>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>Darker = better nights. Amber = poor or awful. Rows are the weekday each night starts.</Text>
    </View>,

    <View key="adh" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="Bedtime vs the plan" />
      {adh.length ? (
        <>
          <View style={{ height: 10 }} />
          <BarChart data={adh.slice(-10).map((x) => ({ label: weekdayLabel(x.night).slice(0, 2), value: Math.abs(x.diff) }))} color={t.colors.accentMid} height={90} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>
            Off by {Math.round(meanAdh ?? 0)} min on average · {within} of {adh.length} nights within 30 min.
          </Text>
        </>
      ) : (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>Once you log nights the app planned, this compares them.</Text>
      )}
    </View>,

    <View key="qual" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
      <SectionTitle title="Good nights by length" />
      {q.map((b) => (
        <View key={b.label} style={{ gap: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              {b.label} · {b.n} {b.n === 1 ? "night" : "nights"}
            </Text>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>{b.n ? pct(b.rate) : "—"}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt }}>
            {b.n ? <View style={{ position: "absolute", left: `${b.lo * 100}%`, width: `${Math.max(2, (b.hi - b.lo) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: t.colors.sleepSoft }} /> : null}
            {b.n ? <View style={{ position: "absolute", left: `${b.rate * 100}%`, top: -3, width: 3, height: 14, borderRadius: 2, backgroundColor: t.colors.accent }} /> : null}
          </View>
        </View>
      ))}
      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Tick = share of Good/Great nights, band = 95% range. Wide bands mean too few nights to tell.</Text>
    </View>,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ChevronLeft size={20} color={t.colors.ink} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Stats</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              {logs.length} {logs.length === 1 ? "night" : "nights"} in range{sel ? ` · ${weekdayLabel(sel)} ${dayLabel(sel)} selected` : ""}
            </Text>
          </View>
        </View>
        <Segmented
          items={[
            { key: "14", label: "2 weeks" },
            { key: "56", label: "8 weeks" },
          ]}
          value={range}
          onChange={(k) => {
            setRange(k as Range);
            setSel(null);
          }}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {sections.map((s, i) => (
          <Animated.View key={`${range}-${i}`} entering={FadeInDown.delay(staggerDelay(i, 60)).duration(400)}>
            {s}
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 22, borderWidth: 1 },
});
