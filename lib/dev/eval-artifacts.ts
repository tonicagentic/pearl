import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type {
  EvalAssertion,
  EvalDetail,
  EvalRunSummary,
  EvalTurn,
  EvalVerdict,
} from "@/lib/dev/eval-types";

export type {
  EvalAssertion,
  EvalDetail,
  EvalRunSummary,
  EvalTurn,
  EvalVerdict,
} from "@/lib/dev/eval-types";
export { parseJudgeMessage } from "@/lib/dev/eval-types";

const EVALS_ROOT = path.join(process.cwd(), ".eve", "evals");

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function assertDevEvalsAccess(): void {
  if (!isDev()) {
    throw new Error("Eval artifacts are only available in development.");
  }
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function listEvalRuns(limit = 40): EvalRunSummary[] {
  assertDevEvalsAccess();
  if (!existsSync(EVALS_ROOT)) return [];

  const dirs = readdirSync(EVALS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = entry.name;
      const dir = path.join(EVALS_ROOT, id);
      const summaryPath = path.join(dir, "summary.json");
      const mtime = statSync(dir).mtimeMs;
      return { id, dir, summaryPath, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  return dirs.map(({ id, dir, summaryPath }) => {
    const summary = existsSync(summaryPath)
      ? safeReadJson<{
          startedAt?: string;
          completedAt?: string;
          passed?: number;
          failed?: number;
          scored?: number;
          skipped?: number;
          errored?: number;
          totalEvals?: number;
          evals?: Array<{
            id: string;
            verdict: EvalVerdict;
            status?: string;
            startedAt?: string;
            completedAt?: string;
          }>;
        }>(summaryPath)
      : null;

    if (summary) {
      return {
        id,
        startedAt: summary.startedAt,
        completedAt: summary.completedAt,
        passed: summary.passed ?? 0,
        failed: summary.failed ?? 0,
        scored: summary.scored ?? 0,
        skipped: summary.skipped ?? 0,
        errored: summary.errored ?? 0,
        totalEvals: summary.totalEvals ?? summary.evals?.length ?? 0,
        evals: (summary.evals ?? []).map((item) => ({
          id: item.id,
          verdict: item.verdict,
          status: item.status,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
        })),
      };
    }

    const evalsDir = path.join(dir, "evals");
    const found: EvalRunSummary["evals"] = [];
    if (existsSync(evalsDir)) {
      walkJsonFiles(evalsDir, (rel, full) => {
        const data = safeReadJson<{ id?: string; verdict?: EvalVerdict }>(full);
        if (!data) return;
        found.push({
          id: data.id ?? rel.replace(/\.json$/, ""),
          verdict: data.verdict ?? "scored",
        });
      });
    }
    const passed = found.filter((e) => e.verdict === "passed").length;
    const failed = found.filter((e) => e.verdict === "failed").length;
    const scored = found.filter((e) => e.verdict === "scored").length;
    return {
      id,
      passed,
      failed,
      scored,
      skipped: 0,
      errored: 0,
      totalEvals: found.length,
      evals: found,
    };
  });
}

function walkJsonFiles(
  root: string,
  visit: (relPath: string, fullPath: string) => void,
  prefix = "",
): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(full, visit, rel);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name === "summary.json") continue;
    visit(rel, full);
  }
}

type SessionEvent = {
  type?: string;
  data?: Record<string, unknown>;
  scope?: { turnId?: string };
};

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string") chunks.push(text);
  }
  return chunks.join("\n").trim();
}

