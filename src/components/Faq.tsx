import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";

export default function Faq() {
  const { t, faq } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  const headerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Opening an item closes the one above it, which would shift the clicked
  // question upward. Pin the clicked question at its current viewport
  // position while the collapse/expand animations run, so the click target
  // stays under the cursor.
  const toggle = (i: number) => {
    setOpen((prev) => (prev === i ? null : i));
    const el = headerRefs.current[i];
    if (!el) return;
    const targetTop = el.getBoundingClientRect().top;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const pin = () => {
      const node = headerRefs.current[i];
      if (!node) return;
      const delta = node.getBoundingClientRect().top - targetTop;
      if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    };
    const start = performance.now();
    const step = () => {
      pin();
      if (performance.now() - start < 400) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  return (
    <section className="anim-fade-up mx-auto w-full max-w-6xl px-4 pt-10" style={{ animationDelay: "60ms" }}>
      <h2 className="text-xl font-bold tracking-tight">{t("faq.title")}</h2>
      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{t("faq.subtitle")}</p>

      <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {faq.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="anim-fade-up"
              style={{ animationDelay: `${120 + i * 50}ms` }}
            >
              <button
                ref={(el) => {
                  headerRefs.current[i] = el;
                }}
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 sm:px-5"
              >
                <span className="text-sm font-medium sm:text-[15px]">{item.q}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:px-5">
                    {item.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
