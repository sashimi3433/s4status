import { useI18n } from "../lib/i18n";

export default function Footer() {
  const { t, lang } = useI18n();
  const docsHref = lang === "en" ? "/docs" : `/docs?lang=${lang}`;

  const linkCls =
    "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition";

  return (
    <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-12">
        {/* Brand */}
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            MEGA S4 Status
            <span className="rounded border border-zinc-300 px-1.5 py-px text-[10px] font-medium tracking-widest text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {t("header.unofficial")}
            </span>
          </p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t("footer.disclaimer")}
          </p>
        </div>

        {/* Resources */}
        <nav aria-label={t("footer.resources")}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("footer.resources")}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className={linkCls} href={docsHref}>
                API
              </a>
            </li>
            <li>
              <a
                className={linkCls}
                href="https://mega.io/s4"
                target="_blank"
                rel="noreferrer"
              >
                MEGA S4
              </a>
            </li>
            <li>
              <a
                className={linkCls}
                href="https://help.mega.io/megas4"
                target="_blank"
                rel="noreferrer"
              >
                MEGA S4 Docs
              </a>
            </li>
            <li>
              <a
                className={linkCls}
                href="https://github.com/meganz/s4-specs"
                target="_blank"
                rel="noreferrer"
              >
                s4-specs
              </a>
            </li>
            <li>
              <a
                className={linkCls}
                href="https://github.com/sashimi3433/s4status"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>

        {/* About / legal */}
        <nav aria-label={t("footer.about")}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {t("footer.about")}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className={linkCls} href="/privacy">
                {t("footer.privacy")}
              </a>
            </li>
            <li>
              <a className={linkCls} href="/terms">
                {t("footer.terms")}
              </a>
            </li>
            <li>
              <a className={linkCls} href="mailto:contact@sessapps.com">
                contact@sessapps.com
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>© {new Date().getFullYear()} MEGA S4 Status (unofficial)</span>
        </div>
      </div>
    </footer>
  );
}
