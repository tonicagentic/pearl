/**
 * Client-safe agent ids for Spec / Runs filtering.
 * Keep in sync with SUBAGENT_META in eval-catalog.ts (server).
 */

export const SUBAGENT_EVAL_ROOTS = new Set([
  "coder",
  "designer",
  "list-builder",
  "mail",
  "researcher",
  "reviewer",
  "editor",
  "updates",
]);

export function isSubagentEvalRoot(id: string): boolean {
  return SUBAGENT_EVAL_ROOTS.has(id);
}

/** Map a suite id (`coder`, `coder/build-software`, `coder/vercel`, …) to its Spec agent. */
export function agentIdForSuite(suiteId: string): string {
  const top = suiteId.split("/")[0] ?? suiteId;
  if (isSubagentEvalRoot(top)) return top;
  return "pearl";
}

/**
 * Suite id + display name from an eval relative path.
 * Under a subagent root, nested folders become separate suites:
 * `coder/vercel/preview.eval.ts` → suite `coder/vercel`, name `preview`.
 */
export function suiteFromEvalRelPath(relPath: string): {
  id: string;
  suite: string;
  name: string;
} {
  const id = relPath.replace(/\.eval\.ts$/, "");
  const parts = id.split("/");
  const top = parts[0]!;
  if (parts.length >= 3 && isSubagentEvalRoot(top)) {
    return {
      id,
      suite: `${parts[0]}/${parts[1]}`,
      name: parts.slice(2).join("/"),
    };
  }
  if (parts.length === 1) {
    return { id, suite: id, name: id };
  }
  return { id, suite: top, name: parts.slice(1).join("/") };
}
