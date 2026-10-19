// Состояние: журнал ночей → накопленная оценка часов → план полосы.
// rebuild() — единственное место, где модель дообучается и пересобирается план;
// все пересборки идут по очереди. Конфликты (десятки перепланирований)
// считаются один раз на версию, уже после отрисовки.

import { create } from "zustand";
import * as repo from "../data/repo";
import { emptyPhase, MODEL_VERSION, observe, phaseSd, replay, type PhaseState, type SleepLog } from "../lib/phase";
import { buildRunway, type Anchor, type Goal, type Plan, type Rule, type RunwayInput } from "../lib/runway";
import { findConflicts, type Conflict } from "../lib/conflicts";
import type { PlannedNight } from "../lib/history";
import type { Change } from "../lib/changes";
import { fromClock } from "../lib/clock";
import { addDays, todayLocal } from "../lib/time";
import { setHapticsEnabled } from "../services/haptics";

export type Settings = {
  pace: number;
  maxDelay: number;
  alarm: Rule;
  goal: Goal;
  needOverride: number | null;
  usualBed: number; // clock — априор, пока нет записей
  usualWake: number;
  haptics: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  pace: 30,
  maxDelay: 60,
  alarm: { clock: 7 * 60 + 30, days: 0b0011111 },
  goal: null,
  needOverride: null,
  usualBed: 23 * 60 + 30,
  usualWake: 7 * 60 + 30,
  haptics: true,
};

// "Сегодняшняя ночь": до 4 утра ещё идёт вчерашняя.
export function currentNight(): string {
  const h = new Date().getHours();
  return h < 4 ? addDays(todayLocal(), -1) : todayLocal();
}

type State = {
  ready: boolean;
  version: number;
  tonight: string;
  logs: SleepLog[];
  anchors: Anchor[];
  planned: PlannedNight[];
  model: PhaseState;
  settings: Settings;
  input: RunwayInput | null;
  plan: Plan | null;
  conflicts: Conflict[] | null;
  refresh: () => Promise<void>;
  rebuild: () => Promise<void>;
  saveLog: (l: SleepLog) => Promise<void>;
  deleteLog: (night: string) => Promise<void>;
  saveAnchor: (a: repo.AnchorDraft & { id?: string }) => Promise<string>;
  deleteAnchor: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  applyChange: (c: Change) => Promise<void>;
  wipe: () => Promise<void>;
};

let queue: Promise<void> = Promise.resolve();

export const useApp = create<State>((set, get) => ({
  ready: false,
  version: 0,
  tonight: currentNight(),
  logs: [],
  anchors: [],
  planned: [],
  model: emptyPhase(),
  settings: DEFAULT_SETTINGS,
  input: null,
  plan: null,
  conflicts: null,

  refresh: () => (queue = queue.then(() => get().rebuild()).catch(() => undefined)),

  rebuild: async () => {
    const tonight = currentNight();
    const [logs, anchors, stored, version, through] = await Promise.all([
      repo.listLogs(),
      repo.listAnchors(),
      repo.getMeta<Partial<Settings>>("settings", {}),
      repo.getMeta<number>("modelVersion", 0),
      repo.getMeta<string | null>("modelThrough", null),
    ]);
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    setHapticsEnabled(settings.haptics);

    // Модель накапливается: учитываются только ночи после последней обработанной.
    let model: PhaseState;
    if (version !== MODEL_VERSION || through === null) model = replay(logs).state;
    else {
      model = await repo.getMeta<PhaseState>("model", emptyPhase());
      for (const l of logs) if (l.night > through) observe(model, l);
    }
    const last = logs.length ? logs[logs.length - 1].night : null;
    if (version !== MODEL_VERSION || through !== last) {
      await repo.setMeta("model", model);
      await repo.setMeta("modelVersion", MODEL_VERSION);
      await repo.setMeta("modelThrough", last ?? "");
    }

    const usualMid = (fromClock(settings.usualBed) + fromClock(settings.usualWake) + (fromClock(settings.usualWake) < fromClock(settings.usualBed) ? 1440 : 0)) / 2;
    const input: RunwayInput = {
      tonight,
      phase: model.mu ?? usualMid,
      need: settings.needOverride ?? model.need,
      pace: settings.pace,
      maxDelay: settings.maxDelay,
      alarm: settings.alarm,
      goal: settings.goal && settings.goal.from > tonight ? settings.goal : settings.goal ? { ...settings.goal, from: addDays(tonight, 1) } : null,
      anchors: anchors.filter((a) => a.date > tonight),
    };
    const plan = buildRunway(input);
    if (plan.nights[0]) await repo.savePlanned({ night: tonight, bed: plan.nights[0].bed, wake: plan.nights[0].actualWake });
    const planned = await repo.listPlanned();

    set({ ready: true, version: get().version + 1, tonight, logs, anchors, planned, model, settings, input, plan, conflicts: null });
    const v = get().version;
    setTimeout(() => {
      const s = get();
      if (s.version === v && s.input && s.plan) set({ conflicts: findConflicts(s.input, s.plan) });
    }, 0);
  },

  saveLog: async (l) => {
    const existed = get().logs.some((x) => x.night === l.night);
    const last = get().logs.length ? get().logs[get().logs.length - 1].night : null;
    await repo.saveLog(l);
    // Правка/вставка не в конец журнала меняет выученное — пересборка из журнала.
    if (existed || (last !== null && l.night < last)) await repo.setMeta("modelThrough", null);
    await get().refresh();
  },
  deleteLog: async (night) => {
    await repo.deleteLog(night);
    await repo.setMeta("modelThrough", null);
    await get().refresh();
  },
  saveAnchor: async (a) => {
    const id = await repo.saveAnchor(a);
    await get().refresh();
    return id;
  },
  deleteAnchor: async (id) => {
    await repo.deleteAnchor(id);
    await get().refresh();
  },
  updateSettings: async (patch) => {
    await repo.setMeta("settings", { ...get().settings, ...patch });
    await get().refresh();
  },
  // Перевод изменения движка (выход конфликта / what-if) в постоянные данные.
  applyChange: async (c) => {
    const s = get();
    switch (c.kind) {
      case "pace":
        return s.updateSettings({ pace: c.minutes });
      case "goalClock":
        return s.settings.goal ? s.updateSettings({ goal: { ...s.settings.goal, clock: c.clock } }) : undefined;
      case "goalFrom":
        return s.settings.goal ? s.updateSettings({ goal: { ...s.settings.goal, from: c.from } }) : undefined;
      case "need":
        return s.updateSettings({ needOverride: c.minutes });
      case "nap": {
        const a = s.anchors.find((x) => x.id === c.anchorId);
        if (a) await s.saveAnchor({ ...a, nap: c.on });
        return;
      }
      case "tonightBed":
        return;
    }
  },
  wipe: async () => {
    await repo.wipeAll();
    await get().refresh();
  },
}));

export function usePhaseSd(): number {
  return useApp((s) => (s.model.mu === null ? 60 : phaseSd(s.model)));
}
