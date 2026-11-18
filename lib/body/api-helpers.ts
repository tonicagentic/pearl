import { NextResponse } from "next/server";
import { getServerViewer } from "@/lib/session";
import { getSetupStatus } from "@/lib/setup";
import { runAsUser } from "./context";

/**
 * Authenticate a Body API request (cookie or Bearer) and run `fn` as that user.
 * Returns JSON 401 instead of redirecting — suitable for Expo.
 */
export async function withBodyApi<T>(
  request: Request,
  fn: () => Promise<T>,
): Promise<Response> {
  const setup = await getSetupStatus();
  const viewer = await getServerViewer(setup, request.headers);
  if (!viewer?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await runAsUser(viewer.id, fn);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status =
      message.startsWith("Invalid") || message.includes("required")
        ? 400
        : message === "Not found" || message.startsWith("No ")
          ? 404
          : 500;
    if (status === 500) console.error(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}