function extractTurns(sessions: Record<string, unknown> | undefined): EvalTurn[] {
  if (!sessions) return [];
  const turns: EvalTurn[] = [];

  for (const [sessionKey, session] of Object.entries(sessions)) {
    if (!session || typeof session !== "object") continue;
    const events = (session as { events?: SessionEvent[] }).events;
    if (!Array.isArray(events)) continue;

    const byTurn = new Map<
      string,
      {
        user: string[];
        reply: string[];
        tools: Array<{ name: string; status?: string }>;
        skills: Set<string>;
      }
    >();

    const bucket = (turnId: string) => {
      let entry = byTurn.get(turnId);
      if (!entry) {
        entry = { user: [], reply: [], tools: [], skills: new Set() };
        byTurn.set(turnId, entry);
      }
      return entry;
    };

    for (const event of events) {
      const turnId =
        (typeof event.scope?.turnId === "string" && event.scope.turnId) ||
        (typeof event.data?.turnId === "string" && event.data.turnId) ||
        "turn_0";
      const entry = bucket(turnId);

      if (event.type === "delivery.consumed") {
        const text = textFromParts(event.data?.parts);
        if (text) entry.user.push(text);
      }
      if (
        event.type === "content.completed" &&
        event.data?.phase === "reply" &&
        typeof event.data.value === "string"
      ) {
        entry.reply.push(event.data.value);
      }
      if (event.type === "call.requested") {
        const capability = event.data?.capability as
          | { kind?: string; name?: string }
          | undefined;
        if (capability?.kind === "tool" && typeof capability.name === "string") {
          entry.tools.push({ name: capability.name });
        }
        if (capability?.kind === "skill" && typeof capability.name === "string") {
          entry.skills.add(capability.name);
        }
      }
      if (event.type === "call.settled") {
        const capability = event.data?.capability as
          | { kind?: string; name?: string }
          | undefined;
        const label = event.data?.label;
        if (
          capability?.kind === "skill" &&
          typeof capability.name === "string"
        ) {
          entry.skills.add(capability.name);
        } else if (
          typeof label === "string" &&
          label.startsWith("Loaded skill ")
        ) {
          entry.skills.add(label.replace(/^Loaded skill\s+/, ""));
        }
      }
    }

    const ordered = [...byTurn.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    for (const [turnId, entry] of ordered) {
      if (!entry.user.length && !entry.reply.length) continue;
      turns.push({
        turnId: `session_${sessionKey}/${turnId}`,
        userText: entry.user.join("\n\n"),
        replyText: entry.reply.join("\n\n"),
        tools: entry.tools,
        skills: [...entry.skills],
      });
    }
  }

  return turns;
}

export function loadEvalDetail(runId: string, evalId: string): EvalDetail | null {
  assertDevEvalsAccess();
  if (!runId || !evalId) return null;
  if (runId.includes("..") || evalId.includes("..")) return null;

  const filePath = path.join(EVALS_ROOT, runId, "evals", `${evalId}.json`);
  if (!existsSync(filePath)) return null;

  const raw = safeReadJson<{
    id?: string;
    verdict?: EvalVerdict;
    startedAt?: string;
    completedAt?: string;
    assertions?: EvalAssertion[];
    result?: {
      reply?: string;
      derived?: {
        toolCalls?: EvalDetail["toolCalls"];
        skillLoads?: Array<{ skill?: string; turnIndex?: number }>;
        usage?: unknown;
        models?: unknown;
      };
      sessions?: Record<string, unknown>;
    };
  }>(filePath);
  if (!raw) return null;

  const skillLoads = (raw.result?.derived?.skillLoads ?? [])
    .map((item) => ({
      skill: typeof item.skill === "string" ? item.skill : "",
      turnIndex: item.turnIndex,
    }))
    .filter((item) => item.skill.length > 0);

  return {
    id: raw.id ?? evalId,
    runId,
    verdict: raw.verdict ?? "scored",
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    assertions: raw.assertions ?? [],
    reply: typeof raw.result?.reply === "string" ? raw.result.reply : "",
    toolCalls: raw.result?.derived?.toolCalls ?? [],
    skillLoads,
    turns: extractTurns(raw.result?.sessions),
    usage: raw.result?.derived?.usage,
    models: raw.result?.derived?.models,
  };
}
