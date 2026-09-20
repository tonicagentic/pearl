import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import { artifactMaterial, threadDoesNotRepeatArtifact } from "./file-assertions.ts";

// One technical draft, retargeted twice: executives care about cost, risk,
// and timeline; engineers care about mechanics and tradeoffs.
const TECHNICAL_DRAFT = `We're moving session storage from Redis to Postgres.

Redis has been fine operationally but we're paying for a cluster we barely use
— peak memory utilization is 8%, and we're the only team on it. Postgres
already runs our primary datastore with the backup and failover story we
need, so session rows would inherit that for free.

The migration is a read-through pattern: Postgres is the source of truth, we
keep a small in-process LRU in front to keep p99 latency acceptable. Sessions
are ~2KB each, 40k active sessions, so the table stays small.

Rollback is trivial: Redis is still running for two weeks after cutover, we
just flip the feature flag back. Worst case is we lose the "free" part and
keep paying for Redis.`;

export default defineEval({
  description:
    "Audience fit: retarget the same technical draft for executives, then for engineers, along the dimensions each audience actually needs.",
  tags: ["smoke"],
  async test(t) {
    const execTurn = await t.send(
      `Rewrite this for our executive staff meeting — they care about cost, risk, and timeline, not implementation detail:\n\n${TECHNICAL_DRAFT}`,
    );

    t.succeeded();
    t.calledTool("write_file");

    const execFileContent = artifactMaterial(execTurn);
    t.check(
      execFileContent.length,
      satisfies((length: number) => length > 100, "the executive version was written to a file artifact"),
    );
    t.check(
      threadDoesNotRepeatArtifact(execTurn, execFileContent),
      satisfies(Boolean, "the thread reply stays shorter than the artifact"),
    );

    t.judge.autoevals
      .closedQA(
        "The executive version foregrounds cost (paying for an underused Redis cluster, Postgres sessions are effectively free), risk (trivial rollback via feature flag, Redis kept running two weeks), and timeline (migration/cutover) — and drops or minimizes engineering mechanics like LRU caches, row sizes, and read-through patterns.",
        { on: execFileContent },
      )
      .atLeast(0.8);

    const engTurn = await t.send(
      "Now rewrite it again, this time for the platform engineering team's design review — they want the mechanics and tradeoffs.",
    );

    t.succeeded();
    t.calledTool("write_file");

    const engFileContent = artifactMaterial(engTurn);
    t.check(
      engFileContent.length,
      satisfies((length: number) => length > 100, "the engineer version was written to a file artifact"),
    );
    t.check(
      threadDoesNotRepeatArtifact(engTurn, engFileContent),
      satisfies(Boolean, "the thread reply stays shorter than the artifact"),
    );

    t.judge.autoevals
      .closedQA(
        "The engineer version keeps or sharpens the technical specifics: read-through pattern with Postgres as source of truth, in-process LRU for p99 latency, ~2KB sessions and 40k active sessions sizing, dual-write/flag-based rollback with Redis retained two weeks. It does not dumbed-down into only cost-and-risk language.",
        { on: engFileContent },
      )
      .atLeast(0.8);

    t.judge.autoevals
      .closedQA(
        "The two versions are meaningfully different — an executive and an engineer each got the version aimed at their concerns, not one rewrite lightly edited.",
        { on: `${execFileContent}\n\n---\n\n${engFileContent}` },
      )
      .atLeast(0.8);
  },
});
