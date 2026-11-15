import {
  buildApprovalCard,
  scrubSecrets,
} from "../workbench/approvals.ts";
import {
  classifyGitCommand,
  emptyShipGateState,
} from "../workbench/ship-gates.ts";

export type ApprovalBriefInput = {
  readonly toolName: string;
  /** Eve's request.prompt when present (custom or default `Approve …?`). */
  readonly prompt?: string | null;
  /** Tool call args for the action being approved. */
  readonly input?: Record<string, unknown> | null;
};

export type ApprovalBrief = {
  /** Short title shown above the Approve / Deny buttons. */
  readonly headline: string;
  /** Extra lines: command, branch, warnings, field list. */
  readonly detail?: string;
};

const DEFAULT_PROMPT_RE = /^Approve\s+.+\?\s*$/i;
const SECRET_KEY_RE =
  /^(?:password|secret|token|api[_-]?key|authorization|connection[_-]?string|database[_-]?url|value)$/i;
const SKIP_KEYS = new Set([
  "idempotencykey",
  "idempotency_key",
  "abortsignal",
]);
const MAX_VALUE_CHARS = 240;
const MAX_DETAIL_CHARS = 1_200;
const MAX_GENERIC_LINES = 12;

/** True when the prompt is eve's default one-liner and should be replaced. */
export function isDefaultApprovalPrompt(
  prompt: string | null | undefined,
): boolean {
  if (!prompt) return true;
  return DEFAULT_PROMPT_RE.test(prompt.trim());
}

/**
 * Build the headline + detail for an approval card from the tool name, optional
 * custom prompt, and call input. Never include tokens, env values, or URLs
 * that look like connection strings.
 */
export function buildApprovalBrief(
  input: ApprovalBriefInput,
): ApprovalBrief {
  const toolName = bareToolName(input.toolName);
  const args = input.input ?? null;
  const prompt = input.prompt?.trim() || null;

  if (prompt && !isDefaultApprovalPrompt(prompt)) {
    return splitCustomPrompt(prompt);
  }

  const ship = shipBrief(toolName, args);
  if (ship) return scrubBrief(ship);

  const generic = genericBrief(toolName, args);
  return scrubBrief(generic);
}

/** Single string for channels that only show `request.prompt`. */
export function formatApprovalPrompt(input: ApprovalBriefInput): string {
  const brief = buildApprovalBrief(input);
  if (!brief.detail) return brief.headline;
  return `${brief.headline}\n\n${brief.detail}`;
}

function scrubBrief(brief: ApprovalBrief): ApprovalBrief {
  return {
    headline: scrubSecrets(brief.headline),
    ...(brief.detail ? { detail: scrubSecrets(brief.detail) } : {}),
  };
}

/** First line is the title; the rest scrolls under the Approve / Deny buttons. */
function splitCustomPrompt(prompt: string): ApprovalBrief {
  const lines = prompt.split("\n");
  const first = lines[0]?.trim() || prompt.trim();
  const rest = lines.slice(1).join("\n").trim();
  return scrubBrief({
    headline: first,
    ...(rest ? { detail: rest } : {}),
  });
}

function bareToolName(toolName: string): string {
  const index = toolName.lastIndexOf("__");
  return index === -1 ? toolName : toolName.slice(index + 2);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const names = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return names.length > 0 ? names : null;
}

function shipBrief(
  toolName: string,
  args: Record<string, unknown> | null,
): ApprovalBrief | null {
  if (!args) return null;

  switch (toolName) {
    case "gated_git":
      return gatedGitBrief(args);
    case "deploy_vercel":
      return deployBrief(args);
    case "eas_update":
      return easUpdateBrief(args);
    case "eas_build":
      return easBuildBrief(args);
    case "eas_submit":
      return easSubmitBrief(args);
    case "merge_pr":
      return mergePrBrief(args);
    case "expo_simulator":
      return expoSimulatorBrief(args);
    case "run_with_env":
      return runWithEnvBrief(args);
    default:
      return null;
  }
}

function gatedGitBrief(args: Record<string, unknown>): ApprovalBrief {
  const command = asString(args.command) ?? "";
  const owner = asString(args.owner) ?? "owner";
  const repo = asString(args.repo) ?? "repo";
  const branch = asString(args.branch);
  const decision = classifyGitCommand(command, emptyShipGateState());
  const action =
    decision.needsApproval && decision.action === "draft_pr"
      ? "draft_pr"
      : "push";
  const card = buildApprovalCard({
    action,
    owner,
    repo,
    target: branch || "HEAD",
  });
  const lines: string[] = [];
  if (command) lines.push(command);
  if (branch) lines.push(`Branch: ${branch}`);
  if (decision.needsApproval) {
    lines.push(decision.reason);
  } else if (decision.reason === "already-approved-branch") {
    lines.push("Already approved for this branch in this task.");
  }
  if (card.warnsPhoneApi) {
    lines.push("This replaces the API the phone is using.");
  }
  return {
    headline: card.title,
    ...(lines.length > 0 ? { detail: lines.join("\n") } : {}),
  };
}

