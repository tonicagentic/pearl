import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import {
  coerceSandboxSettings,
  DEFAULT_SANDBOX_SETTINGS,
  normalizeSandboxSettings,
  type SandboxSettings,
  type SandboxSettingsPatch,
} from "@/lib/sandbox/settings";

/** Read this account's sandbox settings, or the built-in defaults. */
export async function getSandboxSettings(
  userId: string,
): Promise<SandboxSettings> {
  try {
    const [row] = await db
      .select({
        browserTimeoutMinutes: user.sandboxBrowserTimeoutMinutes,
        browserVcpus: user.sandboxBrowserVcpus,
        coderTimeoutMinutes: user.sandboxCoderTimeoutMinutes,
        coderVcpus: user.sandboxCoderVcpus,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return DEFAULT_SANDBOX_SETTINGS;
    return coerceSandboxSettings(row);
  } catch {
    return DEFAULT_SANDBOX_SETTINGS;
  }
}

export async function updateSandboxSettings(
  userId: string,
  patch: SandboxSettingsPatch,
): Promise<SandboxSettings> {
  const current = await getSandboxSettings(userId);
  const next = normalizeSandboxSettings({
    ...current,
    ...definedPatch(patch),
  });
  await db
    .update(user)
    .set({
      sandboxBrowserTimeoutMinutes: next.browserTimeoutMinutes,
      sandboxBrowserVcpus: next.browserVcpus,
      sandboxCoderTimeoutMinutes: next.coderTimeoutMinutes,
      sandboxCoderVcpus: next.coderVcpus,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
  return next;
}

function definedPatch(patch: SandboxSettingsPatch): Partial<SandboxSettings> {
  return {
    ...(patch.browserTimeoutMinutes !== undefined
      ? { browserTimeoutMinutes: patch.browserTimeoutMinutes }
      : {}),
    ...(patch.browserVcpus !== undefined
      ? { browserVcpus: patch.browserVcpus }
      : {}),
    ...(patch.coderTimeoutMinutes !== undefined
      ? { coderTimeoutMinutes: patch.coderTimeoutMinutes }
      : {}),
    ...(patch.coderVcpus !== undefined ? { coderVcpus: patch.coderVcpus } : {}),
  };
}
