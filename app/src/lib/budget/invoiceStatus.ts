import type { BudgetInvoice } from "@/types";

/**
 * Computed status faktury pro UI rozlišení.
 *
 * Stored status v Firestore je jen `OPEN | PAID`. UI navíc rozeznává
 * `OVERDUE` = `OPEN` + splatnost je v minulosti (ne dnes — dnes ještě
 * prošlo, mohu zaplatit do konce dne).
 *
 * `today` jako parametr (ISO date "YYYY-MM-DD") usnadňuje testy
 * a izoluje od `new Date()` side effectu.
 */
export type ComputedInvoiceStatus = "OPEN" | "PAID" | "OVERDUE";

export function getInvoiceStatus(
  invoice: { status: "OPEN" | "PAID"; splatnost?: string | null | undefined },
  todayIso: string,
): ComputedInvoiceStatus {
  if (invoice.status === "PAID") return "PAID";
  if (invoice.splatnost && invoice.splatnost < todayIso) return "OVERDUE";
  return "OPEN";
}

/** Filtr: vrátí jen faktury, které jsou aktuálně po splatnosti. */
export function getOverdueInvoices(
  invoices: BudgetInvoice[],
  todayIso: string,
): BudgetInvoice[] {
  return invoices.filter(
    (inv) => getInvoiceStatus(inv, todayIso) === "OVERDUE",
  );
}

/**
 * Filtr: faktury OPEN se splatností v rozmezí [today, today+7] inclusive.
 * Tj. "co musím zaplatit tento týden". Po splatnosti tu není (řeší se zvlášť).
 */
export function getThisWeekInvoices(
  invoices: BudgetInvoice[],
  todayIso: string,
): BudgetInvoice[] {
  const max = addDaysIso(todayIso, 7);
  return invoices.filter((inv) => {
    if (inv.status !== "OPEN") return false;
    if (!inv.splatnost) return false;
    return inv.splatnost >= todayIso && inv.splatnost <= max;
  });
}

/** Přidá N dní k ISO datumu (YYYY-MM-DD). UTC bezpečné. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Spočítá kolik dní je faktura po splatnosti (kladné = po splatnosti). */
export function daysOverdue(splatnostIso: string, todayIso: string): number {
  const a = new Date(splatnostIso + "T00:00:00Z").getTime();
  const b = new Date(todayIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
