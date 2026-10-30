#!/usr/bin/env node
/**
 * Local smoke: create a mini-app draft (no GitHub) and run one fx turn in a
 * Vercel Sandbox. Requires DATABASE_URL, a valid VERCEL_OIDC_TOKEN, and
 * `vercel link` / VERCEL_PROJECT_ID so durable-harness can name sandboxes.
 *
 * Keep Next.js (`pnpm dev`) running so withDurableHarness wake routes are up.
 * After coding, code_with_fx also calls ensureAppPreview — expect previewUrl
 * on the mini_app row to match https://*.vercel.run when OIDC/sandbox works.
 *
 *   pnpm smoke:sandbox-app [slug-suffix]
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

for (const envFile of [".env.development.local", ".env.local"]) {
  try {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      const key = match?.[1];
      const value = match?.[2]?.replace(/^["']|["']$/g, "") ?? "";
      if (key && value && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

function oidcExpiry() {
  const raw = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (!raw) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(raw.split(".")[1], "base64url").toString("utf8"),
    );
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

async function main() {
  const exp = oidcExpiry();
  if (!exp) {
    console.error("Missing VERCEL_OIDC_TOKEN in .env.local");
    process.exit(1);
  }
  if (exp.getTime() < Date.now()) {
    console.error(
      `VERCEL_OIDC_TOKEN expired at ${exp.toISOString()}. Refresh and restart pnpm dev.`,
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  if (!process.env.VERCEL_PROJECT_ID) {
    console.warn(
      "WARN: VERCEL_PROJECT_ID unset — sandbox names need vercel link / project id.",
    );
  }

  const suffix = (process.argv[2] || randomUUID().slice(0, 8))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
  const slug = `sandbox-smoke-${suffix}`;
  const userId = `smoke-sandbox-${suffix}`;

  console.log(`OIDC ok until ${exp.toISOString()}`);
  console.log(`Creating draft app slug=${slug} userId=${userId} (no GitHub)`);

  const { createApp } = await import("../lib/apps/create-service.ts");
  const { codeWithFx } = await import("../lib/apps/code-service.ts");
  const { getMiniApp } = await import("../lib/apps/queries.ts");

  const created = await createApp({
    userId,
    userName: "Sandbox Smoke",
    userEmail: `${userId}@smoke.pearl.local`,
    slug,
    title: `Sandbox Smoke ${suffix}`,
  });
  console.log("createApp →", JSON.stringify(created, null, 2));
  if (created.status === "error") {
    process.exit(1);
  }
  if (created.app.githubOwner || created.app.githubRepo) {
    console.error("Expected github fields to be null before publish");
    process.exit(1);
  }

  const appId = created.app.id;
  console.log("codeWithFx starting (may take a few minutes)…");
  const coded = await codeWithFx({
    userId,
    appId,
    task:
      "Do NOT reinstall a full Next app if seed files are already present. " +
      "Create /workspace/SMOKE.txt containing exactly the line pearl-sandbox-ok, " +
      "then run: cat /workspace/SMOKE.txt. Reply with that line.",
  });
  console.log("codeWithFx →", JSON.stringify(coded, null, 2));

  const row = await getMiniApp(userId, appId);
  console.log(
    "mini_app row →",
    JSON.stringify(
      {
        id: row?.id,
        slug: row?.slug,
        status: row?.status,
        githubOwner: row?.githubOwner,
        githubRepo: row?.githubRepo,
        sandboxName: row?.sandboxName,
        fxSessionId: row?.fxSessionId,
        previewUrl: row?.previewUrl,
      },
      null,
      2,
    ),
  );

  if (coded.status !== "ok") {
    process.exit(1);
  }
  if (row?.githubOwner || row?.githubRepo) {
    console.error("GitHub should still be unset after coding");
    process.exit(1);
  }
  if (!row?.sandboxName?.startsWith("dh-")) {
    console.error("Expected durable-harness dh-* sandbox name, got", row?.sandboxName);
    process.exit(1);
  }
  if (!row?.fxSessionId?.startsWith("wrun_")) {
    console.error("Expected wrun_* fx session id, got", row?.fxSessionId);
    process.exit(1);
  }
  if (row?.previewUrl && !/https:\/\/.+\.vercel\.run/.test(row.previewUrl)) {
    console.error("Unexpected previewUrl", row.previewUrl);
    process.exit(1);
  }
  if (coded.previewUrl) {
    console.log("code_with_fx previewUrl →", coded.previewUrl);
  }

  const { readSandboxWorkspaceFiles } = await import("../lib/apps/sandbox-files.ts");
  const files = await readSandboxWorkspaceFiles(row.sandboxName);
  const smoke = files.find(
    (file) => file.path === "SMOKE.txt" || file.path.endsWith("/SMOKE.txt"),
  );
  console.log(
    "sandbox files →",
    files.map((file) => file.path),
    "SMOKE →",
    smoke ? JSON.stringify(smoke.content) : "missing",
  );
  if (!smoke || !/pearl-sandbox-ok/.test(smoke.content)) {
    console.error("Sandbox missing SMOKE.txt with pearl-sandbox-ok");
    process.exit(1);
  }

  console.log("SMOKE PASS: draft create + sandbox coding without GitHub");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
