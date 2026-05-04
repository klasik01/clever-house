import { describe, it, expect } from "vitest";
import {
  groupSectionsForDonut,
  selectChartSections,
  DONUT_OTHER_ID,
} from "./charts";
import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetSection,
} from "@/types";

function sec(p: Partial<BudgetSection>): BudgetSection {
  return {
    id: p.id ?? "s1",
    title: p.title ?? "Sekce",
    expectedAmountCzk: p.expectedAmountCzk,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function inv(p: Partial<BudgetInvoice>): BudgetInvoice {
  return {
    id: p.id ?? "i1",
    sectionId: p.sectionId ?? "s1",
    castka: p.castka ?? 0,
    status: p.status ?? "OPEN",
    splatnost: p.splatnost,
    datumPlatby: p.datumPlatby,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

function dd(p: Partial<BankDrawdown>): BankDrawdown {
  return {
    id: p.id ?? "d1",
    castka: p.castka ?? 0,
    datum: p.datum ?? "2026-04-01",
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("selectChartSections", () => {
  it("seřadí podle |variance| desc, top N", () => {
    const sections = [
      sec({ id: "s1", title: "OKNA", expectedAmountCzk: 100_000 }),
      sec({ id: "s2", title: "Elektro", expectedAmountCzk: 200_000 }),
      sec({ id: "s3", title: "Hrubá", expectedAmountCzk: 5_000_000 }),
      sec({ id: "s4", title: "Sklep", expectedAmountCzk: 50_000 }),
    ];
    const inv_by = {
      s1: [inv({ status: "PAID", castka: 90_000 })], // -10k
      s2: [inv({ status: "PAID", castka: 250_000 })], // +50k
      s3: [inv({ status: "PAID", castka: 4_500_000 })], // -500k
      s4: [inv({ status: "PAID", castka: 60_000 })], // +10k
    };
    const result = selectChartSections(sections, inv_by, {}, 3);
    expect(result.map((s) => s.sectionId)).toEqual(["s3", "s2", "s1"]);
  });

  it("sekce bez plánu jdou na konec", () => {
    const sections = [
      sec({ id: "s1", title: "OKNA", expectedAmountCzk: 100_000 }),
      sec({ id: "s2", title: "BezPlanu", expectedAmountCzk: null }),
      sec({ id: "s3", title: "Elektro", expectedAmountCzk: 200_000 }),
    ];
    const inv_by = {
      s1: [inv({ status: "PAID", castka: 90_000 })],
      s2: [inv({ status: "PAID", castka: 1_000_000 })],
      s3: [inv({ status: "PAID", castka: 250_000 })],
    };
    const result = selectChartSections(sections, inv_by, {}, 3);
    expect(result.map((s) => s.sectionId)).toEqual(["s3", "s1", "s2"]);
  });

  it("prázdné sections → prázdný výstup", () => {
    expect(selectChartSections([], {})).toEqual([]);
  });

});

describe("groupSectionsForDonut", () => {
  it("top 5 + 'Ostatní' pro zbytek", () => {
    const sections = Array.from({ length: 8 }, (_, i) =>
      sec({ id: `s${i + 1}`, title: `Sekce ${i + 1}` }),
    );
    const inv_by: Record<string, BudgetInvoice[]> = {};
    sections.forEach((s, i) => {
      inv_by[s.id] = [inv({ status: "PAID", castka: (8 - i) * 10_000 })];
    });
    const { slices, totalCzk } = groupSectionsForDonut(sections, inv_by, {}, 5);
    expect(slices.length).toBe(6); // 5 + "Ostatní"
    expect(slices[5]?.id).toBe(DONUT_OTHER_ID);
    expect(slices[5]?.title).toBe("Ostatní");
    // Top section (s1, 80k) má největší %.
    expect(slices[0]?.id).toBe("s1");
    expect(slices[0]?.amountCzk).toBe(80_000);
    expect(totalCzk).toBe(360_000);
  });

  it("≤5 sekcí → bez 'Ostatní'", () => {
    const sections = [
      sec({ id: "s1" }),
      sec({ id: "s2" }),
    ];
    const inv_by = {
      s1: [inv({ status: "PAID", castka: 100_000 })],
      s2: [inv({ status: "PAID", castka: 50_000 })],
    };
    const { slices } = groupSectionsForDonut(sections, inv_by);
    expect(slices.length).toBe(2);
  });

  it("vyhodí sekce s 0 paid", () => {
    const sections = [sec({ id: "s1" }), sec({ id: "s2" })];
    const inv_by = {
      s1: [inv({ status: "PAID", castka: 100_000 })],
      s2: [inv({ status: "OPEN", castka: 200_000 })], // OPEN nesčítá
    };
    const { slices } = groupSectionsForDonut(sections, inv_by);
    expect(slices.length).toBe(1);
    expect(slices[0]?.id).toBe("s1");
  });

  it("prázdné → prázdný donut", () => {
    expect(groupSectionsForDonut([], {})).toEqual({ slices: [], totalCzk: 0 });
  });

  it("percent součet ~100", () => {
    const sections = [
      sec({ id: "s1" }),
      sec({ id: "s2" }),
      sec({ id: "s3" }),
    ];
    const inv_by = {
      s1: [inv({ status: "PAID", castka: 50_000 })],
      s2: [inv({ status: "PAID", castka: 30_000 })],
      s3: [inv({ status: "PAID", castka: 20_000 })],
    };
    const { slices } = groupSectionsForDonut(sections, inv_by);
    const total = slices.reduce((s, x) => s + x.percent, 0);
    expect(Math.round(total)).toBe(100);
  });


});
