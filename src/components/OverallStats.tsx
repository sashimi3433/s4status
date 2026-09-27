import { ENDPOINTS, REGIONS } from "../data/regions";
import { OPERATIONS } from "../data/operations";
import { endpointWorstDay, STATUS_OF, worst, type StatusCode } from "../data/mock";
import { useI18n, type MessageKey } from "../lib/i18n";
import { STATUS_CHIP_BG, STATUS_DOT, bannerClasses } from "../lib/statusStyles";

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
  lastChecked: Date;
  now: Date;
  selected: string; // endpoint key or "all"
  onSelect: (key: string) => void;
}

export default function OverallStats({
  statuses,
  uptimes,
  lastChecked,
  now,
  selected,
  onSelect,
}: Props) {
  const { t } = useI18n();

  const allOk = ENDPOINTS.every((ep) => statuses.get(ep.key) === "operational");
  const affected = ENDPOINTS.filter((ep) => statuses.get(ep.key) !== "operational").length;

  const regionName = (city: string) => t(`region.${city}` as MessageKey);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-8">
      {/* Overall banner */}
      <div
        className={`anim-fade-up flex flex-col gap-2 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${bannerClasses(allOk)}`}
      >
        <div className="flex items-center gap-3">
          <span key={String(allOk)} className="anim-pop-in relative flex h-3.5 w-3.5 shrink-0">
            {!allOk && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            )}
            <span
              className={`relative inline-flex h-3.5 w-3.5 rounded-full ${allOk ? "bg-emerald-500" : "bg-red-500"}`}
            />
          </span>
          <div>
            <p className="text-lg font-semibold">
              {allOk ? t("stats.allOperational") : t("stats.someIssues")}
            </p>
            {!allOk && (
              <p className="text-sm opacity-90">
                {t("stats.affectedEndpoints", { n: affected })}
              </p>
            )}
          </div>
        </div>
        <div className="text-sm opacity-80">
          <p>{t("stats.lastUpdated", { t: agoLabel(now, lastChecked, t) })}</p>
          <p className="sm:text-right">{t("stats.operations", { n: OPERATIONS.length })}</p>
        </div>
      </div>

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
