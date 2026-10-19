import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, Trash } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { useApp } from "../../src/store/appStore";
import { AlertnessCurve } from "../../src/components/AlertnessCurve";
import { SleepBand } from "../../src/components/SleepBand";
import { AnimatedCounter } from "../../src/components/AnimatedCounter";
import { Chip, IconButton, SectionTitle, Stepper } from "../../src/components/Bits";
import { Toggle } from "../../src/components/Toggle";
import { IMPORTANCE } from "../../src/components/AnchorSheet";
import { curve } from "../../src/lib/alertness";
import { explainAnchor } from "../../src/lib/explain";
import { ALERT_TARGET } from "../../src/lib/runway";
import { fmtClock, fmtDuration, fmtNoon } from "../../src/lib/clock";
import { dayLabel, weekdayLabel } from "../../src/lib/time";
import { haptics } from "../../src/services/haptics";

export default function EventDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const [name, setName] = useState<string | null>(null);
  const a = app.anchors.find((x) => x.id === id);
  const ex = useMemo(() => (app.input && app.plan && id ? explainAnchor(app.input, app.plan, id) : null), [app.version, id]);
  if (!a) return null;

  const save = (patch: Partial<typeof a>) => app.saveAnchor({ ...a, ...patch });
  const pts = ex ? curve(ex.night.actualWake, ex.night.sleep, ex.night.mid, 20, ex.napAt) : [];
  const score = ex?.parts.score ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <TextInput
          value={name ?? a.name}
          onChangeText={setName}
          onBlur={() => {
            if (name && name.trim() && name.trim() !== a.name) save({ name: name.trim() });
            setName(null);
          }}
          accessibilityLabel="Event name"
          maxLength={32}
          style={{ flex: 1, fontSize: 20, fontWeight: "800", color: t.colors.ink, paddingVertical: 4 }}
        />
        <IconButton
          label="Delete event"
          onPress={() =>
            Alert.alert("Delete event?", a.name, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => { router.back(); await app.deleteAnchor(a.id); } },
            ])
          }
        >
          <Trash size={16} color={t.colors.danger} />
        </IconButton>
      </View>

      <ScrollView stickyHeaderIndices={[1, 3, 5]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* 0: итог */}
        <Animated.View entering={FadeInDown.duration(380)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>
            {weekdayLabel(a.date)} {dayLabel(a.date)} · {fmtClock(a.time)}
          </Text>
          {ex ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
                <AnimatedCounter value={score} style={{ fontSize: 48, fontWeight: "800", color: score >= ALERT_TARGET ? t.colors.ink : t.colors.danger, padding: 0 }} />
                <Text style={{ ...t.typography.body, color: t.colors.inkMuted, marginBottom: 10 }}>/ 100 expected alertness</Text>
              </View>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                {score >= ALERT_TARGET ? "Above the 55 we aim for." : `Below the ${ALERT_TARGET} we aim for — see the plan for ways out.`} {fmtDuration(ex.night.sleep)} of sleep the night before, up at {fmtNoon(ex.night.actualWake)}.
              </Text>
              <View style={{ marginTop: 12, gap: 6 }}>
                <Part label="Rested (sleep pressure low)" value={ex.parts.homeostatic} max={55} color={t.colors.sleep} />
                <Part label="Body-clock timing" value={ex.parts.circadian} max={45} color={t.colors.dawn} />
              </View>
            </>
          ) : (
            <Text style={{ ...t.typography.body, color: t.colors.inkMuted, marginTop: 6 }}>This event is beyond the planned nights — it will be included as it gets closer.</Text>
          )}
        </Animated.View>

        {/* 1 */}
        <Sticky title="The day, hour by hour" />
        {/* 2 */}
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          {ex ? <AlertnessCurve points={pts} eventAt={ex.t} nap={ex.napAt} target={ALERT_TARGET} /> : <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No forecast yet.</Text>}
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, marginTop: 8 }}>An estimate from a simple two-process sleep model, not a medical measurement.</Text>
        </View>

        {/* 3 */}
        <Sticky title="Before it" />
        {/* 4 */}
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 12 }]}>
          {ex ? (
            <>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                The night before: {fmtNoon(ex.night.bed)} → {fmtNoon(ex.night.actualWake)}
              </Text>
              <SleepBand bed={ex.night.bed} wake={ex.night.wake} actualWake={ex.night.actualWake} wakeBy={ex.night.wakeBy} height={18} />
            </>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>20-min nap 3 hours before</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{ex ? `${ex.napGain >= 0 ? "+" : ""}${Math.round(ex.napGain)} alertness at the event` : "Planned with the event"}</Text>
            </View>
            <Toggle
              value={a.nap}
              onValueChange={(v) => {
                haptics.tick();
                save({ nap: v });
              }}
            />
          </View>
        </View>

        {/* 5 */}
        <Sticky title="Details" />
        {/* 6 */}
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 14 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Time</Text>
            <Stepper value={a.time} min={0} max={1425} step={15} onChange={(time) => save({ time })} format={fmtClock} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {IMPORTANCE.map((l, i) => (
              <Chip key={l} label={l} active={a.importance === i + 1} onPress={() => save({ importance: i + 1 })} />
            ))}
          </View>
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>More important events pull the plan harder.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Part({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{label}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.ink, fontWeight: "700" }}>
          {Math.round(value)} of {max}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt, overflow: "hidden" }}>
        <View style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: 8, backgroundColor: color }} />
      </View>
    </View>
  );
}

function Sticky({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.xl, paddingBottom: t.spacing.sm }}>
      <SectionTitle title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, padding: 16, borderRadius: 22, borderWidth: 1 },
});
