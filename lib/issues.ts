// Derived issue lifecycle. An issue's status beyond open/resolved is never
// stored — it derives from the two calendar dates:
//
//   Captured → Dormant → Active → Resolved
//
//   resolved   — resolvedAt is set (done; leaves the inbox)
//   dormant    — open, and reviewDate is in the future (deliberately parked;
//                the system's contract is that it returns on that date)
//   active     — everything else: past its review date, past its due date,
//                due soon, or undated (undated open issues were captured
//                because they nag — they are active, not someday)
//
// Shared by the web UI and the agent's issue tools so both answer "what needs
// attention?" identically. See docs/issues-areas-plan.md.

export type IssueStatusRow = {
  readonly status: "open" | "resolved";
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
};

export type DerivedIssueState = "active" | "dormant" | "resolved";

/** Today as a calendar date (YYYY-MM-DD) in UTC — matching the `date` columns. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function issueState(
  issue: IssueStatusRow,
  now: Date = new Date(),
): DerivedIssueState {
  if (issue.status === "resolved") {
    return "resolved";
  }

  const today = todayIso(now);
  const reviewDate = issue.reviewDate;

  if (reviewDate !== null && reviewDate > today) {
    return "dormant";
  }

  return "active";
}

/** Days from today until the given calendar date (negative = overdue). */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const today = new Date(`${todayIso(now)}T00:00:00Z`).getTime();
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();

  return Math.round((target - today) / 86_400_000);
}

/** An issue counts as "due soon" when its due date is within this window. */
export const DUE_SOON_WINDOW_DAYS = 14;

export function isDueSoon(issue: IssueStatusRow, now: Date = new Date()): boolean {
  if (issue.status !== "open" || issue.dueDate === null) {
    return false;
  }

  return daysUntil(issue.dueDate, now) <= DUE_SOON_WINDOW_DAYS;
}
