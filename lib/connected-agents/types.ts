/** Client-safe summary of a linked private eve agent. Never includes the bearer. */
export type ConnectedAgentSummary = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly lastVerifiedAt: string | null;
};
