/** Safe client summary for a linked iCloud Calendar account. */
export type IcloudCalendarAccountSummary = {
  readonly id: string;
  readonly appleId: string;
  readonly nickname: string | null;
  readonly status: "connected" | "unavailable" | "unknown";
  readonly detail?: string;
  readonly lastVerifiedAt: string | null;
};
