import { installCodeTooling } from "eve/extensions/code/sandbox";
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

import { CODER_BASELINE_NETWORK_POLICY } from "@/lib/coder/network-policy";
import {
  ensureProjectDrive,
  getProjectIdForEveSession,
  PROJECT_DRIVE_MOUNT,
} from "@/lib/project-drive";

// Coder sandbox: prepared Linux image with gh/vc wrappers and Corepack, then
// opened with enough compute for a Next.js install/build loop. No Chrome,
// Xcode, Android SDK, or Docker in this image. Changing prepare rebuilds the
// snapshot on the next eve build.
//
// When the parent chat belongs to a project, mount that project's Vercel Drive
// at /workspace/drive so coder shares files with other project agents.
export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    await installCodeTooling(sandbox, { vercel: true });

    // Some Vercel sandbox base images ship Node without Corepack on PATH.
    // Install it via npm when missing, then activate pnpm.
    const corepack = await sandbox.run({
      command:
        "set -euo pipefail; " +
        "command -v node; command -v git; command -v python3; " +
        "if ! command -v corepack >/dev/null 2>&1; then npm install -g corepack; fi; " +
        "corepack enable; " +
        "corepack prepare pnpm@latest --activate; " +
        "command -v pnpm",
    });
    if (corepack.exitCode !== 0) {
      throw new Error(
        `Coder sandbox prepare failed (exit ${corepack.exitCode}): ${corepack.stderr || corepack.stdout}`,
      );
    }
  },
});

export default defineSandbox(async ({ session }) => {
  const principalId = session.auth.current?.principalId;
  const { coderTimeoutMs, DEFAULT_SANDBOX_SETTINGS } = await import(
    "@/lib/sandbox/settings"
  );
  const { getSandboxSettings } = await import("@/lib/sandbox/store");
  const settings = principalId
    ? await getSandboxSettings(principalId)
    : DEFAULT_SANDBOX_SETTINGS;

  let mounts: Record<string, { readonly name: string }> | undefined;
  if (principalId) {
    const projectId = await getProjectIdForEveSession(session.id).catch(
      () => null,
    );
    if (projectId) {
      const driveName = await ensureProjectDrive({
        userId: principalId,
        projectId,
      }).catch(() => null);
      if (driveName) {
        mounts = { [PROJECT_DRIVE_MOUNT]: { name: driveName } };
      }
    }
  }

  const sandbox = await environment.open({
    networkPolicy: CODER_BASELINE_NETWORK_POLICY,
    resources: { vcpus: settings.coderVcpus },
    timeout: coderTimeoutMs(settings),
    // Publish common web-dev ports so publish_dev_server can call domain(port).
    ports: [3000, 3001, 4000, 5173, 8080],
    ...(mounts ? { mounts } : {}),
  });
  if (principalId) {
    const { noteSandboxOpened } = await import("@/lib/billing/sandbox-meter");
    noteSandboxOpened({
      sandboxId: `coder:${session.id}`,
      userId: principalId,
      vcpus: settings.coderVcpus,
      label: "coder",
    });
  }
  return sandbox;
});
