import { ENDPOINTS, REGIONS } from "../data/regions";
import { OPERATIONS } from "../data/operations";
import {
  dayStatusCodes,
  endpointWorstDay,
  STATUS_OF,
  worst,
  type StatusCode,
} from "../data/mock";
import { useI18n, type MessageKey } from "../lib/i18n";
import { STATUS_CHIP_BG, STATUS_DOT, BANNER_BG } from "../lib/statusStyles";

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m10.29 3.86-8.47 14.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4m0 4h.01" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

/** Minutes since the endpoint left "operational" (contiguous tail of today). */
function ongoingMinutes(epKey: string, todayStr: string, currentSlot: number): number {
  const codes = endpointWorstDay(epKey, todayStr, todayStr, currentSlot);
  let s = currentSlot;
  while (s >= 0 && codes[s] !== 0) s--;
  return (currentSlot - s) * 5;
}

/** Worst status across all operations, per endpoint, for the current slot. */
export function computeEndpointStatuses(
  todayStr: string,
  currentSlot: number,
): Map<string, StatusCode> {
  const map = new Map<string, StatusCode>();
  for (const ep of ENDPOINTS) {
    const codes = endpointWorstDay(ep.key, todayStr, todayStr, currentSlot);
    map.set(ep.key, STATUS_OF[codes[currentSlot]!]!);
  }
  return map;
}

/** Today's operational share (all operations × measured slots), per endpoint. */
export function computeEndpointUptimes(
  todayStr: string,
  currentSlot: number,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const ep of ENDPOINTS) {
    const codes = endpointWorstDay(ep.key, todayStr, todayStr, currentSlot);
    let measured = 0;
    let ok = 0;
    for (let s = 0; s <= currentSlot; s++) {
      const c = codes[s]!;
      if (c === 3) continue; // nodata
      measured++;
      if (c === 0) ok++;
    }
    map.set(ep.key, measured === 0 ? null : (ok / measured) * 100);
  }
  return map;
}

function agoLabel(now: Date, last: Date, t: ReturnType<typeof useI18n>["t"]): string {
  const sec = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 1000));
  return sec < 60
    ? t("stats.secondsAgo", { n: sec })
    : t("stats.minutesAgo", { n: Math.floor(sec / 60) });
}

/** Endpoint cards grouped by city (region), preserving REGIONS order. */
const CITY_GROUPS = (() => {
  let offset = 0;
  return [...new Set(REGIONS.map((r) => r.city))].map((city) => {
    const endpoints = ENDPOINTS.filter(
      (ep) => REGIONS.find((r) => r.id === ep.regionId)?.city === city,
    );
    const group = { city, endpoints, offset };
    offset += endpoints.length;
    return group;
  });
})();

interface Props {
  statuses: Map<string, StatusCode>;
  uptimes: Map<string, number | null>;
  todayStr: string;
  currentSlot: number;
  lastChecked: Date;
  now: Date;
  selected: string; // endpoint key or "all"
  onSelect: (key: string) => void;
}

