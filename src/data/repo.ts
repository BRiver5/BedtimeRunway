// Доступ к SQLite. Все обращения строго по очереди (мьютекс): параллельные
// пересборки с записью внутри иначе пересекались, и expo-sqlite отклонял вызовы.

import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import type { SleepLog } from "../lib/phase";
import type { Anchor } from "../lib/runway";
import type { PlannedNight } from "../lib/history";

let chain: Promise<unknown> = Promise.resolve();
function lock<R>(fn: () => Promise<R>): Promise<R> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

export const listLogs = () =>
  lock(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<{ night: string; bed: number; wake: number; alarm: number; quality: number }>("SELECT * FROM logs ORDER BY night ASC;");
    return rows.map((r): SleepLog => ({ night: r.night, bed: r.bed, wake: r.wake, alarm: r.alarm === 1, quality: r.quality }));
  });

export const saveLog = (l: SleepLog) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO logs (night, bed, wake, alarm, quality) VALUES (?, ?, ?, ?, ?);", [l.night, l.bed, l.wake, l.alarm ? 1 : 0, l.quality]);
  });

export const deleteLog = (night: string) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM logs WHERE night = ?;", [night]);
  });

export const listAnchors = () =>
  lock(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; name: string; date: string; time: number; importance: number; nap: number }>("SELECT * FROM anchors ORDER BY date ASC, time ASC;");
    return rows.map((r): Anchor => ({ id: r.id, name: r.name, date: r.date, time: r.time, importance: r.importance, nap: r.nap === 1 }));
  });

export type AnchorDraft = Omit<Anchor, "id">;

export const saveAnchor = (a: AnchorDraft & { id?: string }) =>
  lock(async () => {
    const db = await getDb();
    const id = a.id ?? generateId();
    await db.runAsync("INSERT OR REPLACE INTO anchors (id, name, date, time, importance, nap) VALUES (?, ?, ?, ?, ?, ?);", [id, a.name, a.date, a.time, a.importance, a.nap ? 1 : 0]);
    return id;
  });

export const deleteAnchor = (id: string) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM anchors WHERE id = ?;", [id]);
  });

export const listPlanned = () =>
  lock(async () => {
    const db = await getDb();
    return db.getAllAsync<PlannedNight>("SELECT * FROM planned ORDER BY night ASC;");
  });

export const savePlanned = (p: PlannedNight) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO planned (night, bed, wake) VALUES (?, ?, ?);", [p.night, p.bed, p.wake]);
  });

export function getMeta<T>(key: string, fallback: T): Promise<T> {
  return lock(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?;", [key]);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  });
}

export const setMeta = (key: string, value: unknown) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);", [key, JSON.stringify(value)]);
  });

export const wipeAll = () =>
  lock(async () => {
    const db = await getDb();
    await db.execAsync("DELETE FROM logs; DELETE FROM anchors; DELETE FROM planned; DELETE FROM meta;");
  });
