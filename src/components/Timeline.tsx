import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { OP_SECTIONS, type Operation } from "../data/operations";
import { ENDPOINTS, REGIONS } from "../data/regions";
import {
  SLOTS_PER_DAY,
  STATUS_OF,
  addDays,
  dayStatusCodes,
  slotLabel,
  uptimePercent,
  type StatusCode,
} from "../data/mock";
import { useI18n } from "../lib/i18n";
import { STATUS_BG } from "../lib/statusStyles";

interface Props {
  selectedEndpoint: string;
  onSelectEndpoint: (key: string) => void;
  date: string;
  onDateChange: (d: string) => void;
  minDate: string;
  todayStr: string;
  currentSlot: number;
}

interface Tip {
  x: number;
  y: number;
  op: string;
  time: string;
  status: StatusCode;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function BackToNowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ApiBadge({ api }: { api: "s3" | "iam" }) {
  const { t } = useI18n();
  return (
    <span
      className={`rounded px-1.5 py-px font-mono text-[10px] font-bold uppercase ${
        api === "s3"
          ? "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300"
          : "bg-violet-500/10 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300"
      }`}
    >
      {t(api === "s3" ? "api.s3" : "api.iam")}
    </span>
  );
}

function OpRow({
  op,
  statuses,
  revealDelay,
  hourView,
}: {
  op: Operation;
  statuses: StatusCode[];
  revealDelay: number;
  hourView: boolean;
}) {
  const up = uptimePercent(statuses);
  const worstStatus = statuses.reduce<StatusCode>(
    (acc, s) => (s === "outage" ? "outage" : s === "degraded" && acc !== "outage" ? "degraded" : acc),
    "operational",
  );
  return (
    <div className="grid grid-cols-[150px_1fr_58px] items-center gap-3 py-1 [content-visibility:auto] [contain-intrinsic-size:auto_36px] sm:grid-cols-[220px_1fr_64px]">
      <span
        className={`truncate font-mono text-xs sm:text-[13px] ${
          worstStatus === "operational"
            ? "text-zinc-700 dark:text-zinc-300"
            : worstStatus === "degraded"
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400"
        }`}
        title={op.id}
      >
        {op.id}
      </span>
      {/* Bars pop in one by one (flutter). Day view: 2ms stagger per slot so
          the wave crosses a row in ~0.6s, plus a sheen sweep after it; hour
          view: 35ms stagger for a slower, chunkier cascade. */}
      <div
        className={`flex h-7 cursor-crosshair gap-px overflow-hidden rounded-[3px]${hourView ? "" : " anim-row-sheen"}`}
        style={hourView ? undefined : ({ "--rd": `${revealDelay}ms` } as CSSProperties)}
      >
        {statuses.map((s, i) => (
          <div
            key={i}
            data-op={op.id}
            data-idx={i}
            data-status={s}
            className={`${hourView ? "anim-slot-pop" : "anim-slot-fade"} h-full min-w-0 flex-1 hover:brightness-125 ${STATUS_BG[s]}`}
            style={{ animationDelay: `${revealDelay + i * (hourView ? 35 : 2)}ms` }}
          />
        ))}
      </div>
      <span className="text-right text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {up === null ? "—" : `${up.toFixed(2)}%`}
      </span>
    </div>
  );
}

export default function Timeline({
  selectedEndpoint,
  onSelectEndpoint,
  date,
  onDateChange,
  minDate,
  todayStr,
  currentSlot,
}: Props) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tip, setTip] = useState<Tip | null>(null);
  // Vertical highlight column snapped to the hovered 5-minute slot
  const [cross, setCross] = useState<{ left: number; width: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // "all" = full day (288 slots); "0".."23" = zoom into one hour (12 slots).
  // Defaults to the current hour; ?hour=14 or ?hour=all overrides it.
  const [hour, setHour] = useState<string>(() => {
    const q = new URLSearchParams(location.search).get("hour");
    if (q === "all") return "all";
    if (q && /^[0-9]{1,2}$/.test(q) && Number(q) < 24) return String(Number(q));
    return String(new Date().getHours());
  });

  // Heavy re-renders (288 bars x 34 rows) are deferred so the selects and
  // buttons stay responsive while the timeline catches up.
  const deferredHour = useDeferredValue(hour);
  const deferredDate = useDeferredValue(date);
  const deferredEndpoint = useDeferredValue(selectedEndpoint);

  const slotRange = useMemo(
    () =>
      deferredHour === "all"
        ? { start: 0, count: SLOTS_PER_DAY }
        : { start: Number(deferredHour) * 12, count: 12 },
    [deferredHour],
  );

  const sections = useMemo(
    () =>
      OP_SECTIONS.map((section) => ({
        api: section.api,
        group: section.group,
        rows: section.ops.map((op) => {
          const codes = dayStatusCodes(
            op.id,
            deferredEndpoint,
            deferredDate,
            todayStr,
            currentSlot,
          );
          const statuses: StatusCode[] = Array.from(
            codes.subarray(slotRange.start, slotRange.start + slotRange.count),
            (c) => STATUS_OF[c]!,
          );
          return { op, statuses };
        }),
      })),
    [deferredEndpoint, deferredDate, todayStr, currentSlot, slotRange],
  );

  // Global row indices so the bar-reveal stagger flows across section borders.
  const rowOffsets = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (const s of sections) {
      arr.push(acc);
      acc += s.rows.length;
    }
    return arr;
  }, [sections]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onTrackMove = (e: ReactMouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-idx]");
    if (!el || !el.dataset.op) {
      setTip(null);
      setCross(null);
      return;
    }
    setTip({
      x: e.clientX,
      y: e.clientY,
      op: el.dataset.op,
      time: slotLabel(date, slotRange.start + Number(el.dataset.idx)),
      status: el.dataset.status as StatusCode,
    });
    const track = trackRef.current;
    if (track) {
      const r = el.getBoundingClientRect();
      const host = track.getBoundingClientRect();
      setCross({ left: r.left - host.left, width: r.width });
    }
  };

  const onTrackLeave = () => {
    setTip(null);
    setCross(null);
  };

  // Hold the bar cascade until the timeline scrolls into view for the first
  // time, so the entrance animation is actually watchable.
  const [animArmed, setAnimArmed] = useState(false);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setAnimArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setAnimArmed(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const clampDate = (v: string) => {
    if (!v) return date;
    if (v > todayStr) return todayStr;
    if (v < minDate) return minDate;
    return v;
  };

  // "Back to now" — shown whenever the view is not on the current moment
  const currentHourStr = String(Math.floor(currentSlot / 12));
  const isNowView = date === todayStr && hour === currentHourStr;
  const backToNow = () => {
    onDateChange(todayStr);
    setHour(currentHourStr);
  };

  const legend: { code: StatusCode; label: string }[] = [
    { code: "operational", label: t("status.operational") },
    { code: "degraded", label: t("status.degraded") },
    { code: "outage", label: t("status.outage") },
    { code: "nodata", label: t("status.nodata") },
  ];

  // Full day: label every 6 hours. Hour view: label every 5-minute slot.
  const rulerLabels =
    deferredHour === "all"
      ? ["00:00", "06:00", "12:00", "18:00", "24:00"]
      : Array.from({ length: 12 }, (_, i) => `:${String(i * 5).padStart(2, "0")}`);

  const hourWindowLabel =
    deferredHour === "all"
      ? null
      : `${deferredHour.padStart(2, "0")}:00\u2013${deferredHour.padStart(2, "0")}:59`;

  return (
    <section id="timeline" className="anim-fade-up mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("timeline.title")}</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {t("timeline.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {t("timeline.endpoint")}
            <select
              value={selectedEndpoint}
              onChange={(e) => onSelectEndpoint(e.target.value)}
              className="h-8 max-w-[240px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">{t("timeline.allEndpoints")}</option>
              {[...new Set(REGIONS.map((r) => r.city))].map((city) => (
                <optgroup key={city} label={city}>
                  {ENDPOINTS.filter(
                    (ep) => REGIONS.find((r) => r.id === ep.regionId)?.city === city,
                  ).map((ep) => (
                    <option key={ep.key} value={ep.key}>
                      {ep.url}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {t("timeline.hour")}
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              aria-label={t("timeline.hour")}
              className="h-8 w-[112px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="all">{t("timeline.allDay")}</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={String(h)}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>

          <div className="flex h-8 items-center overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              aria-label={t("timeline.prevDay")}
              disabled={date <= minDate}
              onClick={() => onDateChange(addDays(date, -1))}
              className="h-full px-2 text-zinc-600 transition hover:bg-zinc-100 active:scale-90 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ‹
            </button>
            <input
              type="date"
              aria-label={t("timeline.date")}
              value={date}
              min={minDate}
              max={todayStr}
              onChange={(e) => onDateChange(clampDate(e.target.value))}
              className="h-full border-x border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button
              type="button"
              aria-label={t("timeline.nextDay")}
              disabled={date >= todayStr}
              onClick={() => onDateChange(addDays(date, 1))}
              className="h-full px-2 text-zinc-600 transition hover:bg-zinc-100 active:scale-90 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ›
            </button>
          </div>

          {!isNowView && (
            <button
              type="button"
              onClick={backToNow}
              title={t("timeline.backToNow")}
              className="anim-slide-down flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <BackToNowIcon />
              {t("timeline.backToNow")}
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="anim-fade-in mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400" style={{ animationDelay: "180ms" }}>
        {legend.map((l) => (
          <span key={l.code} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-4 rounded-sm ${STATUS_BG[l.code]}`} />
            {l.label}
          </span>
        ))}
        {hourWindowLabel && (
          <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-mono tabular-nums text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            {hourWindowLabel}
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="anim-fade-up mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ animationDelay: "100ms" }}>
        <div
          ref={trackRef}
          onMouseMove={onTrackMove}
          onMouseLeave={onTrackLeave}
          className={`relative min-w-[680px] px-4 py-3 sm:px-5${animArmed ? "" : " anim-hold"}`}
        >
          {cross && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 rounded-sm bg-zinc-400/10 ring-1 ring-inset ring-zinc-400/30 dark:bg-zinc-500/10 dark:ring-zinc-500/30"
              style={{ left: cross.left, width: cross.width }}
            />
          )}
          {/* Hour ruler */}
          <div className="grid grid-cols-[150px_1fr_58px] gap-3 pb-2 sm:grid-cols-[220px_1fr_64px]">
            <span />
            <div className="flex justify-between text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {rulerLabels.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <span />
          </div>

          {sections.map((section, si) => {
            const key = `${section.api}:${section.group}`;
            const open = !collapsed.has(key);
            return (
              <div key={key} className="mt-2">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <Chevron open={open} />
                  <ApiBadge api={section.api} />
                  <span className="text-sm font-semibold">
                    {t(`group.${section.group}` as const)}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {section.rows.length}
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5">
                      {section.rows.map((row, ri) => (
                        <OpRow
                          key={`${deferredEndpoint}|${deferredDate}|${deferredHour}|${row.op.id}`}
                          op={row.op}
                          statuses={row.statuses}
                          revealDelay={220 + (rowOffsets[si]! + ri) * 22}
                          hourView={deferredHour !== "all"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating tooltip */}
      {tip && (
        <div
          className="anim-tooltip pointer-events-none fixed z-50 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          style={{
            left: Math.min(Math.max(tip.x, 100), window.innerWidth - 100),
            top: tip.y - 12,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-mono font-semibold">{tip.op}</p>
          <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            {tip.time} · {t(`status.${tip.status}` as const)}
          </p>
        </div>
      )}
    </section>
  );
}
