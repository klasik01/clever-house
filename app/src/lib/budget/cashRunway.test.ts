import { describe, it, expect } from "vitest";
import {
  addDaysIso,
  computeCashRunway,
  daysBetween,
} from "./cashRunway";
import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetPayment,
  BudgetSettings,
} from "@/types";

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

describe("addDaysIso / daysBetween", () => {
  it("addDaysIso pozitivní + záporné", () => {
    expect(addDaysIso("2026-05-04", 7)).toBe("2026-05-11");
    expect(addDaysIso("2026-05-04", -90)).toBe("2026-02-03");
  });
  it("daysBetween", () => {
    expect(daysBetween("2026-05-01", "2026-05-04")).toBe(3);
    expect(daysBetween("2026-05-04", "2026-05-04")).toBe(0);
  });
});

describe("computeCashRunway", () => {
  const today = "2026-05-04";

  it("bez settings → no-data, months null", () => {
    const r = computeCashRunway(null, [], [], [], today);
    expect(r.months).toBe(null);
    expect(r.threshold).toBe("no-data");
  });

  it("bez balance → no-data", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      updatedAt: 0,
    };
    const r = computeCashRunway(settings, [], [], [], today);
    expect(r.months).toBe(null);
    expect(r.threshold).toBe("no-data");
  });

  it("balance ano + žádné platby v 90 dnech → no-data (nedost burn)", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 240_000,
      currentAccountBalanceUpdatedAt: today + "T10:00:00Z",
      updatedAt: 0,
    };
    const r = computeCashRunway(settings, [], [], [], today);
    expect(r.months).toBe(null);
    expect(r.threshold).toBe("no-data");
    expect(r.moneyAvailableCzk).toBe(240_000);
  });

  it("safe (>6 měsíců): balance 600k + burn 50k/měsíc → 12 měsíců", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 600_000,
      updatedAt: 0,
    };
    // 90 dní burn = 150 000 → /3 = 50 000/měsíc
    const payments = [
      pay({ castka: 50_000, datum: "2026-04-15" }),
      pay({ castka: 50_000, datum: "2026-03-15" }),
      pay({ castka: 50_000, datum: "2026-02-15" }),
    ];
    const r = computeCashRunway(settings, [], [], payments, today);
    expect(r.burnRate90dCzk).toBe(50_000);
    expect(r.moneyAvailableCzk).toBe(600_000);
    expect(r.months).toBe(12);
    expect(r.threshold).toBe("safe");
  });

  it("caution (3-6 měsíců)", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 200_000,
      updatedAt: 0,
    };
    const payments = [
      pay({ castka: 50_000, datum: "2026-04-15" }),
      pay({ castka: 50_000, datum: "2026-03-15" }),
      pay({ castka: 50_000, datum: "2026-02-15" }),
    ];
    const r = computeCashRunway(settings, [], [], payments, today);
    // 200k / 50k = 4 mo
    expect(r.months).toBe(4);
    expect(r.threshold).toBe("caution");
  });

  it("critical (< 3 měsíce)", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 100_000,
      updatedAt: 0,
    };
    const payments = [
      pay({ castka: 50_000, datum: "2026-04-15" }),
      pay({ castka: 50_000, datum: "2026-03-15" }),
      pay({ castka: 50_000, datum: "2026-02-15" }),
    ];
    const r = computeCashRunway(settings, [], [], payments, today);
    expect(r.months).toBe(2);
    expect(r.threshold).toBe("critical");
  });

  it("započítá zbývající hypotéku do moneyAvailable", () => {
    const settings: BudgetSettings = {
      mortgageApprovedAmountCzk: 4_000_000,
      currentAccountBalanceCzk: 200_000,
      updatedAt: 0,
    };
    const drawdowns = [dd({ castka: 1_000_000 })]; // zbývá 3M
    const payments = [pay({ castka: 50_000, datum: "2026-04-15" })];
    // burn = 50k / 3 = 16 666,67/mo → s moneyAvailable 3M+200k = 3.2M → 192 měsíců
    const r = computeCashRunway(settings, drawdowns, [], payments, today);
    expect(r.moneyAvailableCzk).toBe(3_200_000);
    expect(r.threshold).toBe("safe");
  });

  it("odečte open faktury od moneyAvailable", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 500_000,
      updatedAt: 0,
    };
    const invoices = [
      inv({ status: "OPEN", castka: 200_000, splatnost: "2026-06-01" }),
      inv({ status: "OPEN", castka: 100_000, splatnost: "2026-06-15" }),
    ];
    const payments = [pay({ castka: 30_000, datum: "2026-04-15" })];
    // moneyAvailable = 500k - 300k open = 200k
    const r = computeCashRunway(settings, [], invoices, payments, today);
    expect(r.moneyAvailableCzk).toBe(200_000);
    expect(r.burnRate90dCzk).toBe(10_000);
    expect(r.months).toBe(20);
  });

  it("paid invoices se započítají do burn rate", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 100_000,
      updatedAt: 0,
    };
    const invoices = [
      inv({ status: "PAID", castka: 60_000, datumPlatby: "2026-04-01" }),
      inv({ status: "PAID", castka: 60_000, datumPlatby: "2026-03-01" }),
      inv({ status: "PAID", castka: 60_000, datumPlatby: "2026-02-15" }),
    ];
    // 180k v 90 dnech / 3 = 60k/měsíc
    const r = computeCashRunway(settings, [], invoices, [], today);
    expect(r.burnRate90dCzk).toBe(60_000);
    expect(r.months).toBeCloseTo(100_000 / 60_000, 2);
  });

  it("ignoruje payments mimo 90-day window", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 100_000,
      updatedAt: 0,
    };
    const payments = [
      pay({ castka: 30_000, datum: "2025-12-01" }), // > 90 dní zpátky → out
      pay({ castka: 60_000, datum: "2026-04-15" }), // in
    ];
    const r = computeCashRunway(settings, [], [], payments, today);
    expect(r.burnRate90dCzk).toBe(20_000);
  });

  it("daysSinceLastUpdate spočítá od currentAccountBalanceUpdatedAt", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 100_000,
      currentAccountBalanceUpdatedAt: "2026-04-04T10:00:00Z",
      updatedAt: 0,
    };
    const r = computeCashRunway(settings, [], [], [], today);
    expect(r.daysSinceLastUpdate).toBe(30);
  });

  it("moneyAvailable < 0 → safe k 0", () => {
    const settings: BudgetSettings = {
      currentAccountBalanceCzk: 50_000,
      updatedAt: 0,
    };
    const invoices = [inv({ status: "OPEN", castka: 100_000 })];
    const payments = [pay({ castka: 30_000, datum: "2026-04-15" })];
    const r = computeCashRunway(settings, [], invoices, payments, today);
    expect(r.moneyAvailableCzk).toBe(0); // clamped
    expect(r.months).toBe(0);
    expect(r.threshold).toBe("critical");
  });
});
