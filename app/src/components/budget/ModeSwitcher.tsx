import { useLocation, useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { ROUTES } from "@/lib/routes";

/**
 * Mode switcher mezi "Deník" (clever-house dosavadní) a "Rozpočet"
 * (nový V27 finance tracker).
 *
 * Visible jen pro role OWNER (renderuje rodič jen tehdy — ne přímo
 * tady, ať komponenta zůstává jednoduchá).
 *
 * Aktivní mode = path startsWith "/rozpocet". Klik přepne na default
 * cestu druhého modu.
 */
export default function ModeSwitcher() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const isBudget = location.pathname.startsWith("/rozpocet");

  return (
    <div
      role="tablist"
      aria-label={t("budget.mode.switcherAria")}
      className="mx-auto flex max-w-xl gap-1 px-4 pb-2"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isBudget}
        onClick={() => {
          if (isBudget) navigate(ROUTES.ukoly);
        }}
        className={[
          "flex-1 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast",
          !isBudget
            ? "bg-accent text-accent-on shadow-sm"
            : "bg-bg-subtle text-ink-muted hover:bg-bg-muted hover:text-ink",
        ].join(" ")}
      >
        {t("budget.mode.denik")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isBudget}
        onClick={() => {
          if (!isBudget) navigate(ROUTES.rozpocet);
        }}
        className={[
          "flex-1 min-h-tap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast",
          isBudget
            ? "bg-accent text-accent-on shadow-sm"
            : "bg-bg-subtle text-ink-muted hover:bg-bg-muted hover:text-ink",
        ].join(" ")}
      >
        {t("budget.mode.rozpocet")}
      </button>
    </div>
  );
}
