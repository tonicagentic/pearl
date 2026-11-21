import { defineDynamic, defineInstructions } from "eve/instructions";

import { getCapabilityIndexForPrincipal } from "#lib/capabilities.js";

/**
 * Short index of the caller's active marketable capabilities. Full audience,
 * proof, and notes stay behind list_capabilities / save_capability.
 */
export default defineDynamic(async (ctx) => {
  const index = await ctx.memo(
    ["capability-index", ctx.session.auth.current?.principalId ?? null],
    async () => getCapabilityIndexForPrincipal(ctx.session.auth.current),
  );

  if (!index) return null;
  if (index.active.length === 0 && index.exploringCount === 0) return null;

  const lines: string[] = [
    "# Capabilities",
    "",
    "Marketable skills, products, and services this user can sell. Separate",
    "from freeform memory and from agent Skills (playbooks). Reuse their",
    "words. Call list_capabilities for full fields; save_capability when they",
    "state something new they can sell; archive_capability when they retire one.",
    "Never invent proof.",
    "",
  ];

  if (index.active.length > 0) {
    lines.push("## Active");
    lines.push("");
    for (const row of index.active) {
      lines.push(`- **${row.name}** (${row.kind}): ${row.summary}`);
    }
    lines.push("");
  }

  if (index.exploringCount > 0) {
    lines.push(
      `${String(index.exploringCount)} exploring — use list_capabilities with status exploring for details.`,
    );
  }

  return defineInstructions({
    content: lines.join("\n").trimEnd(),
    role: "system",
  });
});
