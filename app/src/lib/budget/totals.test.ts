import { describe, it, expect } from "vitest";
import {
  computeSectionPaidTotal,
  computeSectionOpenTotal,
  computeDashboardKpis,
} from "./totals";
import type { BudgetInvoice } from "@/types";

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
  it("agreguje napříč sekcemi", () => {
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
    expect(computeDashboardKpis(data)).toEqual({
      paidTotalCzk: 80_000,
      openTotalCzk: 100_000,
    });
  });

  it("prázdná mapa → 0/0", () => {
    expect(computeDashboardKpis({})).toEqual({
      paidTotalCzk: 0,
      openTotalCzk: 0,
    });
  });

  it("jedna sekce bez faktur → 0/0", () => {
    expect(computeDashboardKpis({ s1: [] })).toEqual({
      paidTotalCzk: 0,
      openTotalCzk: 0,
    });
  });
});
