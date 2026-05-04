import type { BudgetInvoice, BudgetSection } from "@/types";
import { computeSectionPaidTotal, computeSectionVariance } from "./totals";

// ============================================================
//  S15 — Plán vs. skutečnost: top N sekcí podle |variance|
// ============================================================

export interface ChartSectionDatum {
  sectionId: string;
  title: string;
  plannedCzk: number | null;
  actualCzk: number;
  variance: number;
  variancePercent: number | null;
  state: "under" | "at" | "over" | "no-plan";
}

/**
 * Vrátí top-N sekcí podle |variance|, sort desc. Sekce bez plánu ale
 * s reálnými výdaji jdou na konec (variance = 0 by je vyhodilo úplně).
 */
export function selectChartSections(
  sections: BudgetSection[],
  invoicesBySection: Record<string, BudgetInvoice[]>,
  _paymentsBySection?: unknown,
  topN = 5,
): ChartSectionDatum[] {
  void _paymentsBySection;
  const items: ChartSectionDatum[] = sections.map((s) => {
    const invs = invoicesBySection[s.id] ?? [];
    const v = computeSectionVariance(s, invs);
    return {
      sectionId: s.id,
      title: s.title,
      plannedCzk: v.plannedCzk,
      actualCzk: v.actualCzk,
      variance: v.variance,
      variancePercent: v.variancePercent,
      state: v.state,
    };
  });

  // Sort: nejdřív podle |variance| desc, sekce bez plánu (no-plan) až nakonec.
  items.sort((a, b) => {
    if (a.state === "no-plan" && b.state !== "no-plan") return 1;
    if (b.state === "no-plan" && a.state !== "no-plan") return -1;
    return Math.abs(b.variance) - Math.abs(a.variance);
  });

  return items.slice(0, topN);
}

// ============================================================
//  S17 — Donut struktury nákladů
// ============================================================

export interface DonutSlice {
  /** Section ID nebo "__other__" pro "Ostatní". */
  id: string;
  title: string;
  amountCzk: number;
  /** 0–100. */
  percent: number;
  /** Pořadí v paletě (0 = c1, 1 = c2 …). */
  colorIndex: number;
}

const COLOR_COUNT = 7;
const OTHER_ID = "__other__";

/**
 * Top-N sekcí podle paid total + "Ostatní" pokud > N.
 * Vstup: sections + invoices/payments by section.
 */
export function groupSectionsForDonut(
  sections: BudgetSection[],
  invoicesBySection: Record<string, BudgetInvoice[]>,
  _paymentsBySection?: unknown,
  topN = 5,
): {
  slices: DonutSlice[];
  totalCzk: number;
} {
  void _paymentsBySection;
  const sectionsWithTotal = sections
    .map((s) => {
      const invs = invoicesBySection[s.id] ?? [];
      return {
        id: s.id,
        title: s.title,
        amountCzk: computeSectionPaidTotal(invs),
      };
    })
    .filter((s) => s.amountCzk > 0)
    .sort((a, b) => b.amountCzk - a.amountCzk);

  const total = sectionsWithTotal.reduce((s, x) => s + x.amountCzk, 0);
  if (total === 0) return { slices: [], totalCzk: 0 };

  const top = sectionsWithTotal.slice(0, topN);
  const rest = sectionsWithTotal.slice(topN);
  const restTotal = rest.reduce((s, x) => s + x.amountCzk, 0);

  const slices: DonutSlice[] = top.map((s, i) => ({
    id: s.id,
    title: s.title,
    amountCzk: s.amountCzk,
    percent: (s.amountCzk / total) * 100,
    colorIndex: i % COLOR_COUNT,
  }));

  if (restTotal > 0) {
    slices.push({
      id: OTHER_ID,
      title: "Ostatní",
      amountCzk: restTotal,
      percent: (restTotal / total) * 100,
      colorIndex: COLOR_COUNT - 1, // c7 = stone-600
    });
  }

  return { slices, totalCzk: total };
}

/** Konstanta pro identifikaci "Ostatní" segmentu v consumer kódu. */
export const DONUT_OTHER_ID = OTHER_ID;
