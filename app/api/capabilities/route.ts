import { NextResponse } from "next/server";

import { toCapabilityDto } from "@/lib/capabilities/serialize";
import {
  CapabilityInputError,
  parseCapabilityKind,
  parseCapabilityStatus,
} from "@/lib/capabilities/validation";
import {
  archiveCapability,
  listCapabilities,
  saveCapability,
  updateCapability,
} from "@/lib/db/capabilities";
import { ensureUserForPrincipal } from "@/lib/db/issues";
import type { CapabilityStatus } from "@/lib/db/schema";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Capability catalog for the mobile app. GET lists rows. POST mutates with
 * an `op` of save, update, or archive.
 */

async function requireViewer(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);

  if (!viewer || setupStatus.storageMode !== "database") {
    return null;
  }

  await ensureUserForPrincipal({
    principalId: viewer.id,
    attributes: { name: viewer.name, email: viewer.email },
  });

  return viewer;
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (!viewer) {
    return NextResponse.json(
      { error: "Sign in with durable storage configured." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const statuses: readonly CapabilityStatus[] = includeArchived
    ? ["active", "exploring", "archived"]
    : ["active", "exploring"];

  const rows = await listCapabilities(viewer.id, { statuses });
  return NextResponse.json({
    capabilities: rows.map(toCapabilityDto),
  });
}

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
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
    if (op === "archive") {
      if (typeof body.id !== "string" || !body.id.trim()) {
        return NextResponse.json(
          { error: "Capability id is required." },
          { status: 400 },
        );
      }
      const row = await archiveCapability(viewer.id, body.id);
      return NextResponse.json({ capability: toCapabilityDto(row) });
    }

    if (op === "update") {
      if (typeof body.id !== "string" || !body.id.trim()) {
        return NextResponse.json(
          { error: "Capability id is required." },
          { status: 400 },
        );
      }
      const kind = parseCapabilityKind(body.kind);
      const status = parseCapabilityStatus(body.status);
      const row = await updateCapability(viewer.id, body.id, {
        name: stringOrNull(body.name),
        kind: kind ?? undefined,
        summary: stringOrNull(body.summary),
        audience: stringOrNull(body.audience),
        proof: stringOrNull(body.proof),
        status: status ?? undefined,
        projectId: stringOrNull(body.projectId),
        notes: stringOrNull(body.notes),
      });
      return NextResponse.json({ capability: toCapabilityDto(row) });
    }

    if (op === "save") {
      const kind = parseCapabilityKind(body.kind);
      if (!kind) {
        return NextResponse.json(
          { error: "Kind must be skill, product, or service." },
          { status: 400 },
        );
      }
      if (typeof body.name !== "string" || typeof body.summary !== "string") {
        return NextResponse.json(
          { error: "Name and summary are required." },
          { status: 400 },
        );
      }
      const status = parseCapabilityStatus(body.status);
      const { row } = await saveCapability(viewer.id, {
        id: typeof body.id === "string" ? body.id : undefined,
        name: body.name,
        kind,
        summary: body.summary,
        audience: stringOrNull(body.audience),
        proof: stringOrNull(body.proof),
        status: status ?? undefined,
        projectId: stringOrNull(body.projectId),
        notes: stringOrNull(body.notes),
      });
      return NextResponse.json({ capability: toCapabilityDto(row) });
    }

    return NextResponse.json(
      { error: "Unknown op. Use save, update, or archive." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof CapabilityInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update capabilities.",
      },
      { status: 500 },
    );
  }
}
