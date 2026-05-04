// @deprecated R2 — Account system removed.
export function useBudgetAccounts() {
  return { status: "ready" as const, accounts: [] as never[] };
}
