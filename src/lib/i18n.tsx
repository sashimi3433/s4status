import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICTS, FAQ, LANGUAGES, type Lang, type MessageKey } from "./translations";

export type { Lang, MessageKey } from "./translations";
export { LANGUAGES } from "./translations";

const STORAGE_KEY = "s4status-lang";

const LOCALES: Record<Lang, string> = {
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  nl: "nl-NL",
};

/** Display timezone per UI language (data is always stored in UTC). */
export const LANG_TZ: Record<Lang, string> = {
  ja: "Asia/Tokyo",
  en: "UTC",
  zh: "Asia/Shanghai",
  ko: "Asia/Seoul",
  es: "Europe/Madrid",
  fr: "Europe/Paris",
  de: "Europe/Berlin",
  nl: "Europe/Amsterdam",
};

function isLang(v: string | null | undefined): v is Lang {
  return !!v && LANGUAGES.some((l) => l.code === v);
}

/**
 * Priority: ?lang= URL param > saved preference > browser language
 * (first match in navigator.languages by base tag) > English.
 */
function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (isLang(q)) return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {}
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of candidates) {
    const base = String(tag ?? "").toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  fmtDate: (dateStr: string) => string;
  faq: { q: string; a: string }[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => {
      let msg = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replaceAll(`{${k}}`, String(v));
        }
      }
      return msg;
    },
    [lang],
  );

  const fmtDate = useCallback(
    (dateStr: string) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Intl.DateTimeFormat(
        LOCALES[lang],
        lang === "ja"
          ? { year: "numeric", month: "long", day: "numeric", weekday: "short" }
          : { year: "numeric", month: "short", day: "numeric", weekday: "short" },
      ).format(new Date(y, m - 1, d));
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, fmtDate, faq: FAQ[lang] }),
    [lang, setLang, t, fmtDate],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
