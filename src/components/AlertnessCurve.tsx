import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { fmtNoon } from "../lib/clock";
import { haptics } from "../services/haptics";

// Прогноз бодрости на день: линия от подъёма на 18 часов, черта цели 55,
// маркер события. Палец по графику (pan) — значение в любой момент дня.
// Проявление — сдвигающаяся шторка-View (анимированный ClipPath на Android не рисуется).
export function AlertnessCurve({ points, eventAt, nap, target = 55, height = 170 }: { points: { t: number; score: number }[]; eventAt?: number; nap?: number; target?: number; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const cover = useSharedValue(1);
  useEffect(() => {
    cover.value = 1;
    cover.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [points.length, points[0]?.t]);
  const coverStyle = useAnimatedStyle(() => ({ width: `${cover.value * 100}%` }));
  if (points.length < 2) return null;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const X = (x: number) => ((x - t0) / (t1 - t0)) * w;
  const Y = (s: number) => height - 8 - (Math.max(0, Math.min(100, s)) / 100) * (height - 16);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.score).toFixed(1)}`).join(" ");
  const area = `${d} L${X(t1)},${height} L0,${height} Z`;

  const at = (tm: number) => {
    let best = points[0];
    for (const p of points) if (Math.abs(p.t - tm) < Math.abs(best.t - tm)) best = p;
    return best;
  };
  const onScrub = (x: number) => {
    const tm = t0 + (Math.max(0, Math.min(w, x)) / Math.max(1, w)) * (t1 - t0);
    const p = at(tm);
    if (scrub === null || p.t !== scrub) {
      haptics.tick();
      setScrub(p.t);
    }
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(onScrub)(e.x))
    .onUpdate((e) => runOnJS(onScrub)(e.x))
    .onFinalize(() => runOnJS(setScrub)(null));

  const shown = scrub !== null ? at(scrub) : eventAt !== undefined ? at(eventAt) : null;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{shown ? `${scrub !== null ? "At" : "Event"} ${fmtNoon(shown.t)}` : "Drag across the curve"}</Text>
        {shown ? <Text style={{ ...t.typography.label, color: shown.score >= target ? t.colors.success : t.colors.danger }}>{Math.round(shown.score)} / 100</Text> : null}
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
          {w > 0 ? (
            <Svg width={w} height={height}>
              <Rect x={0} y={Y(target)} width={w} height={height - Y(target)} fill={t.colors.dangerSoft} opacity={0.45} />
              <Line x1={0} x2={w} y1={Y(target)} y2={Y(target)} stroke={t.colors.danger} strokeDasharray="4 5" strokeWidth={1} />
              <Path d={area} fill={t.colors.dawnSoft} opacity={0.7} />
              <Path d={d} stroke={t.colors.dawn} strokeWidth={3} fill="none" strokeLinejoin="round" />
              {nap !== undefined ? <Line x1={X(nap)} x2={X(nap)} y1={8} y2={height} stroke={t.colors.sleep} strokeWidth={2} strokeDasharray="2 4" /> : null}
              {eventAt !== undefined ? <Line x1={X(eventAt)} x2={X(eventAt)} y1={4} y2={height} stroke={t.colors.accent} strokeWidth={2} /> : null}
              {shown ? <Circle cx={X(shown.t)} cy={Y(shown.score)} r={6} fill={t.colors.surface} stroke={t.colors.accent} strokeWidth={3} /> : null}
            </Svg>
          ) : null}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: t.colors.surface }, coverStyle]} />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <Text key={f} style={{ fontSize: 10, color: t.colors.inkFaint }}>
            {fmtNoon(t0 + f * (t1 - t0)).replace(":00", "")}
          </Text>
        ))}
      </View>
    </View>
  );
}
