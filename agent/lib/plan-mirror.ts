import { put } from "@vercel/blob";

import { contentTypeForWorkspacePath } from "@/agent/lib/design-files";
import {
  artifactsPrefix,
  normalizeArtifactSlug,
} from "@/agent/lib/artifacts";

/**
 * Sandbox path for the durable markdown mirror of a project plan.
 * Unique per project+slug (`idx_plan_project_slug`).
 */
export function planMirrorPath(projectId: string, slug: string): string {
  return `/workspace/docs/plans/${projectId}/${slug}.md`;
}

/** Relative artifact slug (no `/workspace/` prefix) for Blob storage. */
export function planMirrorSlug(projectId: string, slug: string): string {
  return `docs/plans/${projectId}/${slug}.md`;
}

function mirrorBody(input: {
  readonly title: string;
  readonly projectId: string;
  readonly slug: string;
  readonly planId: string;
  readonly markdown: string;
}): string {
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(input.title)}`,
    `projectId: ${JSON.stringify(input.projectId)}`,
    `slug: ${JSON.stringify(input.slug)}`,
    `planId: ${JSON.stringify(input.planId)}`,
    "---",
    "",
  ].join("\n");
  return `${frontmatter}${input.markdown}`;
}

type MirrorSession = {
  readonly id: string;
  readonly getSandbox?: () => PromiseLike<{
    writeTextFile: (input: {
      readonly path: string;
      readonly content: string;
    }) => PromiseLike<unknown>;
  }>;
};

/**
 * Mirror a saved plan to Blob (and the session sandbox when available).
 * Best-effort: DB save already succeeded; mirror failure must not fail the turn.
 */
export async function mirrorPlanMarkdown(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly title: string;
  readonly slug: string;
  readonly markdown: string;
  /** When set (agent tool path), also write the sandbox + chat seed. */
  readonly session?: MirrorSession;
}): Promise<{ path: string; mirrored: boolean; note?: string }> {
  const path = planMirrorPath(input.projectId, input.slug);
  const content = mirrorBody(input);

  if (input.session) {
    try {
      const sandbox = await input.session.getSandbox?.();
      if (sandbox) {
        await sandbox.writeTextFile({ path, content });
      }
    } catch {
      // Sandbox write is best-effort; Blob below still makes it durable.
    }

    const { persistAgentFile } = await import(
      "@/lib/agent/persist-agent-file"
    );
    const persistence = await persistAgentFile(
      { session: input.session },
      path,
      content,
    );
    return {
      path,
      mirrored: persistence.persisted,
      note: persistence.note,
    };
  }

  const prefix = artifactsPrefix({
    principalId: input.userId,
    principalType: "user",
  });
  const slug = normalizeArtifactSlug(path) ?? planMirrorSlug(input.projectId, input.slug);
  if (!prefix) {
    return {
      path,
      mirrored: false,
      note: "No principal artifact scope; plan saved in the project only.",
    };
  }

  try {
    await put(`${prefix}${slug}`, content, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeForWorkspacePath(path),
    });
    return { path, mirrored: true };
  } catch (error) {
    return {
      path,
      mirrored: false,
      note: `Plan saved, but the markdown mirror failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
