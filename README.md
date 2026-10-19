# Bedtime Runway

**Move your sleep, gently, to where it needs to be.**

Плавный переход на новый режим сна — к ранней смене, рейсу или экзамену.
Приложение учит твои внутренние часы по записям ночей (свободные ночи весят
больше, ночи с будильником поправляются на недосып), строит точный план отбоя
на каждую ночь с ограничением на сдвиг за ночь и показывает ожидаемую бодрость
на важных событиях. Полностью офлайн.

## Особенности

- Накапливаемая оценка середины сна и потребности во сне (фильтры Калмана).
- Двухпроцессная модель бодрости (Борбели), дневной сон перед событием.
- Точный план по ночам динамическим программированием, сверенный с полным перебором.
- Перетаскивание сегодняшнего отбоя с живым сравнением последствий.
- Конфликты с проверенными выходами, What if, «почему этот отбой».
- Stats: 7 секций, срез по периоду и по ночи.

## Стек

- Expo SDK 54 + expo-router, TypeScript
- `expo-sqlite` — всё локально, интернет не нужен
- `expo-haptics`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`

## Запуск

```bash
npm install
npx expo start
```

## Проверки

```bash
npm run verify   # tsc + node --test + check-rules + expo export
```

## Структура проекта

```
app/            экраны: index, plan, whatif, event/[id], stats, settings
src/lib/        движок: clock, phase, alertness, runway, changes, conflicts, explain, history
src/data/       repo.ts — доступ к SQLite (через мьютекс)
src/store/      appStore.ts — журнал → оценка часов → план
src/components/ PhaseDial, SleepBand, AlertnessCurve, RunwayStrip, NightBars, PhaseTrend, LogSheet, AnchorSheet + шаблонные
```
