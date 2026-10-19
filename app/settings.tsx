import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AlarmClock, ChevronLeft, Flag, Gauge, Moon, Trash, Vibrate } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp, type Settings } from "../src/store/appStore";
import { Chip, IconButton, Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { Segmented } from "../src/components/Segmented";
import { PressableScale } from "../src/components/PressableScale";
import { fmtClock, fmtDuration } from "../src/lib/clock";
import { addDays, dayLabel, weekdayLabel } from "../src/lib/time";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const s = app.settings;
  const up = (p: Partial<Settings>) => app.updateSettings(p);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.xl }}>
        <Group i={0} title="Goal" icon={<Flag size={14} color={t.colors.inkMuted} />}>
          <RowLine label="Move to a new wake time" right={<Toggle value={!!s.goal} onValueChange={(v) => up({ goal: v ? { clock: 6 * 60, from: addDays(app.tonight, 7), days: 0b0011111 } : null })} />} />
          {s.goal ? (
            <>
              <RowLine label="Wake at" right={<Stepper value={s.goal.clock} min={180} max={720} step={15} onChange={(clock) => up({ goal: { ...s.goal!, clock } })} format={fmtClock} />} />
              <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>Starting {weekdayLabel(s.goal.from)} {dayLabel(s.goal.from)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {Array.from({ length: 21 }, (_, i) => addDays(app.tonight, i + 1)).map((d) => (
                    <Chip key={d} label={`${weekdayLabel(d)} ${dayLabel(d)}`} active={d === s.goal!.from} onPress={() => up({ goal: { ...s.goal!, from: d } })} />
                  ))}
                </ScrollView>
              </View>
              <DaysRow mask={s.goal.days} onChange={(days) => up({ goal: { ...s.goal!, days } })} />
            </>
          ) : null}
        </Group>

        <Group i={1} title={s.goal ? "Alarm until the goal starts" : "Your alarm"} icon={<AlarmClock size={14} color={t.colors.inkMuted} />}>
          <RowLine label="I have a fixed wake time" right={<Toggle value={!!s.alarm} onValueChange={(v) => up({ alarm: v ? { clock: 7 * 60 + 30, days: 0b0011111 } : null })} />} />
          {s.alarm ? (
            <>
              <RowLine label="Alarm at" right={<Stepper value={s.alarm.clock} min={180} max={720} step={15} onChange={(clock) => up({ alarm: { ...s.alarm!, clock } })} format={fmtClock} />} />
              <DaysRow mask={s.alarm.days} onChange={(days) => up({ alarm: { ...s.alarm!, days } })} />
            </>
          ) : null}
        </Group>

        <Group i={2} title="Pace" icon={<Gauge size={14} color={t.colors.inkMuted} />}>
          <View style={{ padding: 16, gap: 10 }}>
            <Segmented
              items={[
                { key: "15", label: "Gentle" },
                { key: "30", label: "Steady" },
                { key: "45", label: "Fast" },
              ]}
              value={String([15, 30, 45].reduce((a, b) => (Math.abs(b - s.pace) < Math.abs(a - s.pace) ? b : a)))}
              onChange={(k) => up({ pace: Number(k) })}
            />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Up to {fmtDuration(s.pace)} earlier a night (going later is easier — up to {fmtDuration(s.maxDelay)}). Bigger jumps feel like jet lag.
            </Text>
          </View>
        </Group>

        <Group i={3} title="Sleep" icon={<Moon size={14} color={t.colors.inkMuted} />}>
          <RowLine
            label="Learn my sleep need"
            hint={s.needOverride ? undefined : `Now ${fmtDuration(app.model.need)} from ${app.model.free} free nights`}
            right={<Toggle value={s.needOverride === null} onValueChange={(v) => up({ needOverride: v ? null : Math.round(app.model.need / 15) * 15 })} />}
          />
          {s.needOverride !== null ? <RowLine label="Plan for" right={<Stepper value={s.needOverride} min={300} max={600} step={15} onChange={(needOverride) => up({ needOverride })} format={(v) => fmtDuration(v)} />} /> : null}
          <RowLine label="Usual lights out" hint="Used until you log nights" right={<Stepper value={s.usualBed} min={0} max={1425} step={15} onChange={(usualBed) => up({ usualBed })} format={fmtClock} />} />
          <RowLine label="Usual wake up" right={<Stepper value={s.usualWake} min={0} max={1425} step={15} onChange={(usualWake) => up({ usualWake })} format={fmtClock} />} />
        </Group>

        <Group i={4} title="Feedback" icon={<Vibrate size={14} color={t.colors.inkMuted} />}>
          <RowLine label="Vibration" hint="Taps, saving and dragging" right={<Toggle value={s.haptics} onValueChange={(haptics) => up({ haptics })} />} />
        </Group>

        <Group i={5} title="Data" icon={<Trash size={14} color={t.colors.inkMuted} />}>
          <PressableScale
            onPress={() =>
              Alert.alert("Erase everything?", "All nights, events, settings and the learned body clock will be deleted from this phone.", [
                { text: "Cancel", style: "cancel" },
                { text: "Erase", style: "destructive", onPress: () => app.wipe() },
              ])
            }
            style={{ padding: 16 }}
          >
            <Text style={{ ...t.typography.body, color: t.colors.danger, fontWeight: "600" }}>Erase all data</Text>
          </PressableScale>
        </Group>
        <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Bedtime Runway 1.0 · works offline · estimates, not medical advice</Text>
      </ScrollView>
    </View>
  );
}

function Group({ title, icon, children, i }: { title: string; icon: React.ReactNode; children: React.ReactNode; i: number }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(staggerDelay(i)).duration(380)} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
        {icon}
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
      </View>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 22, borderWidth: 1, borderColor: t.colors.border, overflow: "hidden" }}>{children}</View>
    </Animated.View>
  );
}

function RowLine({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>{label}</Text>
        {hint ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function DaysRow({ mask, onChange }: { mask: number; onChange: (m: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 6, padding: 16, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      {DAYS.map((d, i) => {
        const on = (mask & (1 << i)) !== 0;
        return (
          <PressableScale
            key={d}
            accessibilityLabel={`${d} mornings`}
            onPress={() => {
              const next = mask ^ (1 << i);
              if (next) onChange(next);
            }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: on ? t.colors.accentSoft : t.colors.surfaceAlt }}
          >
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: on ? t.colors.accent : t.colors.inkFaint }}>
              {d.slice(0, 2)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
