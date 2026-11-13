import { installCodeTooling } from "eve/extensions/code/sandbox";
import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

import { CODER_BASELINE_NETWORK_POLICY } from "@/lib/coder/network-policy";

// Coder sandbox: prepared Linux image with gh/vc wrappers and Corepack, then
// opened with enough compute for a Next.js install/build loop. No Chrome,
// Xcode, Android SDK, or Docker in this image. Changing prepare rebuilds the
// snapshot on the next eve build.
export const environment = VercelSandbox.environment({
  prepare: async (sandbox) => {
    await installCodeTooling(sandbox, { vercel: true });

    const corepack = await sandbox.run({
      command:
        "command -v node && command -v git && command -v python3 && " +
        "corepack enable && corepack prepare pnpm@latest --activate",
    });
    if (corepack.exitCode !== 0) {
      throw new Error(
        `Coder sandbox prepare failed (exit ${corepack.exitCode}): ${corepack.stderr || corepack.stdout}`,
      );
    }
  },
});

export default defineSandbox(async ({ session }) => {
  const sandbox = await environment.open({
    networkPolicy: CODER_BASELINE_NETWORK_POLICY,
    resources: { vcpus: 4 },
    timeout: 45 * 60 * 1000,
    // Publish common web-dev ports so publish_dev_server can call domain(port).
    ports: [3000, 3001, 4000, 5173, 8080],
  });
  const principalId = session.auth.current?.principalId;
  if (principalId) {
    const { noteSandboxOpened } = await import("@/lib/billing/sandbox-meter");
    noteSandboxOpened({
      sandboxId: `coder:${session.id}`,
      userId: principalId,
      vcpus: 4,
      label: "coder",
    });
  }
  return sandbox;
});
