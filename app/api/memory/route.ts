import { NextResponse } from "next/server";

import {
  MemoryInputError,
  type MemoryOp,
} from "@/lib/memory/file-document";
import {
  listProfileMemory,
  MemoryUnavailableError,
  mutateProfileMemory,
} from "@/lib/memory/profile-document";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";

/**
 * Long-term memory for the signed-in principal — the same indexed facts eve
 * recalls before every turn. GET lists them. POST mutates with an `op` of
 * add, update, remove, or clear.
 */

async function requireScope(request: Request) {
  const setupStatus = await getSetupStatus();
  const viewer = await getServerViewer(setupStatus, request.headers);
  if (!viewer) return null;
  return { authMode: setupStatus.authMode, userId: viewer.id };
}

function failure(error: unknown) {
  if (error instanceof MemoryInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof MemoryUnavailableError) {
    const status = error.reason === "conflict" ? 409 : 503;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(
    { error: "Could not update memory." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const scope = await requireScope(request);
  if (!scope) {
    return NextResponse.json(
      { error: "Sign in to manage memory." },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json(
      await listProfileMemory(scope.authMode, scope.userId),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const scope = await requireScope(request);
  if (!scope) {
    return NextResponse.json(
      { error: "Sign in to manage memory." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let op: MemoryOp;
  try {
    op = parseOp(body);
  } catch (error) {
    return failure(error);
  }

  try {
    return NextResponse.json(
      await mutateProfileMemory(scope.authMode, scope.userId, op),
    );
  } catch (error) {
    return failure(error);
  }
}

function parseOp(body: Record<string, unknown>): MemoryOp {
  const op = body.op;
  if (op === "clear") return { type: "clear" };
  if (op === "remove") return { type: "remove", index: readIndex(body.index) };
  if (op === "add") {
    if (typeof body.text !== "string") {
      throw new MemoryInputError("Memory text is required.");
    }
    return { type: "add", text: body.text };
  }
  if (op === "update") {
    if (typeof body.text !== "string") {
      throw new MemoryInputError("Memory text is required.");
    }
    return { type: "update", index: readIndex(body.index), text: body.text };
  }
  throw new MemoryInputError("Unknown memory operation.");
}

function readIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MemoryInputError("Memory index is invalid.");
  }
  return value;
}
