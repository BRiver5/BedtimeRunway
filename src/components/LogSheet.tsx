import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { AlarmClock, Sun } from "lucide-react-native";
import { useTheme } from "../theme";
import { Field, Sheet } from "./Sheet";
import { Chip, Stepper } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { addDays, dayLabel, weekdayLabel } from "../lib/time";
import { fmtDuration, fmtNoon, fromClock } from "../lib/clock";
import type { SleepLog } from "../lib/phase";
import type { PlannedNight } from "../lib/history";

export const QUALITY = ["Awful", "Poor", "OK", "Good", "Great"];

// Запись ночи. Пресеты: как было в плане, как прошлая ночь, обычное время.
export function LogSheet({
  visible,
  onClose,
  onSave,
  defaultNight,
  logs,
  planned,
  usual,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (l: SleepLog) => void;
  defaultNight: string;
  logs: SleepLog[];
  planned: PlannedNight[];
  usual: { bed: number; wake: number };
  editing?: SleepLog | null;
}) {
  const t = useTheme();
  const [d, setD] = useState<SleepLog>({ night: defaultNight, bed: fromClock(usual.bed), wake: fromClock(usual.wake), alarm: true, quality: 4 });

  const presetFor = (night: string) => {
    const plan = planned.find((p) => p.night === night);
    const prev = [...logs].reverse().find((l) => l.night < night);
    return { plan, prev };
  };

  useEffect(() => {
    if (!visible) return;
    if (editing) return setD(editing);
    const { plan, prev } = presetFor(defaultNight);
    const src = plan ?? prev ?? { bed: fromClock(usual.bed), wake: fromClock(usual.wake) };
    setD({ night: defaultNight, bed: src.bed, wake: src.wake, alarm: prev?.alarm ?? true, quality: 4 });
  }, [visible, editing?.night]);

  const nights = Array.from({ length: 7 }, (_, i) => addDays(defaultNight, -i));
  const { plan, prev } = presetFor(d.night);
  const sleep = d.wake - d.bed;
  const taken = !editing && logs.some((l) => l.night === d.night);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? "Edit night" : "Log a night"}
      subtitle={`${fmtDuration(sleep)} in bed`}
      footer={<PrimaryButton label={taken ? "Replace this night" : editing ? "Save changes" : "Save night"} disabled={sleep < 60 || sleep > 16 * 60} onPress={() => onSave(d)} />}
    >
      {!editing ? (
        <Field label="Night of">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {nights.map((n, i) => (
              <Chip key={n} label={i === 0 ? "Last night" : `${weekdayLabel(n)} ${dayLabel(n)}`} active={d.night === n} onPress={() => setD({ ...d, night: n })} />
            ))}
          </ScrollView>
        </Field>
      ) : null}
      <Field label="Start from">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {plan ? <Chip label="As planned" active={false} onPress={() => setD({ ...d, bed: plan.bed, wake: plan.wake })} /> : null}
          {prev ? <Chip label="Like the night before" active={false} onPress={() => setD({ ...d, bed: prev.bed, wake: prev.wake, alarm: prev.alarm })} /> : null}
          <Chip label="My usual" active={false} onPress={() => setD({ ...d, bed: fromClock(usual.bed), wake: fromClock(usual.wake) })} />
        </View>
      </Field>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Field label="Lights out">
          <Stepper value={d.bed} min={0} max={1380} step={15} onChange={(bed) => setD({ ...d, bed })} format={fmtNoon} />
        </Field>
        <Field label="Woke up">
          <Stepper value={d.wake} min={60} max={1439} step={15} onChange={(wake) => setD({ ...d, wake })} format={fmtNoon} />
        </Field>
      </View>
      <Field label="How did you wake" hint="Alarm nights teach the model less about your natural rhythm.">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Alarm" icon={<AlarmClock size={14} color={d.alarm ? t.colors.onAccent : t.colors.inkMuted} />} active={d.alarm} onPress={() => setD({ ...d, alarm: true })} />
          <Chip label="Naturally" icon={<Sun size={14} color={!d.alarm ? t.colors.onAccent : t.colors.inkMuted} />} active={!d.alarm} onPress={() => setD({ ...d, alarm: false })} />
        </View>
      </Field>
      <Field label="Sleep quality">
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {QUALITY.map((q, i) => (
            <Chip key={q} label={q} active={d.quality === i + 1} onPress={() => setD({ ...d, quality: i + 1 })} />
          ))}
        </View>
      </Field>
      {taken ? <Text style={{ ...t.typography.caption, color: t.colors.signal }}>This night is already logged — saving replaces it.</Text> : null}
    </Sheet>
  );
}
