import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetSection,
} from "@/types";
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
//  S16 — Cumulative cashflow v čase
// ============================================================

export interface MonthBucket {
  /** ISO "YYYY-MM" identifikátor měsíce. */
  key: string;
  /** První den měsíce (YYYY-MM-01) — pro Date sort. */
  startIso: string;
  /** Lidský label pro X axis ("kvě 2026"). */
  label: string;
  /** Hodnota v měsíci (incremental). */
  drawnCzk: number;
  paidCzk: number;
}

export interface CumulativeBucket extends MonthBucket {
  cumulativeDrawnCzk: number;
  cumulativePaidCzk: number;
}

const CS_MONTH_SHORT: Record<string, string> = {
  "01": "led",
  "02": "úno",
  "03": "bře",
  "04": "dub",
  "05": "kvě",
  "06": "čvn",
  "07": "čvc",
  "08": "srp",
  "09": "zář",
  "10": "říj",
  "11": "lis",
  "12": "pro",
};

/**
 * Vytvoří měsíční buckety pro posledních N měsíců (včetně current).
 * Drawdowns + paid invoices + payments se přiřadí podle datum.
 * Vrací array s cumulative sumami od nejstaršího po nejnovější.
 */
export function bucketByMonth(
  drawdowns: BankDrawdown[],
  invoices: BudgetInvoice[],
  _payments: unknown[] | undefined,
  todayIso: string,
  monthsBack = 6,
): CumulativeBucket[] {
  void _payments;
  const buckets = new Map<string, MonthBucket>();
  // Pre-create N month buckets ending at today's month.
  const todayDate = new Date(todayIso + "T00:00:00Z");
  const startMonth = new Date(
    Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - (monthsBack - 1), 1),
  );

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(
      Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1),
    );
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yyyy}-${mm}`;
    buckets.set(key, {
      key,
      startIso: `${key}-01`,
      label: `${CS_MONTH_SHORT[mm]} ${String(yyyy).slice(2)}`,
      drawnCzk: 0,
      paidCzk: 0,
    });
  }

  function bumpBucket(
    iso: string | undefined,
    field: "drawnCzk" | "paidCzk",
    castka: number,
  ): void {
    if (!iso || !Number.isFinite(castka)) return;
    const key = iso.slice(0, 7);
    const b = buckets.get(key);
    if (b) {
      b[field] += castka;
    }
  }

  for (const d of drawdowns || []) {
    bumpBucket(d.datum, "drawnCzk", d.castka);
  }
  for (const i of invoices || []) {
    if (i.status === "PAID") {
      bumpBucket(i.datumPlatby, "paidCzk", i.castka);
    }
  }
  // Order chronologically + cumulative.
  const ordered = Array.from(buckets.values()).sort((a, b) =>
    a.startIso < b.startIso ? -1 : 1,
  );
  let cumDrawn = 0;
  let cumPaid = 0;
  return ordered.map((b) => {
    cumDrawn += b.drawnCzk;
    cumPaid += b.paidCzk;
    return {
      ...b,
      cumulativeDrawnCzk: cumDrawn,
      cumulativePaidCzk: cumPaid,
    };
  });
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
