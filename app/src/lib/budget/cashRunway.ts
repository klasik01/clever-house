import type {
  BankDrawdown,
  BudgetInvoice,
  BudgetPayment,
  BudgetSettings,
} from "@/types";

/**
 * S14 — Cash runway: jak dlouho vystačíš s aktuálními penězi
 * proti běžnému tempu utrácení.
 *
 * Formule:
 *   moneyAvailable = (mortgageLimit - drawn) + currentAccountBalance - openInvoices
 *   burnRate90d    = sum(payments + paid invoices za posledních 90 dní) / 3
 *   runwayMonths   = moneyAvailable / burnRate90d
 *
 * Threshold:
 *   safe     > 6 mo
 *   caution  3–6 mo
 *   critical < 3 mo
 *
 * Edge cases:
 *   - bez settings (limit) → runway = balance/burn (bez hypotéky)
 *   - bez balance setting → null (nejde počítat)
 *   - bez plateb v 90 dnech → null (nedost dat)
 *   - moneyAvailable < 0 → 0
 */
export type RunwayThreshold = "safe" | "caution" | "critical" | "no-data";

export interface CashRunway {
  /** null = nedost vstupů. */
  months: number | null;
  threshold: RunwayThreshold;
  /** Volně použitelná částka. */
  moneyAvailableCzk: number;
  /** Měsíční burn rate. */
  burnRate90dCzk: number;
  /** Datum poslední aktualizace zůstatku. */
  lastBalanceUpdate: string | null;
  /** Kolik dní uplynulo od posledního updatu zůstatku (0 pokud dnes). */
  daysSinceLastUpdate: number | null;
}

const SAFE_MONTHS = 6;
const CAUTION_MONTHS = 3;

export function computeCashRunway(
  settings: BudgetSettings | null | undefined,
  drawdowns: BankDrawdown[],
  invoicesFlat: BudgetInvoice[],
  paymentsFlat: BudgetPayment[],
  todayIso: string,
): CashRunway {
  const balance =
    settings && Number.isFinite(settings.currentAccountBalanceCzk as number)
      ? Math.round(settings.currentAccountBalanceCzk as number)
      : null;
  const lastBalanceUpdate = settings?.currentAccountBalanceUpdatedAt ?? null;
  const daysSinceLastUpdate = lastBalanceUpdate
    ? daysBetween(lastBalanceUpdate.slice(0, 10), todayIso)
    : null;

  if (balance === null) {
    return {
      months: null,
      threshold: "no-data",
      moneyAvailableCzk: 0,
      burnRate90dCzk: 0,
      lastBalanceUpdate,
      daysSinceLastUpdate,
    };
  }

  // Mortgage available = limit - drawn (negative if over).
  const mortgageLimit =
    settings && Number.isFinite(settings.mortgageApprovedAmountCzk as number)
      ? Math.round(settings.mortgageApprovedAmountCzk as number)
      : 0;
  const drawn = (drawdowns || []).reduce(
    (s, d) => s + (Number.isFinite(d.castka) ? d.castka : 0),
    0,
  );
  const mortgageAvailable = Math.max(0, mortgageLimit - drawn);

  // Open invoices = obligations that drain future money.
  const openInvoicesTotal = (invoicesFlat || [])
    .filter((i) => i.status === "OPEN" && Number.isFinite(i.castka))
    .reduce((s, i) => s + i.castka, 0);

  const moneyAvailable = balance + mortgageAvailable - openInvoicesTotal;
  const moneyAvailableSafe = Math.max(0, moneyAvailable);

  // Burn rate: sum of paid invoices (by datumPlatby) + payments (by datum)
  // za posledních 90 dní → / 3.
  const cutoff90 = addDaysIso(todayIso, -90);
  const paidInvoicesIn90 = (invoicesFlat || [])
    .filter(
      (i) =>
        i.status === "PAID" &&
        Number.isFinite(i.castka) &&
        i.datumPlatby &&
        i.datumPlatby >= cutoff90 &&
        i.datumPlatby <= todayIso,
    )
    .reduce((s, i) => s + i.castka, 0);
  const paymentsIn90 = (paymentsFlat || [])
    .filter(
      (p) =>
        Number.isFinite(p.castka) &&
        p.datum &&
        p.datum >= cutoff90 &&
        p.datum <= todayIso,
    )
    .reduce((s, p) => s + p.castka, 0);
  const sum90 = paidInvoicesIn90 + paymentsIn90;
  const burnRate = sum90 > 0 ? sum90 / 3 : 0;

  if (burnRate === 0) {
    return {
      months: null,
      threshold: "no-data",
      moneyAvailableCzk: moneyAvailableSafe,
      burnRate90dCzk: 0,
      lastBalanceUpdate,
      daysSinceLastUpdate,
    };
  }

  const months = moneyAvailableSafe / burnRate;
  let threshold: RunwayThreshold;
  if (months >= SAFE_MONTHS) threshold = "safe";
  else if (months >= CAUTION_MONTHS) threshold = "caution";
  else threshold = "critical";

  return {
    months,
    threshold,
    moneyAvailableCzk: moneyAvailableSafe,
    burnRate90dCzk: burnRate,
    lastBalanceUpdate,
    daysSinceLastUpdate,
  };
}

/** Přidá N dní (i záporné) k ISO datumu. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dny mezi dvěma ISO daty (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00Z").getTime();
  const b = new Date(bIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** "Peníze vystačí do měsíce X" — vrátí měsíc + rok. */
export function runwayUntilLabel(
  months: number,
  todayIso: string,
): string {
  const d = new Date(todayIso + "T00:00:00Z");
  const totalDays = Math.round(months * 30);
  d.setUTCDate(d.getUTCDate() + totalDays);
  return d.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
}
