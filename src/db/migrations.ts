import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию —
// добавляй новую в конец массива. PRAGMA user_version хранит номер последней
// применённой ступени, миграции применяются последовательно от текущего значения.
const migrations: string[] = [
  `
  -- Ночь: дата вечера, отбой и подъём в минутах от полудня.
  CREATE TABLE IF NOT EXISTS logs (
    night TEXT PRIMARY KEY NOT NULL,
    bed INTEGER NOT NULL,
    wake INTEGER NOT NULL,
    alarm INTEGER NOT NULL,
    quality INTEGER NOT NULL
  );
  -- События, к которым нужно быть бодрым: дата и время (минуты от полуночи).
  CREATE TABLE IF NOT EXISTS anchors (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time INTEGER NOT NULL,
    importance INTEGER NOT NULL,
    nap INTEGER NOT NULL DEFAULT 0
  );
  -- Снимок плана на ночь (только сегодняшняя переписывается) — для соблюдения плана.
  CREATE TABLE IF NOT EXISTS planned (
    night TEXT PRIMARY KEY NOT NULL,
    bed INTEGER NOT NULL,
    wake INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
