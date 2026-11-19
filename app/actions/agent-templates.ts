"use server";

import { revalidatePath } from "next/cache";

import { addAgentFromTemplate } from "@/lib/custom-agents/templates";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

export async function addAgentFromTemplateAction(input: {
  readonly slug: string;
}) {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup);
  if (!viewer || setup.storageMode !== "database") {
    throw new Error("Sign in with durable storage to add agents.");
  }
  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });
  const row = await addAgentFromTemplate(viewer.id, input.slug);
  revalidatePath("/agents");
  revalidatePath(`/agents/directory/${input.slug}`);
  return row;
}
