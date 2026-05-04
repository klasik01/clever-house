import type { BankDrawdown, BudgetInvoice, BudgetSettings } from "@/types";

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
  drawnTotalCzk: number;
  mortgageLimitCzk: number | null;
}

/** Sum napříč všemi sekcemi + drawdowns + settings. */
export function computeDashboardKpis(
  invoicesBySection: Record<string, BudgetInvoice[]>,
  drawdowns: BankDrawdown[] = [],
  settings?: BudgetSettings | null,
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
  const drawn = drawdowns.reduce(
    (sum, d) => sum + (Number.isFinite(d.castka) ? d.castka : 0),
    0,
  );
  return {
    paidTotalCzk: paid,
    openTotalCzk: open,
    drawnTotalCzk: drawn,
    mortgageLimitCzk: settings?.mortgageApprovedAmountCzk ?? null,
  };
}

export interface MortgageStatus {
  /** Schválený limit. null = nenastaveno. */
  limit: number | null;
  /** Suma vyčerpaných tranší. */
  drawn: number;
  /** Zbývá k vyčerpání. null pokud není limit. */
  remaining: number | null;
  /** Procento vyčerpání 0–100+. null pokud není limit. */
  percentage: number | null;
  /** Nad limitem? */
  overLimit: boolean;
}

/**
 * Status hypotéky vůči schválenému limitu.
 * Pure: testovatelné samostatně bez Firestore.
 */
export function computeMortgageStatus(
  settings: BudgetSettings | null | undefined,
  drawdowns: BankDrawdown[],
): MortgageStatus {
  const limit =
    settings && Number.isFinite(settings.mortgageApprovedAmountCzk as number)
      ? Math.round(settings.mortgageApprovedAmountCzk as number)
      : null;
  const drawn = (drawdowns || []).reduce(
    (sum, d) => sum + (Number.isFinite(d.castka) ? d.castka : 0),
    0,
  );
  if (limit === null) {
    return { limit: null, drawn, remaining: null, percentage: null, overLimit: false };
  }
  const remaining = limit - drawn;
  const percentage = limit > 0 ? Math.round((drawn / limit) * 100) : 0;
  return {
    limit,
    drawn,
    remaining,
    percentage,
    overLimit: drawn > limit,
  };
}
