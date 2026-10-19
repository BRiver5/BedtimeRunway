import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

function Bar({ h, color, delay }: { h: number; color: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(h, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [h, delay]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: "100%", borderRadius: 5, backgroundColor: color }, st]} />;
}

// Длительность сна по ночам против потребности (пунктир). Тап по столбцу —
// выбрать ночь (остальные секции Stats отмечают её), повторный тап снимает.
export function NightBars({ nights, need, selected, onSelect, height = 120 }: { nights: { night: string; label: string; sleep: number | null; alarm: boolean }[]; need: number; selected: string | null; onSelect: (n: string | null) => void; height?: number }) {
  const t = useTheme();
  const max = Math.max(need + 60, ...nights.map((n) => n.sleep ?? 0));
  const y = (m: number) => (m / max) * height;
  return (
    <View>
      <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: y(need), borderTopWidth: 1, borderStyle: "dashed", borderColor: t.colors.dawn }} />
        {nights.map((n, i) => (
          <Pressable
            key={n.night}
            disabled={n.sleep === null}
            accessibilityLabel={`night ${n.night}`}
            onPress={() => {
              haptics.tick();
              onSelect(selected === n.night ? null : n.night);
            }}
            style={{ flex: 1, height, justifyContent: "flex-end", opacity: selected && selected !== n.night ? 0.35 : 1 }}
          >
            {n.sleep !== null ? <Bar h={Math.max(3, y(n.sleep))} color={n.sleep < need - 30 ? t.colors.dawn : n.alarm ? t.colors.accentMid : t.colors.sleep} delay={i * 30} /> : <View style={{ height: 3, borderRadius: 2, backgroundColor: t.colors.border }} />}
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: 4 }}>
        {nights.map((n, i) => (
          <Text key={n.night} style={{ flex: 1, textAlign: "center", fontSize: 9, color: selected === n.night ? t.colors.ink : t.colors.inkFaint, fontWeight: selected === n.night ? "800" : "400" }}>
            {i % 2 === 0 || nights.length <= 14 ? n.label : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}
