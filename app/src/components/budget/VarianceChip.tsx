import { useT } from "@/i18n/useT";
import type { VarianceState } from "@/lib/budget/totals";
import { formatCzk } from "@/lib/budget/format";

interface Props {
  state: VarianceState;
  variance: number;
  variancePercent: number | null;
  size?: "sm" | "md";
}

export default function VarianceChip({
  state,
  variance,
  variancePercent,
  size = "sm",
}: Props) {
  const t = useT();

  if (state === "no-plan") {
    return (
      <span
        className={[
          sizeCls(size),
          "rounded-pill border border-line bg-bg-subtle text-ink-subtle",
        ].join(" ")}
      >
        {t("budget.variance.noPlan")}
      </span>
    );
  }

  // Format: "+ 12 000 Kč (8 %)" or "− 12 000 Kč (8 %)"
  const sign = variance > 0 ? "+ " : variance < 0 ? "− " : "";
  const absVariance = formatCzk(Math.abs(variance));
  const pctText =
    variancePercent !== null
      ? ` (${Math.abs(Math.round(variancePercent))} %)`
      : "";
  const label = `${sign}${absVariance}${pctText}`;

  // Tailwind nezná custom CSS-variable utility classes přímo, takže barvu
  // aplikujeme přes inline style + CSS variables (viz varianceStyle níže).
  return (
    <span
      className={`${sizeCls(size)} rounded-pill border whitespace-nowrap tabular-nums`}
      style={varianceStyle(state)}
    >
      {label}
    </span>
  );
}

function sizeCls(size: "sm" | "md"): string {
  return size === "md"
    ? "inline-block px-2.5 py-1 text-sm font-medium"
    : "inline-block px-2 py-0.5 text-xs font-medium";
}

function varianceStyle(state: VarianceState): React.CSSProperties {
  switch (state) {
    case "under":
      return {
        background: "var(--color-variance-under-bg)",
        color: "var(--color-variance-under-fg)",
        borderColor: "var(--color-variance-under-border)",
      };
    case "over":
      return {
        background: "var(--color-variance-over-bg)",
        color: "var(--color-variance-over-fg)",
        borderColor: "var(--color-variance-over-border)",
      };
    case "at":
      return {
        background: "var(--color-variance-at-bg)",
        color: "var(--color-variance-at-fg)",
        borderColor: "var(--color-variance-at-border)",
      };
    default:
      return {};
  }
}
