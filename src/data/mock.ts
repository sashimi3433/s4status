/** Shared status types and UTC time/slot utilities.
 *  All slots and dates are UTC (5-minute granularity, 288 slots/day). */

export type StatusCode = "operational" | "degraded" | "outage" | "nodata";

/** 5-minute slots covering one day: 24h * 60 / 5 */
export const SLOTS_PER_DAY = 288;

export const STATUS_OF = ["operational", "degraded", "outage", "nodata"] as const;

export const CODE_OF: Record<StatusCode, number> = {
  operational: 0,
  degraded: 1,
  outage: 2,
  nodata: 3,
};

export function worst(a: StatusCode, b: StatusCode): StatusCode {
  const rank = { outage: 3, degraded: 2, operational: 1, nodata: 0 } as const;
  return rank[a] >= rank[b] ? a : b;
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
// UTC date helpers
// ---------------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toDateStr(dt);
}

export function currentSlotOf(now: Date): number {
  return Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 5);
}

export function slotLabel(_dateStr: string, slot: number): string {
  const minutes = slot * 5;
  return `${p2(Math.floor(minutes / 60))}:${p2(minutes % 60)}`;
}
