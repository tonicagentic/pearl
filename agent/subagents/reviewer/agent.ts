import { defineAgent } from "eve";

import { DEFAULT_MODEL, WORKFLOW_BATCHING } from "../../agent.ts";

/**
 * Fresh-context reviewer subagent.
 *
 * @remarks
 * A declared subagent — its `subagents/reviewer/` location is what marks it as one — that the
 * root agent delegates to for a final, unbiased pass over a finished draft. It runs in its own
 * child session with no shared history and, like every declared subagent, inherits none of the
 * root's skills, connections, or tools. The root packs only the surface and the draft into
 * `message`; the reviewer loads the matching style rubric itself through its own
 * `get_surface_rubric` tool — a build-time bundle (`lib/rubric.generated.ts`, written by
 * `scripts/sync-shared.mjs`) of the house lists and each surface's best-practices and specs, so
 * no skills or sandbox are needed. That isolation is the point — a reviewer that never saw the
 * source or the drafting reasoning catches the voice drift, AI-tells, and spec misses that
 * self-review rationalizes away. It complements `lint_against_style` (a deterministic
 * banned-words floor) by judging the qualitative rubric a regex cannot.
 *
 * `description` is required for a subagent: the root reads it to decide when to delegate.
 * eve 1.0 subagents take no `outputSchema`; the result contract lives in `instructions.md`.
 *
 * @see The review rubric and verdict contract in this folder's `instructions.md`.
 */
export default defineAgent({
  // Same checkpoint batching as the root (docs: checkpoint-optimization-plan.md).
  experimental: WORKFLOW_BATCHING,
  description:
    "Full editorial review of a finished draft for a specific content surface (blog, x, " +
    "newsletter, release notes, linkedin): a fresh-context pass that diagnoses the idea, the " +
    "reader-state change, the argument and its structure, and prose — in that order — plus the " +
    "surface's style rubric (voice drift, AI-tells, plain English, format specs). When a draft " +
    "is finished and about to go to the writer, delegate here. The caller passes the surface " +
    "and the draft in the message; the reviewer loads the editorial-review skill and the " +
    "matching rubric itself and returns a structured verdict.",
  // Our OSS default (agent.ts DEFAULT_MODEL): the ZDR/US gateway routing policy in
  // agent/agent.ts applies to subagents too, and compliance for other providers is an
  // explicit decision, not a port default.
  model: process.env.AGENT_MODEL_OVERRIDE?.trim() || DEFAULT_MODEL,
});
