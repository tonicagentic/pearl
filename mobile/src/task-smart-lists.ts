import type { IssueDto } from "./issues-client";

export const TASK_SMART_BUCKETS = [
  "inbox",
  "today",
  "upcoming",
  "anytime",
  "someday",
  "logbook",
] as const;

export type TaskSmartBucket = (typeof TASK_SMART_BUCKETS)[number];

export type TaskSmartListMeta = {
  readonly id: TaskSmartBucket;
  readonly label: string;
  /** Lucide-friendly glyph key used by the home rows. */
  readonly icon: "inbox" | "today" | "upcoming" | "anytime" | "someday" | "logbook";
};

export const TASK_SMART_LIST_META: readonly TaskSmartListMeta[] = [
  { id: "inbox", label: "Inbox", icon: "inbox" },
  { id: "today", label: "Today", icon: "today" },
  { id: "upcoming", label: "Upcoming", icon: "upcoming" },
  { id: "anytime", label: "Anytime", icon: "anytime" },
  { id: "someday", label: "Someday", icon: "someday" },
  { id: "logbook", label: "Logbook", icon: "logbook" },
];

export function isTaskSmartBucket(value: string): value is TaskSmartBucket {
  return (TASK_SMART_BUCKETS as readonly string[]).includes(value);
}

/** Today as YYYY-MM-DD in local calendar time. */
export function localTodayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Far-enough review date so create defaults keep Someday dormant
 * (`reviewDate > today`).
 */
export function somedayReviewDateIso(now: Date = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + 30);
  return localTodayIso(date);
}

export function issueInSmartBucket(
  issue: IssueDto,
  bucket: TaskSmartBucket,
  now: Date = new Date(),
): boolean {
  const today = localTodayIso(now);

  switch (bucket) {
    case "inbox":
      return (
        issue.status === "open" &&
        issue.state === "active" &&
        issue.dueDate === null &&
        issue.areaName === "Inbox"
      );
    case "today":
      return (
        issue.status === "open" &&
        issue.dueDate !== null &&
        issue.dueDate <= today
      );
    case "upcoming":
      return (
        issue.status === "open" &&
        issue.dueDate !== null &&
        issue.dueDate > today
      );
    case "anytime":
      return (
        issue.status === "open" &&
        issue.state === "active" &&
        issue.dueDate === null &&
        issue.areaName !== "Inbox"
      );
    case "someday":
      return issue.status === "open" && issue.state === "dormant";
    case "logbook":
      return issue.status === "resolved";
  }
}

export function issuesForSmartBucket(
  issues: readonly IssueDto[],
  bucket: TaskSmartBucket,
  now: Date = new Date(),
): IssueDto[] {
  return issues
    .filter((issue) => issueInSmartBucket(issue, bucket, now))
    .sort(compareIssuesForBucket(bucket));
}

export function smartListCounts(
  issues: readonly IssueDto[],
  now: Date = new Date(),
): Record<TaskSmartBucket, number> {
  const counts: Record<TaskSmartBucket, number> = {
    inbox: 0,
    today: 0,
    upcoming: 0,
    anytime: 0,
    someday: 0,
    logbook: 0,
  };
  for (const bucket of TASK_SMART_BUCKETS) {
    counts[bucket] = issuesForSmartBucket(issues, bucket, now).length;
  }
  return counts;
}

export function searchIssues(
  issues: readonly IssueDto[],
  query: string,
): IssueDto[] {
  const trimmed = query.replace(/\s+/g, " ").trim().toLowerCase();
  if (!trimmed) return [];
  return issues.filter((issue) => {
    const hay = `${issue.title}\n${issue.description ?? ""}`.toLowerCase();
    return hay.includes(trimmed);
  });
}

/** Defaults applied when creating from a given smart list. */
export function createDefaultsForBucket(
  bucket: TaskSmartBucket,
  now: Date = new Date(),
): {
  readonly areaName: string;
  readonly dueDate: string | null;
  readonly reviewDate: string | null;
} {
  switch (bucket) {
    case "today":
      return {
        areaName: "Inbox",
        dueDate: localTodayIso(now),
        reviewDate: null,
      };
    case "upcoming": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        areaName: "Inbox",
        dueDate: localTodayIso(tomorrow),
        reviewDate: null,
      };
    }
    case "someday":
      return {
        areaName: "Inbox",
        dueDate: null,
        reviewDate: somedayReviewDateIso(now),
      };
    case "anytime":
      // Undated active outside Inbox — seeded default area.
      return { areaName: "Home", dueDate: null, reviewDate: null };
    case "inbox":
    case "logbook":
    default:
      return { areaName: "Inbox", dueDate: null, reviewDate: null };
  }
}

function compareIssuesForBucket(
  bucket: TaskSmartBucket,
): (a: IssueDto, b: IssueDto) => number {
  if (bucket === "logbook") {
    return (a, b) =>
      (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt);
  }
  if (bucket === "today" || bucket === "upcoming") {
    return (a, b) =>
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
      b.createdAt.localeCompare(a.createdAt);
  }
  if (bucket === "someday") {
    return (a, b) =>
      (a.reviewDate ?? "9999-12-31").localeCompare(
        b.reviewDate ?? "9999-12-31",
      ) || b.createdAt.localeCompare(a.createdAt);
  }
  return (a, b) => b.createdAt.localeCompare(a.createdAt);
}
