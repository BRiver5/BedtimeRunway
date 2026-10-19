import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { Field, Sheet, inputStyle } from "./Sheet";
import { Chip, Stepper } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { addDays, dayLabel, weekdayLabel } from "../lib/time";
import { fmtClock } from "../lib/clock";
import type { Anchor } from "../lib/runway";
import type { AnchorDraft } from "../data/repo";

export const IMPORTANCE = ["Nice to be sharp", "Important", "Critical"];

const PRESETS: { name: string; time: number; importance: number }[] = [
  { name: "Early shift", time: 6 * 60, importance: 2 },
  { name: "Flight", time: 7 * 60, importance: 2 },
  { name: "Exam", time: 9 * 60, importance: 3 },
  { name: "Interview", time: 10 * 60, importance: 3 },
  { name: "Race", time: 8 * 60, importance: 2 },
];

// Событие, к которому нужно быть бодрым. Пресеты подставляют имя, время и важность.
export function AnchorSheet({ visible, onClose, onSave, today, initial }: { visible: boolean; onClose: () => void; onSave: (a: AnchorDraft & { id?: string }) => void; today: string; initial?: Anchor | null }) {
  const t = useTheme();
  const blank: AnchorDraft = { name: "", date: addDays(today, 2), time: 9 * 60, importance: 2, nap: false };
  const [d, setD] = useState<AnchorDraft & { id?: string }>(blank);
  useEffect(() => {
    if (visible) setD(initial ? { ...initial } : blank);
  }, [visible, initial?.id]);
  const dates = Array.from({ length: 21 }, (_, i) => addDays(today, i + 1));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial ? "Edit event" : "Add an event"}
      subtitle="Something you need to be sharp for."
      footer={<PrimaryButton label={initial ? "Save event" : "Add event"} disabled={!d.name.trim()} onPress={() => onSave({ ...d, name: d.name.trim() })} />}
    >
      {!initial ? (
        <Field label="Presets">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PRESETS.map((p) => (
              <Chip key={p.name} label={p.name} active={d.name === p.name} onPress={() => setD({ ...d, name: p.name, time: p.time, importance: p.importance })} />
            ))}
          </ScrollView>
        </Field>
      ) : null}
      <Field label="Name">
        <TextInput value={d.name} onChangeText={(name) => setD({ ...d, name })} placeholder="e.g. First day at work" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} maxLength={32} />
      </Field>
      <Field label="Day">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dates.map((dt) => (
            <Chip key={dt} label={`${weekdayLabel(dt)} ${dayLabel(dt)}`} active={d.date === dt} onPress={() => setD({ ...d, date: dt })} />
          ))}
        </ScrollView>
      </Field>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Time</Text>
        <Stepper value={d.time} min={0} max={1425} step={15} onChange={(time) => setD({ ...d, time })} format={fmtClock} />
      </View>
      <Field label="How much it matters">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {IMPORTANCE.map((l, i) => (
            <Chip key={l} label={l} active={d.importance === i + 1} onPress={() => setD({ ...d, importance: i + 1 })} />
          ))}
        </View>
      </Field>
    </Sheet>
  );
}
