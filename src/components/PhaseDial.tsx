import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { toClock } from "../lib/clock";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Hero: сутки по кругу (полночь сверху). Внутреннее кольцо — сегодняшнее окно
// сна по плану (рисуется), внешнее пунктирное — окно сна цели, точка —
// где сейчас середина сна по внутренним часам. Метка на кольце едет к фазе.
function Arc({ size, r, stroke, color, from, len, delay }: { size: number; r: number; stroke: number; color: string; from: number; len: number; delay: number }) {
  const C = 2 * Math.PI * r;
  const L = (Math.max(0, len) / 1440) * C;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [from, len, delay]);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${L * p.value} ${C}`, strokeOpacity: p.value > 0.002 ? 1 : 0 }));
  return (
    <G rotation={(toClock(from) / 1440) * 360 - 90} originX={size / 2} originY={size / 2}>
      <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" animatedProps={props} />
    </G>
  );
}

export function PhaseDial({
  bed,
  wake,
  phase,
  goalBed,
  goalWake,
  size = 240,
  title,
  big,
  sub,
}: {
  bed: number; // от полудня
  wake: number;
  phase: number;
  goalBed: number | null;
  goalWake: number | null;
  size?: number;
  title: string;
  big: string;
  sub: string;
}) {
  const t = useTheme();
  const c = size / 2;
  const rOut = size / 2 - 26; // окно сна цели
  const rIn = rOut - 16; // окно сна сегодня
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.value = withTiming((toClock(phase) / 1440) * 360, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [phase]);
  const marker = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  const ticks = Array.from({ length: 24 }, (_, h) => h);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={c} cy={c} r={rIn} stroke={t.colors.backgroundAlt} strokeWidth={16} fill="none" />
        {ticks.map((h) => {
          const a = ((h / 24) * 360 - 90) * (Math.PI / 180);
          const r1 = rIn - 13;
          const r2 = rIn - (h % 6 === 0 ? 19 : 16);
          return <Line key={h} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} stroke={h % 6 === 0 ? t.colors.inkMuted : t.colors.border} strokeWidth={h % 6 === 0 ? 2 : 1} />;
        })}
        {goalBed !== null && goalWake !== null ? <Arc size={size} r={rOut} stroke={5} color={t.colors.dawn} from={goalBed} len={goalWake - goalBed} delay={300} /> : null}
        <Arc size={size} r={rIn} stroke={16} color={t.colors.accent} from={bed} len={wake - bed} delay={0} />
      </Svg>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, alignItems: "center" }, marker]}>
        <View style={{ marginTop: size / 2 - rIn - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: t.colors.sleep, borderWidth: 3, borderColor: t.colors.surface }} />
      </Animated.View>
      {(["12 am", "6 am", "12 pm", "6 pm"] as const).map((l, i) => {
        const pos = [
          { top: 0, left: c - 20 },
          { top: c - 7, right: -10 },
          { bottom: 0, left: c - 20 },
          { top: c - 7, left: -10 },
        ][i];
        return (
          <Text key={l} style={{ position: "absolute", width: 40, textAlign: "center", fontSize: 10, fontWeight: "700", color: t.colors.inkFaint, ...pos }}>
            {l}
          </Text>
        );
      })}
      <View style={{ alignItems: "center" }}>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink, letterSpacing: -0.5 }}>{big}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{sub}</Text>
      </View>
    </View>
  );
}
