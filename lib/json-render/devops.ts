/** Labels and tones for Vercel / GitHub / Neon answer cards. */

export type DeployState =
  | "ready"
  | "building"
  | "error"
  | "canceled"
  | "queued";

export type DeployEnvironment = "production" | "preview" | "development";

export type PrState = "open" | "merged" | "closed";

export type CheckState = "pending" | "pass" | "fail" | "neutral";

export type IssueState = "open" | "closed";

export type ComputeState = "idle" | "active";

export type StatusTone = "neutral" | "positive" | "negative" | "warning";

export function deployStateTone(state: string): StatusTone {
  switch (state) {
    case "ready":
      return "positive";
    case "building":
    case "queued":
      return "warning";
    case "error":
      return "negative";
    default:
      return "neutral";
  }
}

export function checkStateTone(checks: string | null | undefined): StatusTone {
  switch (checks) {
    case "pass":
      return "positive";
    case "fail":
      return "negative";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function prStateTone(state: string): StatusTone {
  switch (state) {
    case "merged":
      return "positive";
    case "closed":
      return "neutral";
    case "open":
      return "warning";
    default:
      return "neutral";
  }
}

export function computeStateTone(compute: string | null | undefined): StatusTone {
  return compute === "active" ? "positive" : "neutral";
}

/** Truncate long SQL for SlowQueryList display. */
export function truncateQuery(query: string, max = 120): string {
  const trimmed = query.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatPrRef(number: number): string {
  return `#${number}`;
}
