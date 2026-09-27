import type { StatusCode } from "../data/mock";

export const STATUS_BG: Record<StatusCode, string> = {
  operational: "bg-emerald-500 dark:bg-emerald-400",
  degraded: "bg-amber-500 dark:bg-amber-400",
  outage: "bg-red-500 dark:bg-red-400",
  nodata: "bg-zinc-200 dark:bg-zinc-700",
};

export const STATUS_DOT: Record<StatusCode, string> = STATUS_BG;

export const STATUS_CHIP_BG: Record<StatusCode, string> = {
  operational: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  degraded: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  outage: "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",
  nodata: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-300",
};

/** Bigger banner variant for the overall status */
export function bannerClasses(ok: boolean): string {
  return ok
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
}
