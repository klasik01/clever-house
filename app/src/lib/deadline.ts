/**
 * Deadline helpers for V3. Stored as epoch ms number (end-of-day local).
 * Three states drive visual escalation:
 *   ok       — > 2 days remaining
 *   soon     — 0..2 days remaining (inclusive)
 *   overdue  — past deadline
 */

export type DeadlineState = "ok" | "soon" | "overdue";

/** Convert YYYY-MM-DD input value to epoch ms of end-of-day in local tz. */
export function dateInputToEpochMs(input: string): number | null {
  if (!input) return null;
  const d = new Date(input + "T23:59:59");
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Convert epoch ms back to YYYY-MM-DD for the HTML date input (local tz). */
export function epochMsToDateInput(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compute deadline state relative to `now`.
 *  V6.1 tightened "soon" to ≤ 1 calendar day (due today or tomorrow) so the
 *  red warning doesn't fire too early. Anything further out is "ok". */
export function deadlineState(deadline: number | null | undefined, now = Date.now()): DeadlineState | null {
  if (deadline === null || deadline === undefined) return null;
  if (deadline < now) return "overdue";
  const msPerDay = 1000 * 60 * 60 * 24;
  // Compare at day granularity — a deadline set for 23:59 today and a deadline
  // set for tomorrow morning both read as "1 day away", which matches the UX
  // expectation that the red chip fires when the deadline is today or tomorrow.
  const startOfNow = new Date(now); startOfNow.setHours(0, 0, 0, 0);
  const startOfDeadline = new Date(deadline); startOfDeadline.setHours(0, 0, 0, 0);
  const daysRemaining = Math.round((startOfDeadline.getTime() - startOfNow.getTime()) / msPerDay);
  if (daysRemaining <= 1) return "soon";
  return "ok";
}

/**
 * Localizable countdown key + vars. Caller resolves via t().
 * Returns { key, vars? } for:
 *   - "deadline.pastDays" with n (positive int) when overdue for more than 0 days
 *   - "deadline.pastToday" when overdue but within same day
 *   - "deadline.today" when due today
 *   - "deadline.tomorrow" when due tomorrow
 *   - "deadline.inDays" with n when 2+ days ahead
 */
export function formatCountdownKey(
  deadline: number,
  now = Date.now()
): { key: string; vars?: { n: number } } {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOfNow = startOfLocalDay(now);
  const startOfDeadline = startOfLocalDay(deadline);
  const diffDays = Math.round((startOfDeadline - startOfNow) / msPerDay);

  if (diffDays < 0) {
    return { key: "deadline.pastDays", vars: { n: Math.abs(diffDays) } };
  }
  if (diffDays === 0) {
    return deadline < now
      ? { key: "deadline.pastToday" }
      : { key: "deadline.today" };
  }
  if (diffDays === 1) return { key: "deadline.tomorrow" };
  return { key: "deadline.inDays", vars: { n: diffDays } };
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
