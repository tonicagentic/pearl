#!/usr/bin/env node
//
// Custom eve channel routes are not part of `/eve/v1/*`. After the Vercel
// output config exists, send `/api/automations` to the eve service. On Vercel
// that config lives at `/vercel/output/config.json` (next to `builds.json`),
// not `.vercel/output/config.json`. The eve service build runs later; chain
// this script from `eveBuildCommand` so its function routes are patched too.
//
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROUTES = [
  {
    destination: { service: "eve", type: "service" },
    src: "^/api/automations$",
  },
  {
    destination: { service: "eve", type: "service" },
    src: "^/api/automations/.*$",
  },
];

const SERVICE_PATH_ROUTES = [
  {
    src: "^/api/automations$",
    transforms: [
      { args: "/api/automations", op: "set", type: "request.path" },
    ],
  },
  {
    src: "^/api/automations/(.*)$",
    transforms: [
      { args: "/api/automations/$1", op: "set", type: "request.path" },
    ],
  },
];

async function fileExists(path) {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function findOutputDirectory(start) {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, "output");
    if (await fileExists(join(candidate, "builds.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function resolveHostConfigPath(cwd, env = process.env) {
  const fromEnv = env.EVE_INTERNAL_HOST_BUILD_OUTPUT_DIRECTORY?.trim();
  if (fromEnv) {
    const path = join(fromEnv, "config.json");
    if (await fileExists(path)) return path;
  }

  const outputDir = await findOutputDirectory(cwd);
  if (outputDir) {
    const path = join(outputDir, "config.json");
    if (await fileExists(path)) return path;
  }

  for (const path of [
    join(cwd, ".vercel/output/config.json"),
    "/vercel/output/config.json",
  ]) {
    if (await fileExists(path)) return path;
  }
  return null;
}

export async function resolveServiceConfigPath(cwd, env = process.env) {
  const fromEnv = env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY?.trim();
  const candidates = [
    fromEnv ? join(fromEnv, "config.json") : null,
    join(cwd, ".eve/vercel-services/eve/.vercel/output/config.json"),
  ].filter((path) => path != null);
  for (const path of candidates) {
    if (await fileExists(path)) return path;
  }
  return null;
}

function prependMissing(routes, additions) {
  const src = new Set(routes.map((route) => route.src));
  const missing = additions.filter((route) => !src.has(route.src));
  return missing.length > 0 ? [...missing, ...routes] : routes;
}

export function patchHostConfig(config) {
  if (!config.services?.eve || !Array.isArray(config.routes)) return false;
  const routes = prependMissing(config.routes, PROJECT_ROUTES);
  const eveRoutes = Array.isArray(config.services.eve.routes)
    ? config.services.eve.routes
    : [];
  const nextEveRoutes = prependMissing(eveRoutes, SERVICE_PATH_ROUTES);
  const changed =
    routes !== config.routes || nextEveRoutes !== config.services.eve.routes;
  config.routes = routes;
  config.services.eve.routes = nextEveRoutes;
  return changed;
}

async function inferServerDest(outputDir, config) {
  const dests = (config.routes ?? [])
    .map((route) => route.dest)
    .filter((dest) => typeof dest === "string");
  if (dests.includes("/eve/__server")) return "/eve/__server";
  if (dests.includes("/__server")) return "/__server";
  if (await directoryExists(join(outputDir, "functions/eve/__server.func"))) {
    return "/eve/__server";
  }
  if (await directoryExists(join(outputDir, "functions/__server.func"))) {
    return "/__server";
  }
  return null;
}

export async function patchServiceConfig(config, outputDir) {
  if (!Array.isArray(config.routes)) return false;
  if (config.routes.some((route) => String(route.src).includes("api/automations"))) {
    return false;
  }
  const dest = await inferServerDest(outputDir, config);
  if (!dest) return false;
  config.routes = prependMissing(config.routes, [
    { dest, src: "^/api/automations$" },
    { dest, src: "^/api/automations/(.*)$" },
  ]);
  return true;
}

async function writeConfig(path, config) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

export async function publishAutomationRoutes({
  cwd = process.cwd(),
  env = process.env,
  log = console.log,
} = {}) {
  const notes = [];
  const hostPath = await resolveHostConfigPath(cwd, env);
  if (!hostPath) {
    notes.push("no Vercel output config, skipping host routes");
  } else {
    const config = JSON.parse(await readFile(hostPath, "utf8"));
    if (!config.services?.eve || !Array.isArray(config.routes)) {
      notes.push(`eve service missing in ${hostPath}`);
    } else if (patchHostConfig(config)) {
      await writeConfig(hostPath, config);
      notes.push(`${hostPath}: /api/automations -> eve`);
    } else {
      notes.push(`${hostPath}: already published`);
    }
  }

  const servicePath = await resolveServiceConfigPath(cwd, env);
  if (servicePath) {
    const config = JSON.parse(await readFile(servicePath, "utf8"));
    if (await patchServiceConfig(config, dirname(servicePath))) {
      await writeConfig(servicePath, config);
      notes.push(`${servicePath}: /api/automations -> eve server`);
    } else {
      notes.push(`${servicePath}: service routes unchanged`);
    }
  }

  log(`publish-automation-routes: ${notes.join("; ")}`);
  return notes;
}

const isDirectRun =
  process.argv[1] != null &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isDirectRun) {
  await publishAutomationRoutes();
}
