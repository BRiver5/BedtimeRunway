import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useTheme } from "../theme";
import { staggerDelay } from "../theme/motion";
import { PressableScale } from "./PressableScale";
import type { Night } from "../lib/runway";
import { weekdayLabel, addDays } from "../lib/time";
import { fmtNoon } from "../lib/clock";

// Лента ночей: вертикальная мини-шкала 8 pm → 12 pm на каждую ночь, блок сна,
// янтарная черта жёсткого подъёма и линия фазы цели поперёк всей ленты.
const FROM = 480; // 8 pm
const TO = 1440; // 12 pm
const H = 96;

export function RunwayStrip({ nights, goalBed, onPress }: { nights: Night[]; goalBed: number | null; onPress: (night: string) => void }) {
  const t = useTheme();
  const y = (m: number) => ((Math.max(FROM, Math.min(TO, m)) - FROM) / (TO - FROM)) * H;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {nights.map((n, i) => (
        <Animated.View key={n.night} entering={FadeInRight.delay(staggerDelay(i, 50)).duration(360)}>
          <PressableScale onPress={() => onPress(n.night)} style={{ width: 58, padding: 8, borderRadius: 18, backgroundColor: i === 0 ? t.colors.accent : t.colors.surface, borderWidth: 1, borderColor: i === 0 ? t.colors.accent : t.colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: i === 0 ? t.colors.onAccent : t.colors.inkMuted }}>{i === 0 ? "Tonight" : weekdayLabel(addDays(n.night, 1))}</Text>
            <View style={{ height: H, width: 14, marginVertical: 6, borderRadius: 7, backgroundColor: i === 0 ? t.colors.onAccentFaint : t.colors.backgroundAlt }}>
              {goalBed !== null ? <View style={{ position: "absolute", top: y(goalBed), left: -6, right: -6, height: 2, backgroundColor: t.colors.dawn, opacity: 0.8 }} /> : null}
              <View style={{ position: "absolute", top: y(n.bed), height: Math.max(4, y(n.actualWake) - y(n.bed)), left: 0, right: 0, borderRadius: 7, backgroundColor: i === 0 ? t.colors.onAccent : t.colors.sleep }} />
              {n.wakeBy !== null ? <View style={{ position: "absolute", top: y(n.wakeBy) - 1, left: -3, right: -3, height: 3, borderRadius: 2, backgroundColor: t.colors.dawn }} /> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "700", color: i === 0 ? t.colors.onAccent : t.colors.ink }}>
              {fmtNoon(n.bed).replace(" pm", "p").replace(" am", "a")}
            </Text>
            {n.loss >= 15 ? <Text style={{ fontSize: 9, fontWeight: "700", color: i === 0 ? t.colors.dawnSoft : t.colors.danger }}>−{Math.round(n.loss)}m</Text> : <Text style={{ fontSize: 9, color: i === 0 ? t.colors.accentSoft : t.colors.inkFaint }}>{Math.round(n.sleep / 6) / 10}h</Text>}
          </PressableScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
}
