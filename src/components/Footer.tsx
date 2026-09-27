import { useI18n } from "../lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="anim-fade-in mt-12 border-t border-zinc-200 dark:border-zinc-800" style={{ animationDelay: "150ms" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p>
            © {new Date().getFullYear()} MEGA S4 Status (unofficial) · {t("footer.poweredBy")}
          </p>
          <p className="max-w-xl leading-relaxed">{t("footer.disclaimer")}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:gap-4 sm:self-center">
          <a className="hover:text-zinc-800 dark:hover:text-zinc-200" href="/docs">
            API
          </a>
          <a
            className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
            href="mailto:contact@sessapps.com"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 6L2 7" />
            </svg>
            contact@sessapps.com
          </a>
          <a
            className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
            href="https://github.com/sashimi3433/s4status"
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
            GitHub
          </a>
          <a
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
            href="https://mega.io/s4"
            target="_blank"
            rel="noreferrer"
          >
            mega.io/s4
          </a>
          <a
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
            href="https://help.mega.io/megas4"
            target="_blank"
            rel="noreferrer"
          >
            MEGA S4 Docs
          </a>
          <a
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
            href="https://github.com/meganz/s4-specs"
            target="_blank"
            rel="noreferrer"
          >
            s4-specs
          </a>
        </div>
      </div>
    </footer>
  );
}
