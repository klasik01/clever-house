// @deprecated R3 — Payment system removed.
export function useAllPayments() {
  return { status: "ready" as const, paymentsBySectionId: {} as Record<string, never[]> };
}
