import { randomUUID } from "node:crypto";

/** Seed a Pearl project for the local-dev eval principal. */
export async function seedPearlProject(opts?: {
  readonly name?: string;
  readonly instructions?: string;
}): Promise<{ readonly id: string; readonly name: string }> {
  const { ensureUserForPrincipal } = await import("../../lib/db/issues.ts");
  const { createProject } = await import("../../lib/db/projects.ts");

  const principalId = "local-dev";
  await ensureUserForPrincipal({
    principalId,
    attributes: { name: "Local Dev", email: "local-dev@eve.local" },
  });

  const name =
    opts?.name?.trim() || `Eval project ${randomUUID().slice(0, 8)}`;
  const row = await createProject(principalId, {
    name,
    instructions: opts?.instructions ?? "Eval project.",
  });
  return { id: row.id, name: row.name };
}
