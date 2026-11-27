import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  patchHostConfig,
  patchServiceConfig,
  publishAutomationRoutes,
  resolveHostConfigPath,
} from "../scripts/publish-automation-routes.mjs";

test("host config path prefers the output directory next to builds.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "pearl-routes-"));
  const project = join(root, "path0");
  await mkdir(join(project, ".vercel/output"), { recursive: true });
  await mkdir(join(root, "output"), { recursive: true });
  await writeFile(join(root, "output/builds.json"), "{}\n");
  await writeFile(
    join(root, "output/config.json"),
    JSON.stringify({ routes: [], services: { eve: { routes: [] } } }),
  );
  await writeFile(
    join(project, ".vercel/output/config.json"),
    JSON.stringify({ routes: [], services: {} }),
  );

  assert.equal(
    await resolveHostConfigPath(project, {}),
    join(root, "output/config.json"),
  );
});

test("publish writes automations routes onto the Vercel host config", async () => {
  const root = await mkdtemp(join(tmpdir(), "pearl-routes-"));
  const project = join(root, "path0");
  await mkdir(project, { recursive: true });
  await mkdir(join(root, "output"), { recursive: true });
  await writeFile(join(root, "output/builds.json"), "{}\n");
  const configPath = join(root, "output/config.json");
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        routes: [
          {
            destination: { service: "eve", type: "service" },
            src: "^/eve/v1/(.*)$",
          },
        ],
        services: {
          eve: {
            routes: [
              {
                src: "^/eve/v1/(.*)$",
                transforms: [
                  { args: "/eve/v1/$1", op: "set", type: "request.path" },
                ],
              },
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  const notes = [];
  await publishAutomationRoutes({
    cwd: project,
    env: {},
    log: (line) => notes.push(line),
  });

  const config = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(
    config.routes.map((route) => route.src),
    ["^/api/automations$", "^/api/automations/.*$", "^/eve/v1/(.*)$"],
  );
  assert.equal(config.routes[0].destination.service, "eve");
  assert.equal(config.services.eve.routes[0].src, "^/api/automations$");
  assert.match(notes[0], /\/api\/automations -> eve/);

  await publishAutomationRoutes({ cwd: project, env: {}, log: () => {} });
  const again = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(again.routes.length, 3);
});

test("service output gains a route to the shared eve server", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "pearl-eve-output-"));
  await mkdir(join(outputDir, "functions/__server.func"), { recursive: true });
  const config = {
    routes: [{ dest: "/__server", src: "^/eve/v1/(.*)$" }],
  };
  assert.equal(await patchServiceConfig(config, outputDir), true);
  assert.deepEqual(
    config.routes.map((route) => route.src),
    ["^/api/automations$", "^/api/automations/(.*)$", "^/eve/v1/(.*)$"],
  );
  assert.equal(config.routes[0].dest, "/__server");
  assert.equal(await patchServiceConfig(config, outputDir), false);
});

test("patchHostConfig leaves a config without eve untouched", () => {
  const config = { routes: [], services: {} };
  assert.equal(patchHostConfig(config), false);
});
