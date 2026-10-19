// Палитра приложения. Это единственный файл, где должны жить цветовые значения —
// компоненты и экраны берут цвета только отсюда, магические hex-коды в JSX запрещены.
//
// Bedtime Runway: полночный индиго #2E2163 (tools/palette-search.js, сектор 252°,
// дистанция 14.1 до ближайшего в реестре) на холодном "лунном" фоне; вторичный
// тон — рассветный янтарь (подъём, бодрость), сон — сиреневая дымка.

export const light = {
  background: "#F3F4F8",
  backgroundAlt: "#E8E9F1",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F1F7",
  border: "#DEDFEA",
  ink: "#17162B",
  inkMuted: "#5D5C74",
  inkFaint: "#9B9AB0",
  onAccent: "#FFFFFF",
  onAccentFaint: "rgba(255,255,255,0.18)",
  accent: "#2E2163",
  accentSoft: "#E3E0F3",
  accentMid: "#6B5FB0",
  // Сон на графиках и полосах.
  sleep: "#8C80D6",
  sleepSoft: "#D9D4F4",
  // Подъём / бодрость / рассвет.
  dawn: "#C46A12",
  dawnSoft: "#F7E5CF",
  danger: "#B63A47",
  dangerSoft: "#F5DDE0",
  success: "#2F7D5B",
  // Предупреждение/второе свайп-действие (SwipeRow, бейдж Segmented) — тёмный
  // янтарь, белый текст на нём ≥ 4.5:1.
  signal: "#9A5512",
  // statusDimmed = background × 0.55 + ink × 0.45.
  scrim: "rgba(23,22,43,0.45)",
  statusDimmed: "#928F9E",
};

export const dark = {
  background: "#0F0E1C",
  backgroundAlt: "#151427",
  surface: "#1B1A30",
  surfaceAlt: "#232239",
  border: "#2E2D47",
  ink: "#EEEDF7",
  inkMuted: "#A9A7C2",
  inkFaint: "#6D6B88",
  onAccent: "#FFFFFF",
  onAccentFaint: "rgba(255,255,255,0.18)",
  accent: "#8C80D6",
  accentSoft: "#2A2550",
  accentMid: "#A89EE6",
  sleep: "#8C80D6",
  sleepSoft: "#2E2A55",
  dawn: "#E8933D",
  dawnSoft: "#3A2A18",
  danger: "#E86C78",
  dangerSoft: "#3A1C22",
  success: "#5CC08F",
  signal: "#E0A040",
  scrim: "rgba(0,0,0,0.6)",
  statusDimmed: "#070710",
};

export type Palette = typeof light;
