/**
 * Live smoke: create a Vercel Sandbox, start screen-relay, print the viewer
 * URL, then stop. Requires VERCEL_OIDC_TOKEN (e.g. via .env.local).
 *
 *   node --env-file=.env.local scripts/smoke-desktop-relay.mjs
 */
import { Sandbox } from "@vercel/sandbox";

const name = `desktop-smoke-${Date.now().toString(36)}`;
const port = 8080;

console.log(`Creating sandbox ${name}…`);
const sandbox = await Sandbox.create({
  name,
  ports: [port],
  timeout: 45 * 60 * 1000,
  persistent: false,
});

const publicUrl = sandbox.domain(port).replace(/\/$/, "");
console.log(`Public URL: ${publicUrl}`);
console.log("Installing screen-relay and starting desktop (first run can take several minutes)…");

try {
  const result = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      'npm install -g screen-relay >&2 && screen-relay up -d --yes --public "$1"',
      "sh",
      publicUrl,
    ],
  });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  if (result.exitCode !== 0) {
    console.error("screen-relay failed:", stderr || stdout);
    process.exitCode = 1;
  } else {
    const link = stdout.trim().split("\n").at(-1)?.trim() ?? "";
    const viewer = URL.canParse(link) ? new URL(link) : null;
    if (
      !viewer ||
      viewer.origin !== new URL(publicUrl).origin ||
      !viewer.hash.startsWith("#token=")
    ) {
      console.error("Unexpected viewer link:", link);
      console.error("stdout:", stdout);
      process.exitCode = 1;
    } else {
      console.log("Desktop stream ready:");
      console.log(viewer.href);
    }
  }
} finally {
  console.log("Stopping sandbox…");
  await sandbox.stop();
  console.log("Done.");
}
