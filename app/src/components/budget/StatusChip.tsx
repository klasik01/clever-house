import { useT } from "@/i18n/useT";
import type { ComputedInvoiceStatus } from "@/lib/budget/invoiceStatus";

interface Props {
  status: ComputedInvoiceStatus;
  daysOverdue?: number;
}

export default function StatusChip({ status, daysOverdue }: Props) {
  const t = useT();

  let label: string;
  let cls: string;

  switch (status) {
    case "PAID":
      label = t("budget.status.paid");
      cls = "border-status-success-border bg-status-success-bg text-status-success-fg";
      break;
    case "OVERDUE":
      label =
        daysOverdue && daysOverdue > 0
          ? t("budget.status.overdueDays", { n: daysOverdue })
          : t("budget.status.overdue");
      cls = "border-status-danger-border bg-status-danger-bg text-status-danger-fg";
      break;
    case "OPEN":
    default:
      label = t("budget.status.open");
      cls = "border-status-warning-border bg-status-warning-bg text-status-warning-fg";
  }

  return (
    <span
      className={[
        "inline-block rounded-pill border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        cls,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
