import type { ConnectionStatus } from "./catalog";

export type GithubRepoGrant = {
  readonly fullName: string;
  readonly canPush: boolean;
  readonly blockedReason?: string;
};

export type GithubGrantDetails = {
  readonly login: string;
  readonly hasRepoScope: boolean;
  readonly orgs: readonly string[];
  readonly repos: readonly GithubRepoGrant[];
  /** GitHub page where the user grants org access to the OAuth app. */
  readonly manageUrl: string;
};

export type VercelGrantDetails = {
  readonly username: string;
  readonly teams: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
};

export type ConnectionGrantSummary = ConnectionStatus & {
  /** Scopes Pearl requests when authorizing this connection. */
  readonly requestedScopes: readonly string[];
  /** Scopes on the live token when the provider reports them. */
  readonly grantedScopes?: readonly string[];
  /** Requested scopes missing from the live grant. */
  readonly missingScopes?: readonly string[];
  readonly github?: GithubGrantDetails;
  readonly vercel?: VercelGrantDetails;
};
