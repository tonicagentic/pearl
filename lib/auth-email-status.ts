import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalize for lookup — matches create-user / better-auth storage. */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleAuthEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeAuthEmail(email));
}

/** True when a credential account already exists for this email. */
export async function emailHasAccount(email: string): Promise<boolean> {
  const normalized = normalizeAuthEmail(email);
  if (!EMAIL_RE.test(normalized)) return false;

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`)
    .limit(1);

  return rows.length > 0;
}
