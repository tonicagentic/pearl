import { NextResponse } from "next/server";

import {
  emailHasAccount,
  isPlausibleAuthEmail,
  normalizeAuthEmail,
} from "@/lib/auth-email-status";
import { getSetupStatus } from "@/lib/setup";

/**
 * Public probe used by the native email-first auth gate: known addresses
 * continue into sign-in (“Welcome back”); unknown ones into sign-up.
 * Returns only `{ exists }` — no other account fields.
 */
export async function POST(request: Request) {
  const setupStatus = await getSetupStatus();
  if (
    !setupStatus.databaseConfigured ||
    !setupStatus.databaseSchemaReady ||
    !setupStatus.authReady
  ) {
    return NextResponse.json({ exists: false }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? normalizeAuthEmail((body as { email: string }).email)
      : "";

  if (!isPlausibleAuthEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const exists = await emailHasAccount(email);
  return NextResponse.json({ exists });
}
