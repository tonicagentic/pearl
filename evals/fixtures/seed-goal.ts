/** Seed a project goal for the local-dev eval principal. */

const EVAL_PRINCIPAL = "local-dev";

/** Wipe prior eval goals so list/mark judges aren't drowned in duplicates. */
export async function clearPearlGoalsForEval(): Promise<void> {
  const { ensureUserForPrincipal } = await import("../../lib/db/issues.ts");
  const { listAllGoals, deleteGoal } = await import(
    "../../lib/db/project-goals.ts"
  );

  await ensureUserForPrincipal({
    principalId: EVAL_PRINCIPAL,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const existing = await listAllGoals(EVAL_PRINCIPAL);
  for (const goal of existing) {
    await deleteGoal(EVAL_PRINCIPAL, goal.id);
  }
}

export async function seedPearlGoal(opts: {
  readonly title: string;
  readonly projectId?: string | null;
  readonly status?: "active" | "done";
  readonly targetDate?: string | null;
  readonly notes?: string | null;
}): Promise<{
  readonly id: string;
  readonly title: string;
  readonly status: "active" | "done";
  readonly projectId: string | null;
}> {
  const { ensureUserForPrincipal } = await import("../../lib/db/issues.ts");
  const { createGoal, updateGoal } = await import(
    "../../lib/db/project-goals.ts"
  );

  const principalId = EVAL_PRINCIPAL;
  await ensureUserForPrincipal({
    principalId,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const created = await createGoal(principalId, {
    title: opts.title,
    projectId: opts.projectId ?? null,
    targetDate: opts.targetDate ?? null,
    notes: opts.notes ?? null,
  });

  if (opts.status === "done") {
    const updated = await updateGoal(principalId, created.id, {
      status: "done",
    });
    if (!updated) throw new Error("Failed to mark seeded goal done.");
    return {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      projectId: updated.projectId,
    };
  }

  return {
    id: created.id,
    title: created.title,
    status: created.status,
    projectId: created.projectId,
  };
}
