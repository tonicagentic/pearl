import { NextResponse } from "next/server";

import { ensureUserForPrincipal } from "@/lib/db/issues";
import { listUserSkills } from "@/lib/db/skills";
import {
  createCustomSkill,
  installPublishedSkill,
  previewPublishedSkill,
  removeSkill,
  searchPublishedSkills,
  setSkillEnabled,
  updateCustomSkill,
} from "@/lib/skills/manage";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Skills data for the mobile app: the same principal-scoped rows Settings
 * edits on the web, as JSON. GET lists skills; POST mutates with an `op`
 * field (create / update / setEnabled / delete / search / preview / install).
 */

async function requireViewer() {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus);

  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  return viewer;
}

function skillDto(row: Awaited<ReturnType<typeof listUserSkills>>[number]) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    markdown: row.markdown,
    files: row.files ?? {},
    enabled: row.enabled,
    source: row.source,
    registryName: row.registryName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const viewer = await requireViewer();

  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const skills = await listUserSkills(viewer.id);

  return NextResponse.json({
    viewer: { id: viewer.id, name: viewer.name, email: viewer.email },
    skills: skills.map(skillDto),
  });
}

export async function POST(request: Request) {
  const viewer = await requireViewer();

  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const op = body.op;

  try {
    if (op === "create") {
      const skill = await createCustomSkill(viewer.id, {
        title: typeof body.title === "string" ? body.title : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        description:
          typeof body.description === "string" ? body.description : undefined,
        markdown: typeof body.markdown === "string" ? body.markdown : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      });
      return NextResponse.json({ skill: skillDto(skill) });
    }

    if (op === "update") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        return NextResponse.json({ error: "Skill id required." }, { status: 400 });
      }
      const skill = await updateCustomSkill(viewer.id, id, {
        title: typeof body.title === "string" ? body.title : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        description:
          typeof body.description === "string" ? body.description : undefined,
        markdown: typeof body.markdown === "string" ? body.markdown : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      });
      return NextResponse.json({ skill: skillDto(skill) });
    }

    if (op === "setEnabled") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id || typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { error: "Skill id and enabled flag required." },
          { status: 400 },
        );
      }
      const skill = await setSkillEnabled(viewer.id, id, body.enabled);
      return NextResponse.json({ skill: skillDto(skill) });
    }

    if (op === "delete") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        return NextResponse.json({ error: "Skill id required." }, { status: 400 });
      }
      await removeSkill(viewer.id, id);
      return NextResponse.json({ ok: true });
    }

    if (op === "search") {
      const query = typeof body.query === "string" ? body.query : "";
      const result = await searchPublishedSkills(query);
      return NextResponse.json(result);
    }

    if (op === "preview") {
      const registryName =
        typeof body.registryName === "string" ? body.registryName.trim() : "";
      if (!registryName) {
        return NextResponse.json(
          { error: "registryName required." },
          { status: 400 },
        );
      }
      const preview = await previewPublishedSkill(registryName);
      return NextResponse.json({ preview });
    }

    if (op === "install") {
      const registryName =
        typeof body.registryName === "string" ? body.registryName.trim() : "";
      if (!registryName) {
        return NextResponse.json(
          { error: "registryName required." },
          { status: 400 },
        );
      }
      const skill = await installPublishedSkill(viewer.id, registryName);
      return NextResponse.json({ skill: skillDto(skill) });
    }

    return NextResponse.json(
      { error: `Unknown op: ${String(op)}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed." },
      { status: 400 },
    );
  }
}
