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
    case "merge_pr":
      return mergePrBrief(args);
    case "simulator_start":
      return simulatorStartBrief(args);
    case "simulator_stop":
      return simulatorStopBrief(args);
    case "build_run":
      return buildRunBrief(args);
    case "build_submit":
      return buildSubmitBrief(args);
    case "build_cancel":
      return buildCancelBrief(args);
    case "workflow_run":
      return workflowRunBrief(args);
    case "run_with_env":
      return runWithEnvBrief(args);
    case "create_goal":
      return createGoalBrief(args);
    case "update_goal":
      return updateGoalBrief(args);
    default:
      return null;
  }
}

function createGoalBrief(args: Record<string, unknown>): ApprovalBrief {
  const title = asString(args.title) ?? "Untitled goal";
  const lines: string[] = [];
  const notes = asString(args.notes);
  const targetDate = asString(args.targetDate);
  const projectName = asString(args.projectName);
  const projectId = asString(args.projectId);
  if (notes) lines.push(`Done looks like: ${truncate(notes, MAX_VALUE_CHARS)}`);
  if (targetDate) lines.push(`Target: ${targetDate}`);
  if (projectName) lines.push(`Project: ${projectName}`);
  else if (projectId) lines.push(`Project id: ${projectId}`);
  else lines.push("Standalone (no project)");
  return {
    headline: "Save this goal?",
    detail: [title, ...lines].join("\n"),
  };
}

function updateGoalBrief(args: Record<string, unknown>): ApprovalBrief {
  const status = asString(args.status);
  const title = asString(args.title);
  const goalId = asString(args.goalId) ?? "goal";
  if (status === "done") {
    return {
      headline: "Mark this goal done?",
      detail: title ?? goalId,
    };
  }
  const lines: string[] = [];
  if (title) lines.push(title);
  else lines.push(`id: ${goalId}`);
  if (status) lines.push(`Status: ${status}`);
  const notes = asString(args.notes);
  const targetDate = asString(args.targetDate);
  if (notes) lines.push(`Notes: ${truncate(notes, MAX_VALUE_CHARS)}`);
  if (targetDate) lines.push(`Target: ${targetDate}`);
  return {
    headline: "Update this goal?",
    detail: lines.join("\n"),
  };
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

function expoAppLabel(args: Record<string, unknown>): string {
  return (
    asString(args.appFullName) ||
    asString(args.appId) ||
    asString(args.expoProjectId) ||
    "Expo project"
  );
}

function simulatorStartBrief(args: Record<string, unknown>): ApprovalBrief {
  const app = expoAppLabel(args);
  const lines = [`Expo project: ${app}`];
  const platform = asString(args.platform);
  const buildId = asString(args.buildId);
  if (platform) lines.push(`Platform: ${platform}`);
  if (buildId) lines.push(`Build: ${buildId}`);
  return {
    headline: `Start Expo simulator (${app})?`,
    detail: lines.join("\n"),
  };
}

function simulatorStopBrief(args: Record<string, unknown>): ApprovalBrief {
  const sessionId =
    asString(args.simulatorSessionId) ||
    asString(args.sessionId) ||
    "session";
  return {
    headline: "Stop Expo simulator?",
    detail: `Session: ${sessionId}`,
  };
}

function buildRunBrief(args: Record<string, unknown>): ApprovalBrief {
  const app = expoAppLabel(args);
  const profile = asString(args.profile) || asString(args.buildProfile) || "production";
  const platform = asString(args.platform) || "ios";
  return {
    headline: `Start EAS ${platform} build (${profile})?`,
    detail: `Expo project: ${app}\nProfile: ${profile}\nPlatform: ${platform}`,
  };
}

function buildSubmitBrief(args: Record<string, unknown>): ApprovalBrief {
  const app = expoAppLabel(args);
  const buildId = asString(args.buildId) ?? "unknown";
  return {
    headline: "Submit EAS build to the store?",
    detail: `Expo project: ${app}\nBuild id: ${buildId}`,
  };
}

function buildCancelBrief(args: Record<string, unknown>): ApprovalBrief {
  const buildId = asString(args.buildId) ?? "unknown";
  return {
    headline: "Cancel EAS build?",
    detail: `Build id: ${buildId}`,
  };
}

function workflowRunBrief(args: Record<string, unknown>): ApprovalBrief {
  const app = expoAppLabel(args);
  const workflow =
    asString(args.workflowId) ||
    asString(args.fileName) ||
    asString(args.workflow) ||
    "workflow";
  const gitRef = asString(args.gitRef) || asString(args.ref);
  const lines = [`Expo project: ${app}`, `Workflow: ${workflow}`];
  if (gitRef) lines.push(`Git ref: ${gitRef}`);
  return {
    headline: `Run EAS workflow (${workflow})?`,
    detail: lines.join("\n"),
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
