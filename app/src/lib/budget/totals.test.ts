import { describe, it, expect } from "vitest";
import {
  computeSectionPaidTotal,
  computeSectionOpenTotal,
  computeDashboardKpis,
  computeMortgageStatus,
  computeSectionVariance,
  computeOverallVariance,
} from "./totals";
import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetPayment,
  BudgetSection,
  BudgetSettings,
} from "@/types";

function inv(partial: Partial<BudgetInvoice>): BudgetInvoice {
  return {
    id: partial.id ?? "i1",
    sectionId: partial.sectionId ?? "s1",
    castka: partial.castka ?? 0,
    status: partial.status ?? "OPEN",
    splatnost: partial.splatnost,
    datumPlatby: partial.datumPlatby,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function pay(partial: Partial<BudgetPayment>): BudgetPayment {
  return {
    id: partial.id ?? "p1",
    sectionId: partial.sectionId ?? "s1",
    castka: partial.castka ?? 0,
    datum: partial.datum ?? "2026-05-04",
    supplier: partial.supplier,
    note: partial.note,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function dd(partial: Partial<BankDrawdown>): BankDrawdown {
  return {
    id: partial.id ?? "d1",
    castka: partial.castka ?? 0,
    datum: partial.datum ?? "2026-05-01",
    banka: partial.banka,
    note: partial.note,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function sec(partial: Partial<BudgetSection>): BudgetSection {
  return {
    id: partial.id ?? "s1",
    title: partial.title ?? "Sekce",
    description: partial.description,
    expectedAmountCzk: partial.expectedAmountCzk,
    expectedHistory: partial.expectedHistory,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("computeSectionPaidTotal", () => {
  it("prázdný list → 0", () => {
    expect(computeSectionPaidTotal([])).toBe(0);
  });

  it("jen PAID faktury se sčítá", () => {
    const list = [
      inv({ castka: 50_000, status: "PAID" }),
      inv({ castka: 80_000, status: "OPEN", splatnost: "2026-06-01" }),
      inv({ castka: 20_000, status: "PAID" }),
    ];
    expect(computeSectionPaidTotal(list)).toBe(70_000);
  });

  it("S12 — payments se přičtou", () => {
    const invoices = [inv({ castka: 50_000, status: "PAID" })];
    const payments = [
      pay({ castka: 320 }),
      pay({ castka: 1_500 }),
    ];
    expect(computeSectionPaidTotal(invoices, payments)).toBe(51_820);
  });

  it("payments samotné", () => {
    expect(computeSectionPaidTotal([], [pay({ castka: 100 }), pay({ castka: 200 })])).toBe(300);
  });

  it("ignoruje invalid castka", () => {
    expect(computeSectionPaidTotal(
      [inv({ castka: 100, status: "PAID" }), inv({ castka: NaN, status: "PAID" })],
      [pay({ castka: NaN }), pay({ castka: 50 })],
    )).toBe(150);
  });
});

describe("computeSectionOpenTotal", () => {
  it("jen OPEN se sčítá", () => {
    const list = [
      inv({ castka: 50_000, status: "PAID" }),
      inv({ castka: 80_000, status: "OPEN" }),
      inv({ castka: 30_000, status: "OPEN" }),
    ];
    expect(computeSectionOpenTotal(list)).toBe(110_000);
  });
});

describe("computeDashboardKpis", () => {
  it("agreguje napříč sekcemi + drawdowns + settings + payments", () => {
    const data = {
      s1: [
        inv({ castka: 50_000, status: "PAID" }),
        inv({ castka: 80_000, status: "OPEN" }),
      ],
      s2: [inv({ castka: 30_000, status: "PAID" })],
    };
    const drawdowns = [dd({ castka: 1_500_000 })];
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      updatedAt: 0,
    };
    const paymentsBySection = {
      s1: [pay({ castka: 5_000 })],
      s2: [pay({ castka: 320 })],
    };
    expect(
      computeDashboardKpis(data, drawdowns, settings, paymentsBySection),
    ).toEqual({
      paidTotalCzk: 50_000 + 30_000 + 5_000 + 320,
      openTotalCzk: 80_000,
      drawnTotalCzk: 1_500_000,
      mortgageLimitCzk: 4_000_000,
    });
  });

  it("default args bez payments", () => {
    expect(computeDashboardKpis({})).toEqual({
      paidTotalCzk: 0,
      openTotalCzk: 0,
      drawnTotalCzk: 0,
      mortgageLimitCzk: null,
    });
  });
});

describe("computeMortgageStatus", () => {
  it("settings + drawdowns → správné percentage + remaining", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      updatedAt: 0,
    };
    const ds = [dd({ castka: 1_000_000 })];
    expect(computeMortgageStatus(settings, ds)).toEqual({
      limit: 4_000_000,
      drawn: 1_000_000,
      remaining: 3_000_000,
      percentage: 25,
      overLimit: false,
    });
  });

  it("over limit → overLimit true", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 1_000_000,
      updatedAt: 0,
    };
    expect(computeMortgageStatus(settings, [dd({ castka: 1_500_000 })]).overLimit).toBe(true);
  });

  it("bez settings → null limit", () => {
    expect(computeMortgageStatus(null, [dd({ castka: 100 })]).limit).toBe(null);
  });
});

describe("computeSectionVariance", () => {
  it("bez plánu → state = no-plan", () => {
    const s = sec({ expectedAmountCzk: null });
    expect(computeSectionVariance(s, [inv({ castka: 100, status: "PAID" })])).toMatchObject({
      plannedCzk: null,
      actualCzk: 100,
      state: "no-plan",
    });
  });

  it("realita = plan → state = at, variance = 0", () => {
    const s = sec({ expectedAmountCzk: 100_000 });
    const invs = [inv({ castka: 100_000, status: "PAID" })];
    const v = computeSectionVariance(s, invs);
    expect(v.plannedCzk).toBe(100_000);
    expect(v.actualCzk).toBe(100_000);
    expect(v.variance).toBe(0);
    expect(v.variancePercent).toBe(0);
    expect(v.state).toBe("at");
  });

  it("realita 95% planu → state = at (±5% threshold)", () => {
    const s = sec({ expectedAmountCzk: 100_000 });
    const invs = [inv({ castka: 95_000, status: "PAID" })];
    const v = computeSectionVariance(s, invs);
    expect(v.state).toBe("at");
    expect(v.variance).toBe(-5_000);
  });

  it("realita 80% planu → state = under", () => {
    const s = sec({ expectedAmountCzk: 100_000 });
    const invs = [inv({ castka: 80_000, status: "PAID" })];
    expect(computeSectionVariance(s, invs).state).toBe("under");
  });

  it("realita 150% planu → state = over", () => {
    const s = sec({ expectedAmountCzk: 100_000 });
    const invs = [inv({ castka: 150_000, status: "PAID" })];
    expect(computeSectionVariance(s, invs).state).toBe("over");
  });

  it("započítá payments do actual", () => {
    const s = sec({ expectedAmountCzk: 100_000 });
    const v = computeSectionVariance(s, [], [pay({ castka: 50_000 }), pay({ castka: 30_000 })]);
    expect(v.actualCzk).toBe(80_000);
    expect(v.state).toBe("under");
  });

  it("plan 0 → variancePercent null (no division by zero)", () => {
    const s = sec({ expectedAmountCzk: 0 });
    const v = computeSectionVariance(s, [inv({ castka: 100, status: "PAID" })]);
    expect(v.plannedCzk).toBe(0);
    expect(v.variance).toBe(100);
    expect(v.variancePercent).toBe(null);
    expect(v.state).toBe("no-plan");
  });
});

describe("computeOverallVariance", () => {
  it("agreguje napříč sekcemi, započítává jen ty s planem do variance", () => {
    const sections = [
      sec({ id: "s1", expectedAmountCzk: 100_000 }),
      sec({ id: "s2", expectedAmountCzk: 200_000 }),
      sec({ id: "s3", expectedAmountCzk: null }), // bez plánu
    ];
    const invoicesBy = {
      s1: [inv({ castka: 90_000, status: "PAID" })],
      s2: [inv({ castka: 250_000, status: "PAID" })],
      s3: [inv({ castka: 50_000, status: "PAID" })],
    };
    const v = computeOverallVariance(sections, invoicesBy);
    expect(v.totalPlannedCzk).toBe(300_000);
    expect(v.totalActualCzk).toBe(390_000);
    // Variance ze sekci s plánem: s1 (-10k) + s2 (+50k) = +40k
    expect(v.variance).toBe(40_000);
    expect(v.plannedSectionsCount).toBe(2);
    expect(v.totalSectionsCount).toBe(3);
    expect(v.state).toBe("over");
  });

  it("žádné sekce → state = no-plan", () => {
    const v = computeOverallVariance([], {});
    expect(v.state).toBe("no-plan");
    expect(v.totalActualCzk).toBe(0);
    expect(v.totalPlannedCzk).toBe(0);
  });

  it("všechny sekce bez plánu → no-plan", () => {
    const v = computeOverallVariance(
      [sec({ id: "s1", expectedAmountCzk: null })],
      { s1: [inv({ castka: 100, status: "PAID" })] },
    );
    expect(v.state).toBe("no-plan");
    expect(v.totalActualCzk).toBe(100);
    expect(v.totalPlannedCzk).toBe(0);
  });
});
