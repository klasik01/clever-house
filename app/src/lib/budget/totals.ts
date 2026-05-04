import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetSection,
  BudgetSettings,
} from "@/types";

/**
 * Sum castka přes PAID faktury v sekci. Po R3 jsou všechny výdaje (vč.
 * hotovostních / Hornbach drobností) už faktury — nepotřebujeme druhý parametr.
 * Druhý volitelný parametr ponechán pro back-compat tests, ale ignorován.
 */
export function computeSectionPaidTotal(
  invoices: BudgetInvoice[],
  _payments?: unknown,
): number {
  void _payments;
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

/** Sum napříč všemi sekcemi + drawdowns + settings. R3 odstranil payments. */
export function computeDashboardKpis(
  invoicesBySection: Record<string, BudgetInvoice[]>,
  drawdowns: BankDrawdown[] = [],
  settings?: BudgetSettings | null,
  _paymentsBySection?: unknown,
): DashboardKpis {
  void _paymentsBySection;
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


/** State odchylky proti plánu pro chip color coding. */
export type VarianceState = "under" | "at" | "over" | "no-plan";

export interface SectionVariance {
  /** Plán z `BudgetSection.expectedAmountCzk`. null pokud nenastaven. */
  plannedCzk: number | null;
  /** Skutečně zaplaceno (PAID faktury + payments). */
  actualCzk: number;
  /** Rozdíl skutečnost − plán. Kladné = nad plán, záporné = pod plán. */
  variance: number;
  /** Procentuální odchylka (variance / plan × 100). null pokud bez plánu. */
  variancePercent: number | null;
  /** Klasifikace pro UI. */
  state: VarianceState;
}

/** Práh pro "at plan" zaměnitelně s "v plánu" — ±5 % (per Discovery). */
const AT_PLAN_THRESHOLD_PERCENT = 5;

export function computeSectionVariance(
  section: Pick<BudgetSection, "expectedAmountCzk">,
  invoices: BudgetInvoice[],
  _payments?: unknown,
): SectionVariance {
  void _payments;
  const planned =
    Number.isFinite(section.expectedAmountCzk as number)
      ? Math.round(section.expectedAmountCzk as number)
      : null;
  const actual = computeSectionPaidTotal(invoices);

  if (planned === null) {
    return {
      plannedCzk: null,
      actualCzk: actual,
      variance: 0,
      variancePercent: null,
      state: "no-plan",
    };
  }

  const variance = actual - planned;
  const variancePercent = planned > 0 ? (variance / planned) * 100 : null;

  let state: VarianceState;
  if (variancePercent === null) {
    state = "no-plan";
  } else if (Math.abs(variancePercent) <= AT_PLAN_THRESHOLD_PERCENT) {
    state = "at";
  } else if (variance < 0) {
    state = "under";
  } else {
    state = "over";
  }

  return {
    plannedCzk: planned,
    actualCzk: actual,
    variance,
    variancePercent,
    state,
  };
}

export interface OverallVariance {
  /** Sum plánů přes sekce, které mají expected. */
  totalPlannedCzk: number;
  /** Sum actual přes všechny sekce (i ty bez plánu). */
  totalActualCzk: number;
  /** Rozdíl ze sekcí s plánem (sekce bez plánu se nezapočítávají do varianty). */
  variance: number;
  variancePercent: number | null;
  state: VarianceState;
  /** Kolik sekcí má plán. */
  plannedSectionsCount: number;
  /** Kolik sekcí celkem. */
  totalSectionsCount: number;
}

export function computeOverallVariance(
  sections: BudgetSection[],
  invoicesBySection: Record<string, BudgetInvoice[]>,
  _paymentsBySection?: unknown,
): OverallVariance {
  void _paymentsBySection;
  let totalPlanned = 0;
  let totalActual = 0;
  let variance = 0;
  let plannedCount = 0;
  for (const s of sections) {
    const invs = invoicesBySection[s.id] ?? [];
    const v = computeSectionVariance(s, invs);
    totalActual += v.actualCzk;
    if (v.plannedCzk !== null) {
      totalPlanned += v.plannedCzk;
      variance += v.variance;
      plannedCount += 1;
    }
  }

  const variancePercent =
    totalPlanned > 0 ? (variance / totalPlanned) * 100 : null;

  let state: VarianceState;
  if (variancePercent === null) {
    state = "no-plan";
  } else if (Math.abs(variancePercent) <= AT_PLAN_THRESHOLD_PERCENT) {
    state = "at";
  } else if (variance < 0) {
    state = "under";
  } else {
    state = "over";
  }

  return {
    totalPlannedCzk: totalPlanned,
    totalActualCzk: totalActual,
    variance,
    variancePercent,
    state,
    plannedSectionsCount: plannedCount,
    totalSectionsCount: sections.length,
  };
}
