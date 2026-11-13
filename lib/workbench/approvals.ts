import {
  isPearlRepo,
  type WorkbenchApprovalAction,
  type WorkbenchApprovalCard,
} from "./types.ts";

export type BuildApprovalCardInput = {
  readonly action: WorkbenchApprovalAction;
  readonly owner: string;
  readonly repo: string;
  readonly target: string;
  /** Optional PR number or env key for the card title. */
  readonly detail?: string | null;
};

/**
 * Build an approval card summary for workbench / coder shipping actions.
 * Never include tokens, env values, or connection strings.
 */
export function buildApprovalCard(
  input: BuildApprovalCardInput,
): WorkbenchApprovalCard {
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  const target = input.target.trim();
  const pearl = isPearlRepo(owner, repo);
  const warnsPhoneApi =
    pearl &&
    (input.action === "production_deploy" || input.action === "preview_deploy");
  const warnsInstalledApp =
    pearl &&
    (input.action === "eas_update" || input.action === "simulator_start");

  const title = titleFor(input.action, owner, repo, target, input.detail);
  const parts = [
    `${actionVerb(input.action)} ${owner}/${repo}`,
    `target: ${target}`,
  ];
  if (input.detail?.trim()) {
    parts.push(input.detail.trim());
  }
  if (warnsPhoneApi) {
    parts.push("This replaces the API the phone is using.");
  }
  if (warnsInstalledApp) {
    parts.push("This updates the Pearl app installed on the phone.");
  }

  return {
    action: input.action,
    owner,
    repo,
    target,
    title,
    warnsPhoneApi,
    warnsInstalledApp,
    summary: parts.join(" · "),
  };
}

function actionVerb(action: WorkbenchApprovalAction): string {
  switch (action) {
    case "push":
      return "Push to";
    case "draft_pr":
      return "Open draft PR on";
    case "preview_deploy":
      return "Preview-deploy";
    case "production_deploy":
      return "Production-deploy";
    case "simulator_start":
      return "Start Expo simulator for";
    case "eas_update":
      return "EAS Update for";
    case "squash_merge":
      return "Squash-merge PR on";
    case "env_write":
      return "Set env on";
    case "domain_add":
      return "Add domain on";
  }
}

function titleFor(
  action: WorkbenchApprovalAction,
  owner: string,
  repo: string,
  target: string,
  detail: string | null | undefined,
): string {
  const repoLabel = `${owner}/${repo}`;
  switch (action) {
    case "push":
      return `Push ${repoLabel} (${target})`;
    case "draft_pr":
      return `Draft PR ${repoLabel}`;
    case "preview_deploy":
      return `Preview deploy ${repoLabel}`;
    case "production_deploy":
      return `Production deploy ${repoLabel}`;
    case "simulator_start":
      return `Expo simulator ${repoLabel}`;
    case "eas_update":
      return `EAS Update ${repoLabel} → ${target}`;
    case "squash_merge":
      return `Merge ${repoLabel}${detail ? ` #${detail}` : ""}`;
    case "env_write":
      return `Set ${detail ?? "env"} on ${repoLabel} (${target})`;
    case "domain_add":
      return `Add domain ${detail ?? target} on ${repoLabel}`;
  }
}

/**
 * Production deploy and EAS Update must never share one approval.
 * Returns true when the pair is valid (two distinct actions).
 */
export function areShipApprovalsSeparate(
  a: WorkbenchApprovalAction,
  b: WorkbenchApprovalAction,
): boolean {
  const pair = new Set([a, b]);
  return (
    pair.has("production_deploy") &&
    pair.has("eas_update") &&
    a !== b
  );
}

/** Scrub accidental secrets from a string before it reaches a card or client. */
export function scrubSecrets(text: string): string {
  return text
    .replace(
      /(?:postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s"']+/gi,
      "[redacted-db-url]",
    )
    .replace(
      /\b(?:EXPO_TOKEN|VERCEL_TOKEN|GITHUB_TOKEN|DATABASE_URL|POSTGRES_URL)\s*=\s*[^\s"']+/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)\b/g,
      "[redacted-jwt]",
    )
    .replace(
      /\b(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/g,
      "[redacted-token]",
    );
}

/** True when a payload object looks like it leaked an env value or DB URL. */
export function payloadLeaksSecret(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    if (/postgres(?:ql)?:\/\//i.test(value)) return true;
    if (/^[A-Za-z_][A-Za-z0-9_]*=.+$/.test(value) && value.includes("=")) {
      // KEY=value pairs that are not just names.
      const [, rhs] = value.split("=", 2);
      if (rhs && rhs.length > 0 && !/^(production|preview|development)$/i.test(rhs)) {
        // Allow short enum-like values; treat long values as leaks in tests.
        if (rhs.length > 24) return true;
      }
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(payloadLeaksSecret);
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower === "value" ||
        lower === "secret" ||
        lower === "connectionstring" ||
        lower === "connection_string" ||
        lower === "databaseurl" ||
        lower === "database_url" ||
        lower === "password" ||
        lower === "token"
      ) {
        if (typeof child === "string" && child.length > 0) return true;
      }
      if (payloadLeaksSecret(child)) return true;
    }
  }
  return false;
}
