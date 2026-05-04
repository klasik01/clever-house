// @deprecated R4 — Quotes nahrazeny quotedAmountCzk na sekci.
export function useSectionQuotes(_: string | undefined) {
  return { status: "ready" as const, quotes: [] as never[] };
}
