// Время ночи храним "от полудня": 0 = 12:00 вечера даты ночи, 1440 = 12:00
// следующего дня. Отбой 23:30 → 690, подъём 07:00 → 1140 — оба в одном
// непрерывном отрезке, без перехода через полночь.
// Время события днём (clock) — минуты от полуночи его даты.

export const DAY = 1440;

export function toClock(noon: number): number {
  return (((noon + 720) % DAY) + DAY) % DAY;
}

export function fromClock(clock: number): number {
  return (((clock - 720) % DAY) + DAY) % DAY;
}

// Время события на дату D в системе отсчёта ночи D−1.
export function eventInNightFrame(clock: number): number {
  return clock + 720;
}

// Показываем с точностью до 5 минут: план считается в минутах, но "11:21 pm" выглядит как ошибка.
export function fmtClock(clock: number): string {
  const m = ((Math.round(clock / 5) * 5 % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function fmtNoon(noon: number): string {
  return fmtClock(toClock(noon));
}

export function fmtDuration(min: number): string {
  const m = Math.round(Math.abs(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

// Сдвиг со знаком: "-40 min" = раньше.
export function fmtShift(min: number): string {
  const r = Math.round(min);
  if (r === 0) return "no change";
  return `${fmtDuration(r)} ${r < 0 ? "earlier" : "later"}`;
}

export function snap(min: number, step = 5): number {
  return Math.round(min / step) * step;
}
