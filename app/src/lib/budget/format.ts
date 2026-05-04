/** Formátuje částku v Kč (cs-CZ thousand separator, žádné desetinné). */
export function formatCzk(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 0,
  }).format(rounded);
  return `${formatted} Kč`;
}

/** Parsuje uživatelský vstup v Kč (tolerantní k mezerám / čárkám). */
export function parseCzk(input: string): number {
  if (!input) return NaN;
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return NaN;
  return Math.round(num);
}
