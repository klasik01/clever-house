// @deprecated R3 — Payment system removed.
export function useSectionPayments(_: string | undefined) {
  return { status: "ready" as const, payments: [] as never[] };
}
