#!/usr/bin/env node
//
// Cut a Pearl release in one command, following the repo's stated versioning
// practice (Keep a Changelog + SemVer):
//
//   node scripts/release.mjs 0.1.0-alpha.2 [--dry-run]
//
// Steps: validate version + git state, bump package.json + mobile/app.json
// (auto-incrementing the iOS build number), date the "Unreleased" changelog
// section, commit, tag vX.Y.Z[-pre.N], push main + tag, and open a GitHub
// release (marked pre-release when the version carries a pre-release
// identifier). Deployment to production stays a separate, explicit step.
//
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((arg) => !arg.startsWith("--"));

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function run(command, options = {}) {
  return execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;

if (!version || !SEMVER.test(version)) {
  fail(
    "usage: node scripts/release.mjs <version> [--dry-run]  " +
      "e.g. 0.1.0-alpha.2, 0.2.0, 1.0.0-rc.1",
  );
}
const isPrerelease = version.includes("-");

// Git state: main only, clean, tag unused, in sync with origin.
if (run("git branch --show-current") !== "main") {
  fail("run this from a clean `main` checkout.");
}
if (run("git status --porcelain") !== "") {
  fail("working tree is not clean — commit or stash first.");
}
if (run("git tag --list", { cwd: process.cwd() }).split("\n").includes(`v${version}`)) {
  fail(`tag v${version} already exists.`);
}
run("git fetch origin main");
const ahead = Number(run("git rev-list --count origin/main..main"));
const behind = Number(run("git rev-list --count main..origin/main"));
if (behind > 0) {
  fail(`main is ${behind} commit(s) behind origin/main — pull first.`);
}
if (ahead > 0) {
  console.log(`release: pushing ${ahead} unpushed commit(s) with this release.`);
}

// Versions: root package + the Expo app (aligned), build number +1.
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.version === version) {
  fail(`package.json is already ${version}.`);
}
const appJson = JSON.parse(readFileSync("mobile/app.json", "utf8"));
const buildNumber = Number(appJson.expo.ios.buildNumber ?? 1) + 1;

// Changelog: the Unreleased section must have content to ship.
const changelog = readFileSync("CHANGELOG.md", "utf8");
const unreleasedMatch = changelog.match(
  /^## Unreleased\n\n([\s\S]*?)(?=\n## |$)/,
);
const notes = unreleasedMatch?.[1]?.trim();
if (!notes) {
  fail(
    'the "## Unreleased" changelog section is empty — write the release ' +
      "notes there first.",
  );
}

const today = new Date().toISOString().slice(0, 10);
const updatedChangelog = changelog.replace(
  /^## Unreleased\n/,
  `## Unreleased\n\n## ${version} - ${today}\n`,
);

console.log(`release: ${version}${isPrerelease ? " (pre-release)" : ""}`);
console.log(`  package.json + mobile/app.json -> ${version}`);
console.log(`  ios buildNumber -> ${buildNumber}`);
console.log(`  changelog notes:\n${notes.split("\n").map((line) => `    ${line}`).join("\n")}`);

if (dryRun) {
  console.log("release: dry run — nothing written.");
  process.exit(0);
}

// Write versions.
packageJson.version = version;
writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
appJson.expo.version = version;
appJson.expo.ios.buildNumber = buildNumber;
writeFileSync("mobile/app.json", `${JSON.stringify(appJson, null, 2)}\n`);
writeFileSync("CHANGELOG.md", updatedChangelog);

// Commit, tag, push.
run('git add package.json mobile/app.json CHANGELOG.md');
run(`git commit -m ${JSON.stringify(`Version ${version}`)}`);
run(`git tag v${version}`);
run("git push origin main");
run(`git push origin v${version}`);

// GitHub release with the changelog section as the notes.
const notesDir = mkdtempSync(join(tmpdir(), "pearl-release-"));
const notesFile = join(notesDir, "notes.md");
const repoUrl = run("git remote get-url origin")
  .replace(/^git@github\.com:/, "https://github.com/")
  .replace(/\.git$/, "");
writeFileSync(
  notesFile,
  `${notes}\n\nFull changelog: ${repoUrl}/blob/main/CHANGELOG.md\n`,
);
const gh = spawnSync(
  "gh",
  [
    "release",
    "create",
    `v${version}`,
    "--title",
    `Pearl ${version}`,
    ...(isPrerelease ? ["--prerelease"] : []),
    "--notes-file",
    notesFile,
  ],
  { encoding: "utf8" },
);
rmSync(notesDir, { recursive: true, force: true });
if (gh.status !== 0) {
  fail(`gh release create failed: ${gh.stderr}`);
}

console.log(`release: published ${(gh.stdout || "").trim()}`);
console.log(
  "release: done. Deploy production separately: vercel deploy --prod " +
    "(migrate first if the release includes schema changes).",
);