export default function OverallStats({
  statuses,
  uptimes,
  todayStr,
  currentSlot,
  lastChecked,
  now,
  selected,
  onSelect,
}: Props) {
  const { t } = useI18n();

  const affectedList = ENDPOINTS.map((ep) => ({
    ep,
    st: statuses.get(ep.key) ?? "operational",
  })).filter((x) => x.st !== "operational");
  const overallState: "operational" | "degraded" | "outage" = affectedList.some(
    (x) => x.st === "outage",
  )
    ? "outage"
    : affectedList.length > 0
      ? "degraded"
      : "operational";
  const allOk = overallState === "operational";
  const affected = affectedList.length;

  // Longest ongoing incident across affected endpoints
  const incidentMinutes = affectedList.reduce(
    (max, { ep }) => Math.max(max, ongoingMinutes(ep.key, todayStr, currentSlot)),
    0,
  );
  const durationLabel =
    incidentMinutes >= 60
      ? t("stats.durationHour", { h: Math.round((incidentMinutes / 60) * 10) / 10 })
      : t("stats.durationMin", { m: incidentMinutes });

  // Distinct operations currently failing on any affected endpoint
  const affectedOpIds = new Set<string>();
  for (const { ep } of affectedList) {
    for (const op of OPERATIONS) {
      const code = dayStatusCodes(op.id, ep.key, todayStr, todayStr, currentSlot)[currentSlot]!;
      if (code !== 0) affectedOpIds.add(op.id);
    }
  }

  const regionName = (city: string) => t(`region.${city}` as MessageKey);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-8">
      {/* Overall hero banner */}
      {allOk ? (
        <div
          className={`anim-fade-up flex flex-col gap-2 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${BANNER_BG.operational}`}
        >
          <div className="flex items-center gap-3">
            <CheckIcon className="h-6 w-6 shrink-0" />
            <p className="text-lg font-semibold">{t("stats.allOperational")}</p>
          </div>
          <div className="text-sm opacity-90">
            <p>{t("stats.lastUpdated", { t: agoLabel(now, lastChecked, t) })}</p>
            <p className="sm:text-right">{t("stats.operations", { n: OPERATIONS.length })}</p>
          </div>
        </div>
      ) : (
        <div className={`anim-fade-up overflow-hidden rounded-xl border ${BANNER_BG[overallState]}`}>
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <AlertIcon
                className={`mt-0.5 h-7 w-7 shrink-0 ${overallState === "outage" ? "animate-pulse" : ""}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold tracking-tight sm:text-2xl">
                  {t(overallState === "outage" ? "stats.incidentOutage" : "stats.incidentDegraded")}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
                  <span>{t("stats.affectedEndpoints", { n: affected })}</span>
                  <span>{durationLabel}</span>
                  <span>{t("stats.affectedOperations", { n: affectedOpIds.size })}</span>
                </p>
              </div>
              <div className="hidden shrink-0 text-right text-xs opacity-75 sm:block">
                <p>{t("stats.lastUpdated", { t: agoLabel(now, lastChecked, t) })}</p>
                <p className="mt-0.5">{t("stats.operations", { n: OPERATIONS.length })}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {affectedList.map(({ ep, st }) => (
                <span
                  key={ep.key}
                  className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${
                    overallState === "outage" ? "bg-white/15" : "bg-black/10"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {ep.url} · {t(`status.${st}` as const)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Endpoint cards */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="anim-fade-up text-sm font-semibold text-zinc-500 dark:text-zinc-400" style={{ animationDelay: "80ms" }}>
          {t("stats.endpoints")}
        </h2>
        {selected !== "all" && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("timeline.allEndpoints")} ✕
          </button>
        )}
      </div>

      <div className="mt-3 space-y-5">
        {CITY_GROUPS.map((group, gi) => {
          const groupStatus = group.endpoints.reduce<StatusCode>(
            (acc, ep) => worst(acc, statuses.get(ep.key) ?? "operational"),
            "operational",
          );
          return (
            <div key={group.city}>
              <div
                className="anim-fade-in mb-2 flex items-center gap-2"
                style={{ animationDelay: `${80 + gi * 40}ms` }}
              >
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[groupStatus]}`} />
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {regionName(group.city)}
                </h3>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  ({group.endpoints.length})
                </span>
              </div>
              <div className="space-y-2">
                {(["s3", "iam"] as const).map((svc, si) => (
                  <div
                    key={svc}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[56px_1fr_1fr]"
                  >
                    <span
                      className={`self-center rounded-md px-1.5 py-1 text-center font-mono text-[11px] font-bold uppercase ${
                        svc === "s3"
                          ? "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
                          : "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300"
                      }`}
                    >
                      {svc}
                    </span>
                    {group.endpoints
                      .filter((ep) => ep.service === svc)
                      .map((ep, zi) => {
                        const st = statuses.get(ep.key) ?? "nodata";
                        const up = uptimes.get(ep.key);
                        const region = REGIONS.find((r) => r.id === ep.regionId)!;
                        const active = selected === ep.key;
                        return (
                          <button
                            key={ep.key}
                            type="button"
                            onClick={() => onSelect(ep.key)}
                            title={t("stats.clickToFilter")}
                            style={{
                              animationDelay: `${120 + (group.offset + si * 2 + zi) * 35}ms`,
                            }}
                            className={`anim-fade-up rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md active:scale-[.98] dark:hover:border-zinc-600 ${
                              active
                                ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                <span className="text-zinc-400 dark:text-zinc-500">zone</span>{" "}
                                {region.zone}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CHIP_BG[st]}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st]}`}
                                />
                                {t(`status.${st}` as const)}
                              </span>
                            </div>
                            <p
                              className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400"
                              title={ep.url}
                            >
                              {ep.url}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {t("stats.uptime24h")}:{" "}
                              <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                                {up == null ? "—" : `${up.toFixed(2)}%`}
                              </span>
                            </p>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
