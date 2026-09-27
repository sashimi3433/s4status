import { useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../lib/i18n";
import { REGIONS } from "../data/regions";

export default function SubscribeForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [services, setServices] = useState({ s3: true, iam: true });
  // empty set = all regions
  const [regions, setRegions] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [done, setDone] = useState(false);

  const allRegions = regions.size === 0;

  const toggleRegion = (id: string) => {
    setRegions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!valid) {
      setError(true);
      setDone(false);
      return;
    }
    const chosenServices = (["s3", "iam"] as const).filter((s) => services[s]);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          services: chosenServices,
          regions: [...regions],
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { updated?: boolean };
      setError(false);
      setUpdated(!!data.updated);
      setDone(true);
    } catch {
      setError(true);
      setDone(false);
    }
  };

  return (
    <section className="anim-fade-up mx-auto w-full max-w-6xl px-4 pt-10" style={{ animationDelay: "120ms" }}>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-xl font-bold tracking-tight">{t("subscribe.title")}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("subscribe.desc")}</p>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t("subscribe.email")}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
              placeholder={t("subscribe.emailPlaceholder")}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                error
                  ? "border-red-400 focus:ring-red-500/30 dark:border-red-500"
                  : "border-zinc-300 bg-white focus:border-zinc-500 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
              }`}
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t("subscribe.services")}
            </span>
            <div className="flex gap-3">
              {(["s3", "iam"] as const).map((svc) => (
                <label
                  key={svc}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={services[svc]}
                    onChange={(e) => setServices((p) => ({ ...p, [svc]: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  <span className="font-mono text-xs font-bold uppercase">{svc}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-[.97] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {t("subscribe.button")}
          </button>
        </form>

        <details className="group mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60">
            {t("subscribe.regions")}
            <span className="text-zinc-400 dark:text-zinc-500">
              {allRegions ? t("subscribe.allRegions") : `${regions.size}`}
            </span>
          </summary>
          <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <label className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={allRegions}
                onChange={() => setRegions(new Set())}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              {t("subscribe.allRegions")}
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-7">
              {REGIONS.map((r) => (
                <label
                  key={r.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={regions.has(r.id)}
                    onChange={() => toggleRegion(r.id)}
                    className="h-3 w-3 accent-emerald-600"
                  />
                  <span className="truncate">
                    {t(`region.${r.city}` as MessageKey)} {r.zone}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </details>

        {error && (
          <p className="anim-slide-down mt-2 text-sm text-red-600 dark:text-red-400">
            {t("subscribe.invalid")}
          </p>
        )}
        {done && !error && (
          <p className="anim-slide-down mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {t(updated ? "subscribe.updated" : "subscribe.success")}
          </p>
        )}
      </div>
    </section>
  );
}
