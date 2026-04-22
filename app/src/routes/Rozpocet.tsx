import { Wallet } from "lucide-react";
import { useT } from "@/i18n/useT";

/**
 * /rozpocet — V11 placeholder. Will host price quotes (cenové nabídky) the PM
 * collects from suppliers. Empty for now; the shape lands in a later iteration.
 */
export default function Rozpocet() {
  const t = useT();
  return (
    <section
      aria-labelledby="rozpocet-heading"
      className="mx-auto max-w-xl px-4 py-8 text-center"
    >
      <div className="grid size-12 place-items-center mx-auto rounded-full bg-bg-subtle text-ink-muted">
        <Wallet aria-hidden size={22} />
      </div>
      <h2
        id="rozpocet-heading"
        className="mt-4 text-xl font-semibold tracking-tight text-ink"
      >
        {t("rozpocet.pageTitle")}
      </h2>
      <p className="mt-2 text-sm text-ink-muted">{t("rozpocet.comingSoon")}</p>
    </section>
  );
}
