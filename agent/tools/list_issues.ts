import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  ensureUserForPrincipal,
  listOpenIssues,
  listAreas,
} from "@/lib/db/issues";
import type { AreaNode } from "@/lib/db/issues";
import { issueState, todayIso } from "@/lib/issues";

/**
 * Tool that reports the user's unresolved areas ("open loops").
 *
 * @remarks
 * Rows are scoped to the framework-resolved principal (`ctx.session.auth.current`),
 * never to model input, so a session can only ever read its own issues. State
 * (active/dormant/resolved) is derived from the review/due dates, never stored;
 * dormant issues are deliberately parked and only appear when asked for.
 */
export default defineTool({
  description:
    "List the user's issues: unresolved areas that need attention, each attached " +
    "to an area of area. Defaults to active issues (past their review date, due " +
    "soon, overdue, or undated). Pass state \"dormant\" only to report deliberately parked " +
    "items (review date in the future). Use this to answer \"what needs my attention?\" — " +
    "not as a general to-do list.",
  /**
   * List issues for the current principal.
   *
   * @param input - Optional derived-state filter.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   */
  async execute(input, ctx) {
    const principal = ctx.session.auth.current;
    const userId =
      principal?.principalType === "user" ? principal.principalId : null;

    if (!principal || !userId) {
      return { error: "No signed-in user to list issues for.", issues: [] };
    }

    await ensureUserForPrincipal(principal);

    const [rows, tree] = await Promise.all([
      listOpenIssues(userId),
      listAreas(userId),
    ]);

    // Name every issue's area as a path ("Relationships › Family"),
    // so the model can answer with the life area without a second lookup.
    const pathById = new Map<string, string>();

    for (const node of tree) {
      for (const [id, path] of areaPaths(node)) {
        pathById.set(id, path);
      }
    }

    const today = todayIso();
    const issues = rows
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        area:
          pathById.get(row.areaId) ?? row.areaName,
        state: issueState(row),
        dueDate: row.dueDate,
        reviewDate: row.reviewDate,
        overdue: row.dueDate !== null && row.dueDate < today,
      }))
      .filter((issue) => input.state === undefined || issue.state === input.state)
      .sort((a, b) => {
        // Overdue first, then by attention date; dormant items sink.
        const rank = (issue: (typeof issues)[number]) =>
          issue.state === "dormant" ? 2 : issue.overdue ? 0 : 1;

        if (rank(a) !== rank(b)) {
          return rank(a) - rank(b);
        }

        return (a.dueDate ?? a.reviewDate ?? "9999-12-31") <
          (b.dueDate ?? b.reviewDate ?? "9999-12-31")
          ? -1
          : 1;
      });

    return { issues };
  },
  inputSchema: z.object({
    state: z.enum(["active", "dormant", "resolved"]).optional(),
  }),
  outputSchema: z.object({
    error: z.string().optional(),
    issues: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        area: z.string(),
        state: z.string(),
        dueDate: z.string().nullable(),
        reviewDate: z.string().nullable(),
        overdue: z.boolean(),
      }),
    ),
  }),
});

function* areaPaths(
  node: AreaNode,
  ancestors: readonly string[] = [],
): Generator<readonly [string, string]> {
  const path = [...ancestors, node.name].join(" › ");

  yield [node.id, path] as const;

  for (const child of node.children) {
    yield* areaPaths(child, [...ancestors, node.name]);
  }
}
