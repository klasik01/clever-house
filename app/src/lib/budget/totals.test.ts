import { describe, it, expect } from "vitest";
import {
  computeSectionPaidTotal,
  computeSectionOpenTotal,
  computeDashboardKpis,
  computeMortgageStatus,
} from "./totals";
import type { BankDrawdown, BudgetInvoice, BudgetSettings } from "@/types";

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

describe("computeSectionPaidTotal", () => {
  it("prázdný list → 0", () => {
    expect(computeSectionPaidTotal([])).toBe(0);
  });

  it("jen PAID se sčítá", () => {
    const list = [
      inv({ castka: 50_000, status: "PAID", datumPlatby: "2026-05-01" }),
      inv({ castka: 80_000, status: "OPEN", splatnost: "2026-06-01" }),
      inv({ castka: 20_000, status: "PAID", datumPlatby: "2026-05-02" }),
    ];
    expect(computeSectionPaidTotal(list)).toBe(70_000);
  });

  it("všechny OPEN → 0", () => {
    const list = [
      inv({ castka: 100, status: "OPEN", splatnost: "2026-06-01" }),
      inv({ castka: 200, status: "OPEN", splatnost: "2026-06-01" }),
    ];
    expect(computeSectionPaidTotal(list)).toBe(0);
  });

  it("ignoruje invalid castka (NaN, undefined)", () => {
    const list = [
      inv({ castka: 100, status: "PAID" }),
      inv({ castka: NaN, status: "PAID" }),
    ];
    expect(computeSectionPaidTotal(list)).toBe(100);
  });
});

describe("computeSectionOpenTotal", () => {
  it("prázdný list → 0", () => {
    expect(computeSectionOpenTotal([])).toBe(0);
  });

  it("jen OPEN se sčítá, PAID skip", () => {
    const list = [
      inv({ castka: 50_000, status: "PAID" }),
      inv({ castka: 80_000, status: "OPEN", splatnost: "2026-06-01" }),
      inv({ castka: 30_000, status: "OPEN", splatnost: "2026-06-15" }),
    ];
    expect(computeSectionOpenTotal(list)).toBe(110_000);
  });
});

describe("computeDashboardKpis", () => {
  it("agreguje napříč sekcemi + drawdowns + settings", () => {
    const data = {
      s1: [
        inv({ castka: 50_000, status: "PAID" }),
        inv({ castka: 80_000, status: "OPEN", splatnost: "2026-06-01" }),
      ],
      s2: [
        inv({ castka: 30_000, status: "PAID" }),
        inv({ castka: 20_000, status: "OPEN", splatnost: "2026-06-01" }),
      ],
    };
    const drawdowns = [
      dd({ castka: 500_000, datum: "2026-04-01" }),
      dd({ castka: 1_000_000, datum: "2026-05-01" }),
    ];
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      updatedAt: 0,
    };
    expect(computeDashboardKpis(data, drawdowns, settings)).toEqual({
      paidTotalCzk: 80_000,
      openTotalCzk: 100_000,
      drawnTotalCzk: 1_500_000,
      mortgageLimitCzk: 4_000_000,
    });
  });

  it("prázdná mapa + bez drawdowns + bez settings → 0/0/0/null", () => {
    expect(computeDashboardKpis({}, [], null)).toEqual({
      paidTotalCzk: 0,
      openTotalCzk: 0,
      drawnTotalCzk: 0,
      mortgageLimitCzk: null,
    });
  });

  it("default args (drawdowns + settings undefined)", () => {
    expect(computeDashboardKpis({})).toEqual({
      paidTotalCzk: 0,
      openTotalCzk: 0,
      drawnTotalCzk: 0,
      mortgageLimitCzk: null,
    });
  });
});

describe("computeMortgageStatus", () => {
  it("bez settings → limit null, drawn = sum, remaining null, overLimit false", () => {
    const ds = [dd({ castka: 100_000 }), dd({ castka: 50_000 })];
    expect(computeMortgageStatus(null, ds)).toEqual({
      limit: null,
      drawn: 150_000,
      remaining: null,
      percentage: null,
      overLimit: false,
    });
  });

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

  it("over limit → overLimit true, remaining negative", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 1_000_000,
      updatedAt: 0,
    };
    const ds = [dd({ castka: 1_500_000 })];
    expect(computeMortgageStatus(settings, ds)).toEqual({
      limit: 1_000_000,
      drawn: 1_500_000,
      remaining: -500_000,
      percentage: 150,
      overLimit: true,
    });
  });

  it("settings limit 0 → percentage 0 (no division by zero)", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 0,
      updatedAt: 0,
    };
    expect(computeMortgageStatus(settings, [dd({ castka: 100 })])).toEqual({
      limit: 0,
      drawn: 100,
      remaining: -100,
      percentage: 0,
      overLimit: true,
    });
  });

  it("žádné drawdowns + settings → 0 drawn, 100% remaining", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      updatedAt: 0,
    };
    expect(computeMortgageStatus(settings, [])).toEqual({
      limit: 4_000_000,
      drawn: 0,
      remaining: 4_000_000,
      percentage: 0,
      overLimit: false,
    });
  });

  it("undefined settings → null limit", () => {
    expect(computeMortgageStatus(undefined, [dd({ castka: 100 })])).toEqual({
      limit: null,
      drawn: 100,
      remaining: null,
      percentage: null,
      overLimit: false,
    });
  });

  it("ignoruje NaN castka v drawdownech", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 1_000_000,
      updatedAt: 0,
    };
    const ds = [dd({ castka: 100_000 }), dd({ castka: NaN })];
    expect(computeMortgageStatus(settings, ds).drawn).toBe(100_000);
  });
});
