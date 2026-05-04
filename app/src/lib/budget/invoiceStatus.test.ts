import { describe, it, expect } from "vitest";
import {
  getInvoiceStatus,
  getOverdueInvoices,
  getThisWeekInvoices,
  addDaysIso,
  daysOverdue,
} from "./invoiceStatus";
import type { BudgetInvoice } from "@/types";

function inv(partial: Partial<BudgetInvoice>): BudgetInvoice {
  return {
    id: partial.id ?? "i1",
    sectionId: partial.sectionId ?? "s1",
    castka: partial.castka ?? 1000,
    status: partial.status ?? "OPEN",
    splatnost: partial.splatnost,
    datumPlatby: partial.datumPlatby,
    createdBy: "u1",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("getInvoiceStatus", () => {
  const today = "2026-05-04";

  it("PAID faktura → PAID, splatnost nehraje roli", () => {
    expect(getInvoiceStatus({ status: "PAID", splatnost: "2026-01-01" }, today)).toBe("PAID");
    expect(getInvoiceStatus({ status: "PAID", splatnost: "2027-01-01" }, today)).toBe("PAID");
    expect(getInvoiceStatus({ status: "PAID" }, today)).toBe("PAID");
  });

  it("OPEN se splatností v budoucnosti → OPEN", () => {
    expect(getInvoiceStatus({ status: "OPEN", splatnost: "2026-06-01" }, today)).toBe("OPEN");
  });

  it("OPEN se splatností v minulosti → OVERDUE", () => {
    expect(getInvoiceStatus({ status: "OPEN", splatnost: "2026-05-03" }, today)).toBe("OVERDUE");
    expect(getInvoiceStatus({ status: "OPEN", splatnost: "2026-01-01" }, today)).toBe("OVERDUE");
  });

  it("OPEN se splatností dnes → OPEN (boundary, ne overdue)", () => {
    expect(getInvoiceStatus({ status: "OPEN", splatnost: "2026-05-04" }, today)).toBe("OPEN");
  });

  it("OPEN bez splatnosti → OPEN (legacy data před S05)", () => {
    expect(getInvoiceStatus({ status: "OPEN" }, today)).toBe("OPEN");
    expect(getInvoiceStatus({ status: "OPEN", splatnost: undefined }, today)).toBe("OPEN");
    expect(getInvoiceStatus({ status: "OPEN", splatnost: null as unknown as string }, today)).toBe("OPEN");
  });
});

describe("getOverdueInvoices", () => {
  const today = "2026-05-04";

  it("vrátí jen faktury, které jsou OVERDUE", () => {
    const list = [
      inv({ id: "a", status: "OPEN", splatnost: "2026-04-01" }), // overdue
      inv({ id: "b", status: "OPEN", splatnost: "2026-06-01" }), // future
      inv({ id: "c", status: "PAID", splatnost: "2026-01-01" }), // paid (skip)
      inv({ id: "d", status: "OPEN", splatnost: "2026-05-03" }), // overdue (yesterday)
    ];
    const result = getOverdueInvoices(list, today);
    expect(result.map((i) => i.id).sort()).toEqual(["a", "d"]);
  });

  it("prázdný list → prázdný výstup", () => {
    expect(getOverdueInvoices([], today)).toEqual([]);
  });
});

describe("getThisWeekInvoices", () => {
  const today = "2026-05-04";

  it("vrátí OPEN faktury se splatností v [today, today+7]", () => {
    const list = [
      inv({ id: "a", status: "OPEN", splatnost: "2026-05-04" }), // today (in)
      inv({ id: "b", status: "OPEN", splatnost: "2026-05-11" }), // today+7 (in)
      inv({ id: "c", status: "OPEN", splatnost: "2026-05-12" }), // today+8 (out)
      inv({ id: "d", status: "OPEN", splatnost: "2026-05-03" }), // overdue (out)
      inv({ id: "e", status: "PAID", splatnost: "2026-05-05" }), // paid (out)
      inv({ id: "f", status: "OPEN" }),                          // bez splatnosti (out)
    ];
    const result = getThisWeekInvoices(list, today);
    expect(result.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("prázdný list → prázdný výstup", () => {
    expect(getThisWeekInvoices([], today)).toEqual([]);
  });
});

describe("addDaysIso", () => {
  it("přidá dny správně přes hranici měsíce", () => {
    expect(addDaysIso("2026-05-30", 3)).toBe("2026-06-02");
  });
  it("přidá 7 dnů", () => {
    expect(addDaysIso("2026-05-04", 7)).toBe("2026-05-11");
  });
  it("0 dnů = stejný datum", () => {
    expect(addDaysIso("2026-05-04", 0)).toBe("2026-05-04");
  });
});

describe("daysOverdue", () => {
  it("vrací dny mezi splatností a dneškem", () => {
    expect(daysOverdue("2026-05-01", "2026-05-04")).toBe(3);
    expect(daysOverdue("2026-05-04", "2026-05-04")).toBe(0);
    expect(daysOverdue("2026-05-04", "2026-05-05")).toBe(1);
  });
  it("budoucí splatnost = záporné dny", () => {
    expect(daysOverdue("2026-06-01", "2026-05-04")).toBeLessThan(0);
  });
});
