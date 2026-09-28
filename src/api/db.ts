/**
 * PostgreSQL access via the m1homebase HTTP bridge (db.sessapps.com).
 * The bridge is a token-authed POST /sql endpoint running postgres.js.
 * Storage layer for status_slots / subscriptions / meta.
 */

const DEFAULT_URL = "https://db.sessapps.com/sql";

interface PgRow {
  [key: string]: unknown;
}

interface BridgeResponse {
  ok: boolean;
  rows?: PgRow[];
  error?: string;
}

export class Db {
  constructor(
    private url: string,
    private token: string,
  ) {}

  static fromEnv(env: unknown): Db {
    const e = (env ?? {}) as Record<string, string | undefined>;
    return new Db(e.DB_BRIDGE_URL || DEFAULT_URL, e.DB_BRIDGE_TOKEN || "");
  }

  async query<T = PgRow>(text: string, values: unknown[] = []): Promise<T[]> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ text, values }),
    });
    if (res.status === 401) throw new Error("db bridge: unauthorized");
    const data = (await res.json()) as BridgeResponse;
    if (!data.ok) throw new Error(`db bridge: ${data.error ?? "unknown error"}`);
    return (data.rows ?? []) as T[];
  }
}

/** Create tables if missing (idempotent, runs once per isolate). */
let schemaReady = false;
export async function ensureSchema(db: Db): Promise<void> {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS status_slots (
      slot TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      op TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      PRIMARY KEY (slot, endpoint, op)
    )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_status_slots_slot ON status_slots (slot)",
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      email TEXT PRIMARY KEY,
      services TEXT NOT NULL,
      regions TEXT NOT NULL,
      endpoints TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  await db.query(
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  schemaReady = true;
}
