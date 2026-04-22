import { CalendarDays } from "lucide-react";
import { useT } from "@/i18n/useT";

/**
 * /harmonogram — V11.1 placeholder. Will show "what is being done now" + a
 * rolling list of scheduled milestones ("this week: základní deska, odpady",
 * "vodáky na kanalizaci objednáni"). Empty scaffold for now.
 */
export default function Harmonogram() {
  const t = useT();
  return (
    <section
      aria-labelledby="harmonogram-heading"
      className="mx-auto max-w-xl px-4 py-8 text-center"
    >
      <div className="grid size-12 place-items-center mx-auto rounded-full bg-bg-subtle text-ink-muted">
        <CalendarDays aria-hidden size={22} />
      </div>
      <h2
        id="harmonogram-heading"
        className="mt-4 text-xl font-semibold tracking-tight text-ink"
      >
        {t("harmonogram.pageTitle")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t("harmonogram.comingSoon")}</p>
    </section>
  );
}
