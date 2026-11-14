/** Shared mailbox summary shape for web and mobile Settings clients. */
export type MailboxClientSummary = {
  readonly id: string;
  readonly emailLabel: string | null;
  readonly nickname: string | null;
  readonly isLegacy: boolean;
  readonly status: "connected" | "not-connected" | "unavailable" | "unknown";
  readonly detail?: string;
  readonly canModify: boolean;
  readonly missingScopes?: readonly string[];
};
