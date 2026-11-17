import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { listExpoAccountsAndProjects } from "@/lib/connections/expo-projects";

/**
 * Read-only catalog of the signed-in user's Expo accounts and projects.
 * Use before simulator_start / build_run / workflow_run to pick appId or
 * @owner/slug.
 */
export default defineTool({
  description:
    "List Expo accounts (personal + organizations) and projects for the " +
    "signed-in user. Returns ids, slugs, and @account/slug full names. Call " +
    "this before simulator_start, build_run, or workflow_run. Requires the " +
    "Expo connection under Profile → Coder → Expo.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    const catalog = await listExpoAccountsAndProjects({ userId: auth.userId });
    if (!catalog.connected) {
      return {
        status: "error",
        error: catalog.message,
        hint: "Connect Expo in Profile → Coder → Expo, then retry.",
      };
    }

    return {
      status: "ok",
      username: catalog.username,
      truncated: catalog.truncated,
      accounts: catalog.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        isPersonal: account.isPersonal,
      })),
      projects: catalog.projects.map((project) => ({
        appId: project.id,
        name: project.name,
        slug: project.slug,
        appFullName: project.fullName,
        accountName: project.accountName,
      })),
    };
  },
});