function deployBrief(args: Record<string, unknown>): ApprovalBrief {
  const owner = asString(args.owner) ?? "repo";
  const repo = asString(args.repo) ?? "checkout";
  const target =
    asString(args.target) === "production" ? "production" : "preview";
  const card = buildApprovalCard({
    action: target === "production" ? "production_deploy" : "preview_deploy",
    owner,
    repo,
    target,
  });
  const lines = [card.summary];
  const cwd = asString(args.workingDirectory);
  if (cwd) lines.push(`Working directory: ${cwd}`);
  return { headline: card.title, detail: lines.join("\n") };
}

function easUpdateBrief(args: Record<string, unknown>): ApprovalBrief {
  const owner = asString(args.owner) ?? "owner";
  const repo = asString(args.repo) ?? "repo";
  const channel = asString(args.channel) || "preview";
  const card = buildApprovalCard({
    action: "eas_update",
    owner,
    repo,
    target: channel,
    detail: asString(args.expoProjectId),
  });
  const lines = [card.summary];
  const message = asString(args.message);
  if (message) lines.push(`Message: ${truncate(message, MAX_VALUE_CHARS)}`);
  return { headline: card.title, detail: lines.join("\n") };
}

function easBuildBrief(args: Record<string, unknown>): ApprovalBrief {
  const profile = asString(args.profile) || "production";
  const cwd = asString(args.workingDirectory);
  const lines = [`EAS iOS build profile: ${profile}`];
  if (cwd) lines.push(`Working directory: ${cwd}`);
  return {
    headline: `Start EAS iOS build (${profile})?`,
    detail: lines.join("\n"),
  };
}

function easSubmitBrief(args: Record<string, unknown>): ApprovalBrief {
  const buildId = asString(args.buildId) ?? "unknown";
  const destination = asString(args.destination) || "testflight";
  return {
    headline: `Submit EAS build to ${destination}?`,
    detail: `Build id: ${buildId}\nDestination: ${destination}`,
  };
}

function mergePrBrief(args: Record<string, unknown>): ApprovalBrief {
  const owner = asString(args.owner) ?? "owner";
  const repo = asString(args.repo) ?? "repo";
  const pullNumber =
    typeof args.pullNumber === "number" && Number.isFinite(args.pullNumber)
      ? String(args.pullNumber)
      : asString(args.pullNumber);
  const title = asString(args.title);
  const card = buildApprovalCard({
    action: "squash_merge",
    owner,
    repo,
    target: pullNumber ? `#${pullNumber}` : "PR",
    detail: pullNumber,
  });
  const lines = [card.summary];
  if (title) lines.push(`Title: ${truncate(title, MAX_VALUE_CHARS)}`);
  return { headline: card.title, detail: lines.join("\n") };
}

function expoSimulatorBrief(args: Record<string, unknown>): ApprovalBrief {
  const owner = asString(args.owner) ?? "owner";
  const repo = asString(args.repo) ?? "repo";
  const expoProjectId = asString(args.expoProjectId);
  const sessionName = asString(args.sessionName);
  const buildId = asString(args.buildId);
  const card = buildApprovalCard({
    action: "simulator_start",
    owner,
    repo,
    target: expoProjectId || "Expo project",
    detail: sessionName,
  });
  const lines = [card.summary];
  if (expoProjectId) lines.push(`Expo project: ${expoProjectId}`);
  if (sessionName) lines.push(`Session: ${sessionName}`);
  if (buildId) lines.push(`Build: ${buildId}`);
  return { headline: card.title, detail: lines.join("\n") };
}

function runWithEnvBrief(args: Record<string, unknown>): ApprovalBrief {
  const command = asString(args.command) ?? "";
  const target = asString(args.target) || "preview";
  const names = asStringArray(args.names) ?? [];
  const lines: string[] = [];
  if (command) lines.push(command);
  lines.push(`Target: ${target}`);
  if (names.length > 0) {
    lines.push(`Env names: ${names.join(", ")}`);
  }
  lines.push("Values are never shown.");
  return {
    headline: `Run with ${target} env?`,
    detail: lines.join("\n"),
  };
}

function genericBrief(
  toolName: string,
  args: Record<string, unknown> | null,
): ApprovalBrief {
  const label = humanizeToolName(toolName);
  const headline = `Approve ${label}?`;
  if (!args) return { headline };

  const lines = fieldLines(args);
  if (lines.length === 0) return { headline };
  return {
    headline,
    detail: truncate(lines.join("\n"), MAX_DETAIL_CHARS),
  };
}

function fieldLines(args: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (lines.length >= MAX_GENERIC_LINES) break;
    if (SKIP_KEYS.has(key.toLowerCase())) continue;
    if (SECRET_KEY_RE.test(key)) continue;
    const rendered = renderFieldValue(value);
    if (rendered == null) continue;
    lines.push(`${key}: ${rendered}`);
  }
  return lines;
}

function renderFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return truncate(trimmed, MAX_VALUE_CHARS);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return truncate(value.map(String).join(", "), MAX_VALUE_CHARS);
    }
    return truncate(JSON.stringify(value), MAX_VALUE_CHARS);
  }
  if (typeof value === "object") {
    try {
      return truncate(JSON.stringify(value), MAX_VALUE_CHARS);
    } catch {
      return null;
    }
  }
  return null;
}

function humanizeToolName(toolName: string): string {
  const bare = bareToolName(toolName);
  const spaced = bare.replace(/[_-]+/g, " ").trim();
  if (!spaced) return toolName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}
