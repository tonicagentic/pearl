import { NextResponse } from "next/server";

import {
  createIssue,
  createResponsibility,
  ensureUserForPrincipal,
  findResponsibilityByName,
  flattenResponsibilityOptions,
  getIssue,
  listOpenIssues,
  listRecentlyResolvedIssues,
  listResponsibilities,
  reopenIssue,
  resolveIssue,
  updateIssue,
} from "@/lib/db/issues";
import { issueState, todayIso } from "@/lib/issues";
import { getSetupStatus } from "@/lib/setup";
import { getServerViewer } from "@/lib/session";

/**
 * Issues data for the mobile app: the same principal-scoped projection the
 * web inbox renders, as JSON. GET returns open issues (with derived state),
 * recently resolved ones, and the responsibility options; POST mutates with
 * an `op` field. Authenticated through the same better-auth session the web
 * app uses — the mobile client sends its session cookie.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateOrNull(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return typeof value === "string" && ISO_DATE.test(value) ? value : undefined;
}

export async function GET() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in with durable storage configured." }, { status: 401 });
  }

  // The local-dev/password principal has no user row yet; issue rows need
  // the foreign key satisfied.
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  const [openIssues, resolvedIssues, tree] = await Promise.all([
    listOpenIssues(viewer.id),
    listRecentlyResolvedIssues(
      viewer.id,
      new Date(Date.now() - 7 * 86_400_000).toISOString(),
    ),
    listResponsibilities(viewer.id),
  ]);

  return NextResponse.json({
    viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
    issues: [...openIssues, ...resolvedIssues].map((row) => ({
      ...row,
      state: issueState(row),
      dueSoon: row.status === "open" && row.dueDate !== null && row.dueDate <= todayIso(),
    })),
    options: flattenResponsibilityOptions(tree),
    tree,
  });
}

export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return NextResponse.json({ error: "Sign in with durable storage configured." }, { status: 401 });
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const op = body.op;

  try {
    if (op === "create") {
      const title = typeof body.title === "string" ? body.title.trim() : "";

      if (!title) {
        return NextResponse.json({ error: "An issue needs a title." }, { status: 400 });
      }

      const responsibilityName =
        typeof body.responsibilityName === "string" ? body.responsibilityName.trim() : "";

      if (!responsibilityName) {
        return NextResponse.json(
          { error: "An issue needs a responsibility to attach to." },
          { status: 400 },
        );
      }

      // Dates are optional: an absent field is null, not an error.
      const dueDate = isoDateOrNull(body.dueDate ?? null);
      const reviewDate = isoDateOrNull(body.reviewDate ?? null);

      if (dueDate === undefined || reviewDate === undefined) {
        return NextResponse.json({ error: "Dates must be YYYY-MM-DD." }, { status: 400 });
      }

      // The create_issue tool matches responsibilities by name and creates
      // unknown ones — keep the same behavior here so capture never dead-ends.
      const existing = await findResponsibilityByName(viewer.id, responsibilityName);
      const responsibility =
        existing ?? (await createResponsibility(viewer.id, responsibilityName));

      const issue = await createIssue(viewer.id, {
        title,
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
        responsibilityId: responsibility.id,
        dueDate,
        reviewDate,
      });

      return NextResponse.json({ issue: { ...issue, state: issueState(issue) } });
    }

    if (op === "resolve" || op === "reopen") {
      const id = typeof body.id === "string" ? body.id : "";

      if (!id || !(await getIssue(viewer.id, id))) {
        return NextResponse.json({ error: "Issue not found." }, { status: 404 });
      }

      if (op === "resolve") {
        await resolveIssue(viewer.id, id);
      } else {
        await reopenIssue(viewer.id, id);
      }

      const issue = await getIssue(viewer.id, id);

      return NextResponse.json({ issue: issue ? { ...issue, state: issueState(issue) } : null });
    }

    if (op === "update") {
      const id = typeof body.id === "string" ? body.id : "";

      if (!id || !(await getIssue(viewer.id, id))) {
        return NextResponse.json({ error: "Issue not found." }, { status: 404 });
      }

      // Absent date fields mean "leave unchanged"; present ones must be valid
      // dates or explicit nulls (clearing).
      const dueDate = body.dueDate === undefined ? undefined : isoDateOrNull(body.dueDate);
      const reviewDate =
        body.reviewDate === undefined ? undefined : isoDateOrNull(body.reviewDate);

      if (dueDate === undefined && body.dueDate !== undefined) {
        return NextResponse.json({ error: "Dates must be YYYY-MM-DD." }, { status: 400 });
      }

      if (reviewDate === undefined && body.reviewDate !== undefined) {
        return NextResponse.json({ error: "Dates must be YYYY-MM-DD." }, { status: 400 });
      }

      await updateIssue(viewer.id, id, {
        ...(typeof body.title === "string" && body.title.trim()
          ? { title: body.title.trim() }
          : {}),
        ...(body.description !== undefined
          ? {
              description:
                typeof body.description === "string" ? body.description.trim() || null : null,
            }
          : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(reviewDate !== undefined ? { reviewDate } : {}),
      });

      const issue = await getIssue(viewer.id, id);

      return NextResponse.json({ issue: issue ? { ...issue, state: issueState(issue) } : null });
    }

    return NextResponse.json({ error: `Unknown op: ${String(op)}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }
}
