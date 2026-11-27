#!/usr/bin/env node
//
// Custom eve channel routes are not published with `/eve/v1/*`. After
// `next build`, point `/api/automations` at the eve service so production
// reaches the same handlers the local proxy forwards to.
//
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const configPath = join(process.cwd(), ".vercel/output/config.json");

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

const SERVICE_ROUTES = [
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

let raw;
try {
  raw = await readFile(configPath, "utf8");
} catch {
  console.log("publish-automation-routes: no Vercel output config, skipping");
  process.exit(0);
}

const config = JSON.parse(raw);
const eve = config.services?.eve;
if (!eve || !Array.isArray(config.routes)) {
  console.log("publish-automation-routes: eve service missing, skipping");
  process.exit(0);
}

const projectSrc = new Set(config.routes.map((route) => route.src));
for (const route of PROJECT_ROUTES) {
  if (!projectSrc.has(route.src)) config.routes.unshift(route);
}

eve.routes = Array.isArray(eve.routes) ? eve.routes : [];
const serviceSrc = new Set(eve.routes.map((route) => route.src));
for (const route of SERVICE_ROUTES) {
  if (!serviceSrc.has(route.src)) eve.routes.push(route);
}

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("publish-automation-routes: /api/automations -> eve");
