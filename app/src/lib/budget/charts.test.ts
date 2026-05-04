import { describe, it, expect } from "vitest";
import {
  bucketByMonth,
  groupSectionsForDonut,
  selectChartSections,
  DONUT_OTHER_ID,
} from "./charts";
import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetPayment,
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

function pay(p: Partial<BudgetPayment>): BudgetPayment {
  return {
    id: p.id ?? "p1",
    sectionId: p.sectionId ?? "s1",
    castka: p.castka ?? 0,
    datum: p.datum ?? "2026-05-04",
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

  it("započítá payments do actualu", () => {
    const sections = [sec({ id: "s1", expectedAmountCzk: 100_000 })];
    const result = selectChartSections(
      sections,
      { s1: [inv({ status: "PAID", castka: 50_000 })] },
      { s1: [pay({ castka: 30_000 })] },
    );
    expect(result[0]?.actualCzk).toBe(80_000);
  });
});

describe("bucketByMonth", () => {
  const today = "2026-05-04";

  it("vytvoří 6 buckets ending today's month", () => {
    const buckets = bucketByMonth([], [], [], today, 6);
    expect(buckets.length).toBe(6);
    expect(buckets[0]?.key).toBe("2025-12");
    expect(buckets[5]?.key).toBe("2026-05");
  });

  it("přiřadí drawdown do správného měsíce", () => {
    const drawdowns = [
      dd({ datum: "2026-03-15", castka: 500_000 }),
      dd({ datum: "2026-05-01", castka: 1_000_000 }),
    ];
    const buckets = bucketByMonth(drawdowns, [], [], today, 6);
    expect(buckets.find((b) => b.key === "2026-03")?.drawnCzk).toBe(500_000);
    expect(buckets.find((b) => b.key === "2026-05")?.drawnCzk).toBe(1_000_000);
    // Cumulative
    expect(buckets[buckets.length - 1]?.cumulativeDrawnCzk).toBe(1_500_000);
  });

  it("paid invoices + payments se sčítají do paidCzk", () => {
    const invoices = [
      inv({ status: "PAID", castka: 50_000, datumPlatby: "2026-04-15" }),
    ];
    const payments = [pay({ castka: 30_000, datum: "2026-04-15" })];
    const buckets = bucketByMonth([], invoices, payments, today, 6);
    expect(buckets.find((b) => b.key === "2026-04")?.paidCzk).toBe(80_000);
  });

  it("ignoruje OPEN invoices", () => {
    const invoices = [
      inv({ status: "OPEN", castka: 50_000, splatnost: "2026-05-15" }),
    ];
    const buckets = bucketByMonth([], invoices, [], today, 6);
    expect(buckets.every((b) => b.paidCzk === 0)).toBe(true);
  });

  it("ignoruje data mimo window", () => {
    const drawdowns = [dd({ datum: "2025-01-15", castka: 500_000 })]; // > 6 mo zpátky
    const buckets = bucketByMonth(drawdowns, [], [], today, 6);
    expect(buckets.every((b) => b.drawnCzk === 0)).toBe(true);
  });

  it("cumulative se akumuluje napříč měsíci", () => {
    const drawdowns = [
      dd({ datum: "2026-01-15", castka: 100_000 }),
      dd({ datum: "2026-02-15", castka: 200_000 }),
      dd({ datum: "2026-03-15", castka: 300_000 }),
    ];
    const buckets = bucketByMonth(drawdowns, [], [], today, 6);
    const jan = buckets.find((b) => b.key === "2026-01")!;
    const feb = buckets.find((b) => b.key === "2026-02")!;
    const mar = buckets.find((b) => b.key === "2026-03")!;
    expect(jan.cumulativeDrawnCzk).toBe(100_000);
    expect(feb.cumulativeDrawnCzk).toBe(300_000);
    expect(mar.cumulativeDrawnCzk).toBe(600_000);
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

  it("payments se započtou", () => {
    const sections = [sec({ id: "s1" })];
    const result = groupSectionsForDonut(
      sections,
      { s1: [inv({ status: "PAID", castka: 100 })] },
      { s1: [pay({ castka: 50 })] },
    );
    expect(result.totalCzk).toBe(150);
    expect(result.slices[0]?.amountCzk).toBe(150);
  });
});
