import { Landmark } from "lucide-react";
import { useT } from "@/i18n/useT";

export default function RozpocetHypoteka() {
  const t = useT();
  return (
    <section
      aria-labelledby="rozpocet-hypoteka-heading"
      className="mx-auto max-w-xl px-4 py-8 text-center"
    >
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-bg-subtle text-ink-muted">
        <Landmark aria-hidden size={22} />
      </div>
      <h2
        id="rozpocet-hypoteka-heading"
        className="mt-4 text-xl font-semibold tracking-tight text-ink"
      >
        {t("budget.hypoteka.title")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">
        {t("budget.hypoteka.comingSoon")}
      </p>
    </section>
  );
}
