import { ENDPOINTS } from "./regions";
import { OPERATIONS } from "./operations";

export type StatusCode = "operational" | "degraded" | "outage" | "nodata";

/** 5-minute slots covering one day: 24h * 60 / 5 */
export const SLOTS_PER_DAY = 288;

// ---------------------------------------------------------------------------
// Deterministic PRNG so the mock data is stable across reloads.
// ---------------------------------------------------------------------------

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Incident {
  start: number;
  len: number;
  code: Exclude<StatusCode, "operational" | "nodata">;
}

const incidentsCache = new Map<string, Incident[]>();

/**
 * Random-but-deterministic incidents for a given operation/endpoint/day.
 * Most operation/endpoint pairs are fully operational on a given day.
 * Memoized: the timeline recomputes day slices on every view switch.
 */
function incidentsFor(
  opId: string,
  endpointKey: string,
  dateStr: string,
  todayStr: string,
  currentSlot: number,
): Incident[] {
  // Today's incidents depend on currentSlot (ongoing demo incidents)
  const key = `${opId}|${endpointKey}|${dateStr}|${dateStr === todayStr ? currentSlot : ""}`;
  let cached = incidentsCache.get(key);
  if (cached) return cached;

  const incidents: Incident[] = [];
  const rng = mulberry32(fnv1a(`${opId}|${endpointKey}|${dateStr}`));
  const r = rng();
  // Most operation/endpoint pairs are fully operational; incidents are rare
  // so uptime numbers stay in a realistic 99%+ range.
  const count = r < 0.998 ? 0 : r < 0.9999 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(rng() * SLOTS_PER_DAY);
    const len = 2 + Math.floor(rng() * 17); // 10–95 minutes
    const code: Incident["code"] = rng() < 0.55 ? "degraded" : "outage";
    incidents.push({ start, len, code });
  }

  // Demo flavor: two ongoing incidents visible on "today" so the page shows
  // both red and yellow states. Mock only — see the FAQ note.
  if (dateStr === todayStr) {
    if (endpointKey === "s3:eu-paris-2") {
      incidents.push({
        start: Math.max(0, currentSlot - 18),
        len: 24,
        code: "outage",
      });
    }
    if (endpointKey === "iam:ap-tokyo-1") {
      incidents.push({
        start: Math.max(0, currentSlot - 30),
        len: 36,
        code: "degraded",
      });
    }
  }
  if (incidentsCache.size > 20000) incidentsCache.clear();
  incidentsCache.set(key, incidents);
  return incidents;
}

const RANK: Record<StatusCode, number> = {
  outage: 3,
  degraded: 2,
  operational: 1,
  nodata: 0,
};

export function worst(a: StatusCode, b: StatusCode): StatusCode {
  return RANK[a] >= RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Fast paths: precomputed per-day status arrays (Uint8Array) so switching the
// timeline view never re-runs the PRNG per slot.
// ---------------------------------------------------------------------------

const CODE_OF: Record<StatusCode, number> = {
  operational: 0,
  degraded: 1,
  outage: 2,
  nodata: 3,
};

/** Index by numeric code: STATUS_OF[codes[slot]] */
export const STATUS_OF = ["operational", "degraded", "outage", "nodata"] as const;

const dayCache = new Map<string, Uint8Array>();

/** Status codes for every slot of one day, for an operation on an endpoint (or "all"). */
export function dayStatusCodes(
  opId: string,
  endpointKey: string,
  dateStr: string,
  todayStr: string,
  currentSlot: number,
): Uint8Array {
  const ck = `${opId}|${endpointKey}|${dateStr}|${dateStr === todayStr ? currentSlot : 0}`;
  let arr = dayCache.get(ck);
  if (arr) return arr;

  arr = new Uint8Array(SLOTS_PER_DAY);
  if (endpointKey === "all") {
    const parts = ENDPOINTS.map((ep) =>
      dayStatusCodes(opId, ep.key, dateStr, todayStr, currentSlot),
    );
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      let code = 0; // stays nodata only when every endpoint has nodata
      for (const p of parts) {
        const c = p[s]!;
        if (c === 3) continue; // nodata never outranks a real status
        if (c > code) code = c;
        if (code === 2) break;
      }
      arr[s] = code;
    }
  } else {
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      arr[s] = CODE_OF[statusAt(opId, endpointKey, dateStr, s, todayStr, currentSlot)];
    }
  }
  if (dayCache.size > 20000) dayCache.clear();
  dayCache.set(ck, arr);
  return arr;
}

const epWorstCache = new Map<string, Uint8Array>();

/** Worst status across all operations, per slot, for one endpoint. */
export function endpointWorstDay(
  epKey: string,
  dateStr: string,
  todayStr: string,
  currentSlot: number,
): Uint8Array {
  const ck = `${epKey}|${dateStr}|${dateStr === todayStr ? currentSlot : 0}`;
  let arr = epWorstCache.get(ck);
  if (arr) return arr;

  arr = new Uint8Array(SLOTS_PER_DAY);
  for (const op of OPERATIONS) {
    const d = dayStatusCodes(op.id, epKey, dateStr, todayStr, currentSlot);
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      const c = d[s]!;
      if (c === 3) continue;
      if (c > arr[s]!) arr[s] = c;
    }
  }
  if (epWorstCache.size > 2000) epWorstCache.clear();
  epWorstCache.set(ck, arr);
  return arr;
}

/**
 * Status of one operation on one endpoint (or "all" for the aggregate
 * worst-case across every endpoint) for a given 5-minute slot.
 */
export function statusAt(
  opId: string,
  endpointKey: string, // "all" or e.g. "s3:eu-luxembourg-1"
  dateStr: string,
  slot: number,
  todayStr: string,
  currentSlot: number,
): StatusCode {
  if (dateStr > todayStr) return "nodata";
  if (dateStr === todayStr && slot > currentSlot) return "nodata";

  if (endpointKey === "all") {
    let acc: StatusCode = "operational";
    for (const ep of ENDPOINTS) {
      acc = worst(acc, statusAt(opId, ep.key, dateStr, slot, todayStr, currentSlot));
      if (acc === "outage") return "outage";
    }
    return acc;
  }

  for (const inc of incidentsFor(opId, endpointKey, dateStr, todayStr, currentSlot)) {
    if (slot >= inc.start && slot < inc.start + inc.len) return inc.code;
  }
  return "operational";
}

/** Share of measured slots that were operational, as 0–100 (null if no data). */
export function uptimePercent(statuses: StatusCode[]): number | null {
  let measured = 0;
  let ok = 0;
  for (const s of statuses) {
    if (s === "nodata") continue;
    measured++;
    if (s === "operational") ok++;
  }
  return measured === 0 ? null : (ok / measured) * 100;
}

// ---------------------------------------------------------------------------
// Date helpers (local time)
// ---------------------------------------------------------------------------

export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateStr(dt);
}

export function currentSlotOf(now: Date): number {
  return Math.floor((now.getHours() * 60 + now.getMinutes()) / 5);
}

export function slotLabel(dateStr: string, slot: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 0, slot * 5, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
