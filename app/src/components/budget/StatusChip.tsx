import { useT } from "@/i18n/useT";
import type { InvoiceStatus } from "@/types";

interface Props {
  status: InvoiceStatus;
}

export default function StatusChip({ status }: Props) {
  const t = useT();
  const isPaid = status === "PAID";
  return (
    <span
      className={[
        "inline-block rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        isPaid
          ? "border-status-success-border bg-status-success-bg text-status-success-fg"
          : "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
      ].join(" ")}
    >
      {isPaid ? t("budget.status.paid") : t("budget.status.open")}
    </span>
  );
}
