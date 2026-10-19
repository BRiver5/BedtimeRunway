import { useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "../theme";
import { spring } from "../theme/motion";
import { haptics } from "../services/haptics";

// Полоса одной ночи на оси 6 pm → 2 pm: блок сна (bed → фактический подъём),
// бледный хвост — сон, который отрезал будильник, янтарная черта — жёсткий
// подъём, точка — середина сна по плану. Если draggable — блок можно таскать
// по горизонтали: каждые 15 минут зовётся onPreview, на отпускании onRelease.
export const AXIS_FROM = 360; // 6 pm (от полудня)
export const AXIS_TO = 1560; // 2 pm следующего дня
const SNAP = 15;

export function SleepBand({
  bed,
  wake,
  actualWake,
  wakeBy,
  height = 26,
  draggable,
  onPreview,
  onRelease,
  highlight,
}: {
  bed: number;
  wake: number;
  actualWake: number;
  wakeBy: number | null;
  height?: number;
  draggable?: boolean;
  onPreview?: (bed: number) => void;
  onRelease?: (bed: number) => void;
  highlight?: boolean;
}) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const lifted = useSharedValue(0);
  const lastSnap = useRef(0);
  const span = AXIS_TO - AXIS_FROM;
  const px = (m: number) => ((m - AXIS_FROM) / span) * w;

  const preview = (dxPx: number, final: boolean) => {
    const dm = Math.round(((dxPx / Math.max(1, w)) * span) / SNAP) * SNAP;
    if (final) {
      onRelease?.(bed + dm);
      lastSnap.current = 0;
      return;
    }
    if (dm !== lastSnap.current) {
      lastSnap.current = dm;
      haptics.tick();
      onPreview?.(bed + dm);
    }
  };

  const pan = Gesture.Pan()
    .enabled(!!draggable)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onStart(() => {
      lifted.value = withSpring(1, spring.snappy);
    })
    .onUpdate((e) => {
      x.value = e.translationX;
      runOnJS(preview)(e.translationX, false);
    })
    .onFinalize((e, ok) => {
      if (ok) runOnJS(preview)(e.translationX, true);
      x.value = withSpring(0, spring.snappy);
      lifted.value = withSpring(0, spring.gentle);
    });

  const blockStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleY: 1 + lifted.value * 0.25 }] }));

  const hours = [6, 10, 2, 6, 10, 2]; // подписи каждые 4 часа от 6 pm
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: height + 14 }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: highlight ? t.colors.accentSoft : t.colors.backgroundAlt, overflow: "visible" }}>
        {w > 0 ? (
          <>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ position: "absolute", left: (i / 5) * w, top: 4, bottom: 4, width: 1, backgroundColor: t.colors.border }} />
            ))}
            {actualWake < wake ? <View style={{ position: "absolute", left: px(actualWake), width: Math.max(0, px(wake) - px(actualWake)), top: 6, bottom: 6, borderRadius: 6, backgroundColor: t.colors.sleepSoft }} /> : null}
            <GestureDetector gesture={pan}>
              <Animated.View
                accessibilityLabel={draggable ? "Tonight's sleep, drag to try another bedtime" : undefined}
                style={[{ position: "absolute", left: px(bed), width: Math.max(6, px(actualWake) - px(bed)), top: 2, bottom: 2, borderRadius: height / 2, backgroundColor: draggable ? t.colors.accent : t.colors.sleep }, blockStyle]}
              >
                <View style={{ position: "absolute", left: "50%", top: height / 2 - 6, width: 4, height: 4, borderRadius: 2, marginLeft: -2, backgroundColor: t.colors.onAccent, opacity: 0.8 }} />
              </Animated.View>
            </GestureDetector>
            {wakeBy !== null ? <View style={{ position: "absolute", left: px(wakeBy) - 1, top: -3, bottom: -3, width: 3, borderRadius: 2, backgroundColor: t.colors.dawn }} /> : null}
          </>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        {hours.map((h, i) => (
          <Text key={i} style={{ fontSize: 9, color: t.colors.inkFaint }}>
            {h}
            {i < 2 ? "p" : i < 5 ? "a" : "p"}
          </Text>
        ))}
      </View>
    </View>
  );
}
