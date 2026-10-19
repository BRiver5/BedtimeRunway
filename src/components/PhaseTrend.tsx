import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "../theme";
import { fmtNoon } from "../lib/clock";

// Как менялась оценка внутренних часов: линия — середина сна по фильтру,
// полоса — ±1 sd, точки — сами ночи. Выбранная ночь отмечена.
export function PhaseTrend({ points, raw, selected, goalMid, height = 140 }: { points: { night: string; mu: number; sd: number }[]; raw: { night: string; mid: number }[]; selected: string | null; goalMid: number | null; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  if (points.length < 2) return <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Log a few nights to see your body clock move.</Text>;
  const vals = [...points.map((p) => p.mu - p.sd), ...points.map((p) => p.mu + p.sd), ...raw.map((r) => r.mid), ...(goalMid !== null ? [goalMid] : [])];
  const lo = Math.floor(Math.min(...vals) / 30) * 30 - 15;
  const hi = Math.ceil(Math.max(...vals) / 30) * 30 + 15;
  const X = (i: number) => (i / (points.length - 1)) * w;
  // Раньше — выше, позже — ниже.
  const Y = (m: number) => ((m - lo) / (hi - lo)) * (height - 10) + 5;
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.mu)}`).join(" ");
  const band = `${points.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.mu - p.sd)}`).join(" ")} ${[...points].reverse().map((p, k) => `L${X(points.length - 1 - k)},${Y(p.mu + p.sd)}`).join(" ")} Z`;
  const selIdx = selected ? points.findIndex((p) => p.night === selected) : -1;
  return (
    <View>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            {goalMid !== null ? <Line x1={0} x2={w} y1={Y(goalMid)} y2={Y(goalMid)} stroke={t.colors.dawn} strokeDasharray="5 5" strokeWidth={1.5} /> : null}
            <Path d={band} fill={t.colors.sleepSoft} opacity={0.8} />
            {raw.map((r) => {
              const i = points.findIndex((p) => p.night === r.night);
              return i >= 0 ? <Circle key={r.night} cx={X(i)} cy={Y(r.mid)} r={2.5} fill={t.colors.inkFaint} /> : null;
            })}
            <Path d={line} stroke={t.colors.accent} strokeWidth={2.5} fill="none" />
            {selIdx >= 0 ? <Circle cx={X(selIdx)} cy={Y(points[selIdx].mu)} r={6} fill={t.colors.surface} stroke={t.colors.accent} strokeWidth={3} /> : null}
          </Svg>
        ) : null}
      </View>
      <Text style={{ fontSize: 10, color: t.colors.inkFaint, marginTop: 4 }}>
        Mid-sleep, higher = earlier · top {fmtNoon(lo)}, bottom {fmtNoon(hi)}
      </Text>
    </View>
  );
}
