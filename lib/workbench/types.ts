/** Pinned GitHub repo the phone workbench can manage. */
export type WorkbenchPinInput = {
  readonly owner: string;
  readonly name: string;
  readonly vercelProjectId?: string | null;
  readonly vercelTeamId?: string | null;
  readonly expoProjectId?: string | null;
  readonly expoUpdateChannel?: string | null;
};

export type WorkbenchPin = WorkbenchPinInput & {
  readonly id: string;
  readonly userId: string;
  readonly fullName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WorkbenchPullRequest = {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed" | "merged";
  readonly draft: boolean;
  readonly htmlUrl: string;
  readonly headRef: string;
  readonly baseRef: string;
};

export type WorkbenchDeployment = {
  readonly uid: string;
  readonly url: string;
  readonly state: string;
  readonly target: "production" | "preview" | "staging" | null;
  readonly createdAt: number | null;
};

export type WorkbenchDomain = {
  readonly name: string;
  readonly verified: boolean;
  readonly configured: boolean;
};

export type WorkbenchEnvName = {
  readonly id: string;
  readonly key: string;
  readonly target: readonly ("production" | "preview" | "development")[];
};

export type WorkbenchStorageItem = {
  readonly id: string;
  readonly kind: "blob" | "postgres" | "edge-config" | "other";
  readonly name: string;
  readonly status: string | null;
  readonly region: string | null;
};

export type WorkbenchDatabaseTable = {
  readonly schema: string;
  readonly name: string;
  readonly approximateRows: number | null;
};

export type WorkbenchDatabaseStatus = {
  readonly branch: string | null;
  readonly computeStatus: string | null;
  readonly storageBytes: number | null;
  readonly tables: readonly WorkbenchDatabaseTable[];
};

export type WorkbenchVercelUsage = {
  readonly teamId: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly bandwidthBytes: number | null;
  readonly functionInvocationCount: number | null;
  readonly buildMinutes: number | null;
  readonly storageBytes: number | null;
  readonly invoiceTotalCents: number | null;
};

export type WorkbenchPreview = {
  readonly kind: "dev-server" | "expo-simulator";
  readonly url: string;
  readonly label: string;
  readonly repoFullName: string | null;
};

export type WorkbenchApprovalAction =
  | "push"
  | "draft_pr"
  | "preview_deploy"
  | "production_deploy"
  | "simulator_start"
  | "eas_update"
  | "squash_merge"
  | "env_write"
  | "domain_add";

export type WorkbenchApprovalCard = {
  readonly action: WorkbenchApprovalAction;
  readonly owner: string;
  readonly repo: string;
  readonly target: string;
  readonly title: string;
  readonly warnsPhoneApi: boolean;
  readonly warnsInstalledApp: boolean;
  /** Never include tokens, env values, or connection strings. */
  readonly summary: string;
};

/** Pearl's own Expo project id from mobile/app.json. */
export const PEARL_EXPO_PROJECT_ID = "43ee6005-c5ac-4b8f-b463-5d910681956d";

/** Suggested pin for this codebase when the user has no pins yet. */
export const PEARL_SUGGESTED_PIN: WorkbenchPinInput = {
  owner: "alex",
  name: "my-agent",
  expoProjectId: PEARL_EXPO_PROJECT_ID,
  expoUpdateChannel: "preview",
};

export function parseOwnerName(
  fullName: string,
): { readonly owner: string; readonly name: string } | null {
  const trimmed = fullName.trim();
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(trimmed);
  if (!match) return null;
  return { owner: match[1]!, name: match[2]! };
}

export function fullNameOf(owner: string, name: string): string {
  return `${owner.trim()}/${name.trim()}`;
}

export function isPearlRepo(owner: string, name: string): boolean {
  const o = owner.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  return (
    (o === "alex" || o === "tonicagentic") &&
    (n === "my-agent" || n === "pearl")
  );
}
