import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CalendarPlus, ChartColumn, ChevronRight, GitCompareArrows, MoonStar, Pencil, Settings2, Trash, TriangleAlert, Coffee } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp, usePhaseSd } from "../src/store/appStore";
import { PhaseDial } from "../src/components/PhaseDial";
import { RunwayStrip } from "../src/components/RunwayStrip";
import { SleepBand } from "../src/components/SleepBand";
import { SwipeRow } from "../src/components/SwipeRow";
import { PressableScale } from "../src/components/PressableScale";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { Sheet } from "../src/components/Sheet";
import { LogSheet, QUALITY } from "../src/components/LogSheet";
import { AnchorSheet } from "../src/components/AnchorSheet";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { explainTonight } from "../src/lib/explain";
import { fmtClock, fmtDuration, fmtNoon, fromClock } from "../src/lib/clock";
import { addDays, dayLabel, weekdayLabel } from "../src/lib/time";
import { haptics } from "../src/services/haptics";
import type { SleepLog } from "../src/lib/phase";

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const sd = usePhaseSd();
  const [sheet, setSheet] = useState<"log" | "anchor" | "menu" | null>(null);
  const [focusLog, setFocusLog] = useState<SleepLog | null>(null);
  const [editLog, setEditLog] = useState<SleepLog | null>(null);
  const [burst, setBurst] = useState(false);
  const { input, plan } = app;
  if (!input || !plan) return null;
  const tonight = plan.nights[0];
  const why = explainTonight(input, plan, sd);
  const goal = app.settings.goal;
  const goalWake = goal ? fromClock(goal.clock) : null;
  const goalBed = goalWake !== null ? goalWake - input.need : null;
  const conflicts = app.conflicts ?? [];
  const recent = [...app.logs].reverse().slice(0, 5);
  const upcoming = app.anchors.filter((a) => a.date > app.tonight);
  const logNight = addDays(app.tonight, -1);

  const pay = () => {
    haptics.success();
    setBurst(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.accentMid }}>
            {weekdayLabel(app.tonight)}, {dayLabel(app.tonight)}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink, letterSpacing: -0.4 }}>Bedtime Runway</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <IconButton label="Stats" onPress={() => router.push("/stats")}>
            <ChartColumn size={18} color={t.colors.ink} />
          </IconButton>
          <IconButton label="Settings" onPress={() => router.push("/settings")}>
            <Settings2 size={18} color={t.colors.ink} />
          </IconButton>
        </View>
      </View>

      <ScrollView stickyHeaderIndices={[3, 5]} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* 0: циферблат */}
        <Animated.View entering={FadeInDown.duration(420)} style={{ alignItems: "center", paddingTop: 4 }}>
          <PhaseDial
            bed={tonight.bed}
            wake={tonight.actualWake}
            phase={input.phase}
            goalBed={goalBed}
            goalWake={goalWake}
            title="Lights out tonight"
            big={fmtNoon(tonight.bed)}
            sub={`up ${fmtNoon(tonight.actualWake)} · ${fmtDuration(tonight.sleep)}`}
          />
        </Animated.View>

        {/* 1: почему + сводка */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ paddingHorizontal: t.spacing.lg, gap: 10, marginTop: 6 }}>
          <PressableScale onPress={() => router.push("/plan")} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...t.typography.body, fontWeight: "700", color: t.colors.ink }}>{why?.reason}</Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                  Body clock: mid-sleep ≈ {fmtNoon(input.phase)} (±{Math.round(sd)} min) · need {fmtDuration(input.need)}
                </Text>
                {goal ? (
                  <Text style={{ ...t.typography.caption, color: t.colors.dawn, fontWeight: "700" }}>
                    Goal {fmtClock(goal.clock)} from {dayLabel(goal.from)} · {plan.onTrack ? (plan.onTrack === app.tonight ? "on track tonight" : `on track by ${weekdayLabel(plan.onTrack)}`) : "not reached in the plan"}
                  </Text>
                ) : (
                  <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>No goal set — keeping you steady around your alarm.</Text>
                )}
              </View>
              <ChevronRight size={18} color={t.colors.inkFaint} />
            </View>
          </PressableScale>
          {conflicts.length ? (
            <PressableScale onPress={() => router.push("/plan")} style={[styles.card, { backgroundColor: t.colors.dangerSoft, borderColor: t.colors.dangerSoft, flexDirection: "row", alignItems: "center", gap: 10 }]}>
              <TriangleAlert size={18} color={t.colors.danger} />
              <Text style={{ ...t.typography.label, color: t.colors.danger, flex: 1 }} numberOfLines={2}>
                {conflicts[0].title}
                {conflicts.length > 1 ? ` · +${conflicts.length - 1} more` : ""}
              </Text>
              <ChevronRight size={16} color={t.colors.danger} />
            </PressableScale>
          ) : null}
          {app.logs.length === 0 ? <StartCard onLog={() => setSheet("log")} /> : null}
        </Animated.View>

        {/* 2: лента */}
        <View style={{ marginTop: t.spacing.lg }}>
          <View style={{ paddingHorizontal: t.spacing.lg, marginBottom: 8 }}>
            <SectionTitle title={`The runway · ${plan.nights.length} nights`} right={goal ? <Text style={{ fontSize: 11, color: t.colors.dawn, fontWeight: "700" }}>— goal bedtime</Text> : undefined} />
          </View>
          <RunwayStrip nights={plan.nights} goalBed={goalBed} onPress={(n) => router.push({ pathname: "/plan", params: { night: n } })} />
        </View>

        {/* 3: липкий заголовок событий */}
        <Sticky title="Coming up" right={<Text onPress={() => setSheet("anchor")} style={{ ...t.typography.label, color: t.colors.accentMid }}>+ Event</Text>} />
        {/* 4 */}
        <View style={{ paddingHorizontal: t.spacing.lg, gap: 8 }}>
          {upcoming.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Add a shift, flight or exam and the plan will make sure you're alert for it.</Text> : null}
          {upcoming.map((a, i) => {
            const n = plan.nights.find((x) => addDays(x.night, 1) === a.date);
            const r = n?.anchors.find((x) => x.id === a.id);
            return (
              <Animated.View key={a.id} entering={FadeInDown.delay(staggerDelay(i)).duration(360)}>
                <SwipeRow
                  right={{ label: a.nap ? "No nap" : "Nap first", icon: <Coffee size={18} color={t.colors.onAccent} />, onTrigger: () => app.saveAnchor({ ...a, nap: !a.nap }) }}
                  left={{ label: "Delete", icon: <Trash size={18} color={t.colors.onAccent} />, onTrigger: () => app.deleteAnchor(a.id) }}
                >
                  <PressableScale onPress={() => router.push({ pathname: "/event/[id]", params: { id: a.id } })} style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                    <View style={{ width: 46, alignItems: "center" }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: t.colors.accentMid }}>{weekdayLabel(a.date).toUpperCase()}</Text>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: t.colors.ink }}>{Number(a.date.slice(8, 10))}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...t.typography.body, fontWeight: "700", color: t.colors.ink }}>{a.name}</Text>
                      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                        {fmtClock(a.time)}
                        {a.nap ? " · nap planned" : ""}
                        {n ? ` · ${fmtDuration(n.sleep)} sleep before` : " · beyond the plan"}
                      </Text>
                    </View>
                    {r ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: r.score >= 55 ? t.colors.success : t.colors.danger }}>{Math.round(r.score)}</Text>
                        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>alertness</Text>
                      </View>
                    ) : null}
                  </PressableScale>
                </SwipeRow>
              </Animated.View>
            );
          })}
          {upcoming.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Swipe right for a nap · left to delete</Text> : null}
        </View>

        {/* 5: липкий заголовок ночей */}
        <Sticky title="Recent nights" />
        {/* 6 */}
        <View style={{ paddingHorizontal: t.spacing.lg, gap: 8 }}>
          {recent.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Nothing logged yet.</Text> : null}
          {recent.map((l, i) => (
            <Animated.View key={l.night} entering={FadeInDown.delay(staggerDelay(i)).duration(360)}>
              <PressableScale
                onLongPress={() => {
                  haptics.press();
                  setFocusLog(l);
                  setSheet("menu");
                }}
                onPress={() => {
                  setEditLog(l);
                  setSheet("log");
                }}
                style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 6 }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                    {weekdayLabel(l.night)} night · {fmtNoon(l.bed)} → {fmtNoon(l.wake)}
                  </Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {fmtDuration(l.wake - l.bed)} · {QUALITY[l.quality - 1]}
                  </Text>
                </View>
                <SleepBand bed={l.bed} wake={l.wake} actualWake={l.wake} wakeBy={l.alarm ? l.wake : null} height={14} />
              </PressableScale>
            </Animated.View>
          ))}
          {recent.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Tap to edit · hold for more</Text> : null}
        </View>
      </ScrollView>

      {/* Командная панель */}
      <View style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 10, flexDirection: "row", gap: 8, padding: 8, borderRadius: 26, backgroundColor: t.colors.accent }}>
        <BarButton icon={<MoonStar size={18} color={t.colors.onAccent} />} label="Log night" primary onPress={() => { setEditLog(null); setSheet("log"); }} />
        <BarButton icon={<CalendarPlus size={18} color={t.colors.onAccent} />} label="Add event" onPress={() => setSheet("anchor")} />
        <BarButton icon={<GitCompareArrows size={18} color={t.colors.onAccent} />} label="What if" onPress={() => router.push("/whatif")} />
      </View>

      {burst ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <SuccessBurst visible size={110} onDone={() => setTimeout(() => setBurst(false), 250)} />
        </View>
      ) : null}

      <LogSheet
        visible={sheet === "log"}
        onClose={() => setSheet(null)}
        defaultNight={logNight}
        logs={app.logs}
        planned={app.planned}
        usual={{ bed: app.settings.usualBed, wake: app.settings.usualWake }}
        editing={editLog}
        onSave={async (l) => {
          setSheet(null);
          if (editLog && editLog.night !== l.night) await app.deleteLog(editLog.night);
          await app.saveLog(l);
          setEditLog(null);
          pay();
        }}
      />
      <AnchorSheet
        visible={sheet === "anchor"}
        onClose={() => setSheet(null)}
        today={app.tonight}
        onSave={async (a) => {
          setSheet(null);
          await app.saveAnchor(a);
          pay();
        }}
      />
      <Sheet visible={sheet === "menu" && !!focusLog} onClose={() => setSheet(null)} title={focusLog ? `${weekdayLabel(focusLog.night)} night` : ""} subtitle={focusLog ? `${fmtNoon(focusLog.bed)} → ${fmtNoon(focusLog.wake)}` : undefined}>
        {focusLog ? (
          <>
            <MenuRow icon={<Pencil size={18} color={t.colors.ink} />} label="Edit" onPress={() => { setEditLog(focusLog); setSheet("log"); }} />
            <MenuRow
              icon={<Trash size={18} color={t.colors.danger} />}
              label="Delete this night"
              danger
              onPress={() =>
                Alert.alert("Delete this night?", "The body-clock estimate will be rebuilt without it.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: async () => { setSheet(null); await app.deleteLog(focusLog.night); } },
                ])
              }
            />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function BarButton({ icon, label, onPress, primary }: { icon: React.ReactNode; label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale onPress={() => { haptics.tap(); onPress(); }} style={{ flex: primary ? 1.3 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 20, backgroundColor: primary ? t.colors.accentMid : "transparent" }}>
      {icon}
      <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
        {label.replace(" ", " ")}
      </Text>
    </PressableScale>
  );
}

function Sticky({ title, right }: { title: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.xl, paddingBottom: t.spacing.sm }}>
      <SectionTitle title={title} right={right} />
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
      {icon}
      <Text style={{ ...t.typography.body, fontWeight: "600", color: danger ? t.colors.danger : t.colors.ink }}>{label}</Text>
    </PressableScale>
  );
}

// Пустое состояние — карточка-чеклист вместо иллюстрации.
function StartCard({ onLog }: { onLog: () => void }) {
  const t = useTheme();
  const steps = ["Log last night — bedtime, wake time, alarm or not.", "Set a goal wake time in Settings, if you have one.", "Follow tonight's bedtime; the estimate sharpens every night."];
  return (
    <View style={[styles.card, { backgroundColor: t.colors.accentSoft, borderColor: t.colors.accentSoft, gap: 10 }]}>
      <Text style={{ ...t.typography.subtitle, color: t.colors.accent }}>Start here</Text>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <Text style={{ fontWeight: "800", color: t.colors.accentMid, width: 16 }}>{i + 1}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.ink, flex: 1 }}>{s}</Text>
        </View>
      ))}
      <Text onPress={onLog} style={{ ...t.typography.label, color: t.colors.accent }}>
        Log last night →
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 20, borderWidth: 1 },
});
