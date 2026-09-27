import { useI18n, LANGUAGES, type Lang } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import type { StatusCode } from "../data/mock";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function SelectCaretIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Header({ overall }: { overall: StatusCode }) {
  const { t, lang, setLang } = useI18n();
  const { mode, cycle } = useTheme();

  const themeTitle = t(
    mode === "light" ? "theme.light" : mode === "dark" ? "theme.dark" : "theme.system",
  );

  return (
    <header className="anim-fade-down sticky top-0 z-40 border-b border-zinc-200 bg-zinc-50/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span key={overall} className="anim-pop-in relative flex h-2.5 w-2.5 shrink-0">
            {overall === "outage" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                overall === "operational"
                  ? "bg-emerald-500"
                  : overall === "degraded"
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            />
          </span>
          <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {t("header.siteTitle")}
          </h1>
          <span className="hidden shrink-0 rounded border border-zinc-300 px-1.5 py-px text-[10px] font-medium tracking-widest text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 sm:inline">
            {t("header.unofficial")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="https://mega.io/s4"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          >
            {t("header.megaLink")}
            <ExternalIcon />
          </a>

          <a
            href="/docs"
            title="API"
            className="rounded-md px-2 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          >
            API
          </a>

          <a
            href="https://github.com/sashimi3433/s4status"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="rounded-md p-2 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-900 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
          </a>

          <button
            type="button"
            onClick={cycle}
            title={themeTitle}
            aria-label={themeTitle}
            className="rounded-md p-2 text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-900 active:scale-90 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100"
          >
            <span key={mode} className="anim-fade-in block">
              {mode === "light" ? <SunIcon /> : mode === "dark" ? <MoonIcon /> : <SystemIcon />}
            </span>
          </button>

          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-2 text-zinc-500 dark:text-zinc-400">
              <GlobeIcon />
            </span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label="Language"
              title="Language"
              className="appearance-none rounded-md border border-zinc-300 bg-white py-1 pl-7 pr-6 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 focus:border-zinc-500 focus:outline-none active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 text-zinc-400 dark:text-zinc-500">
              <SelectCaretIcon />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
