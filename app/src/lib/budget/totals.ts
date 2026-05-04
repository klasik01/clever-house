import type { BudgetInvoice } from "@/types";

/** Sum castka přes všechny PAID faktury v sekci. Pure helper. */
export function computeSectionPaidTotal(invoices: BudgetInvoice[]): number {
  if (!invoices?.length) return 0;
  return invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + (Number.isFinite(i.castka) ? i.castka : 0), 0);
}

/** Sum castka přes všechny OPEN faktury (= aktuálně sjednané k doplacení). */
export function computeSectionOpenTotal(invoices: BudgetInvoice[]): number {
  if (!invoices?.length) return 0;
  return invoices
    .filter((i) => i.status === "OPEN")
    .reduce((sum, i) => sum + (Number.isFinite(i.castka) ? i.castka : 0), 0);
}

export interface DashboardKpis {
  paidTotalCzk: number;
  openTotalCzk: number;
}

/** Sum napříč všemi sekcemi — vstup z collectionGroup query. */
export function computeDashboardKpis(
  invoicesBySection: Record<string, BudgetInvoice[]>,
): DashboardKpis {
  let paid = 0;
  let open = 0;
  for (const invs of Object.values(invoicesBySection)) {
    for (const inv of invs) {
      if (!Number.isFinite(inv.castka)) continue;
      if (inv.status === "PAID") paid += inv.castka;
      else if (inv.status === "OPEN") open += inv.castka;
    }
  }
  return { paidTotalCzk: paid, openTotalCzk: open };
}
