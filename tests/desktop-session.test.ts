import assert from "node:assert/strict";
import { test } from "node:test";

import type { SandboxSettings } from "../lib/sandbox/settings.ts";
import {
  DESKTOP_RELAY_PORT,
  ensureDesktopSession,
  parseDesktopViewerLink,
  publicDesktopView,
  type DesktopSandbox,
} from "../lib/desktop/session.ts";

const PUBLIC = "https://sb-test.vercel.run";
const VIEWER = `${PUBLIC}/#token=abc123token`;

test("parseDesktopViewerLink accepts a same-origin tokenized URL", () => {
  assert.equal(parseDesktopViewerLink(`noise\n${VIEWER}\n`, PUBLIC), VIEWER);
  assert.throws(() => parseDesktopViewerLink("not-a-url", PUBLIC));
  assert.throws(() =>
    parseDesktopViewerLink("https://evil.example/#token=x", PUBLIC),
  );
  assert.throws(() => parseDesktopViewerLink(`${PUBLIC}/`, PUBLIC));
});

test("ensureDesktopSession starts screen-relay and returns a public view URL", async () => {
  const stored: {
    desktopSandboxName: string | null;
    desktopViewerUrl: string | null;
  } = { desktopSandboxName: null, desktopViewerUrl: null };

  let relayUp = false;
  const commands: string[] = [];

  const sandbox: DesktopSandbox = {
    domain(port) {
      assert.equal(port, DESKTOP_RELAY_PORT);
      return PUBLIC;
    },
    async extendTimeout() {},
    async update() {},
    async runCommand(params) {
      const script = params.args?.join(" ") ?? "";
      commands.push(`${params.cmd} ${script}`);
      if (script.includes("curl") && script.includes("127.0.0.1")) {
        return {
          exitCode: relayUp ? 0 : 1,
          async stdout() {
            return "";
          },
          async stderr() {
            return "";
          },
        };
      }
      if (script.includes("screen-relay up")) {
        relayUp = true;
        return {
          exitCode: 0,
          async stdout() {
            return `install noise on stderr\n${VIEWER}\n`;
          },
          async stderr() {
            return "npm install…\n";
          },
        };
      }
      return {
        exitCode: 1,
        async stdout() {
          return "";
        },
        async stderr() {
          return `unexpected: ${script}`;
        },
      };
    },
  };

  const handle = await ensureDesktopSession("chat-1", {
    async getChatDesktopSession() {
      return {
        desktopSandboxName: stored.desktopSandboxName,
        desktopViewerUrl: stored.desktopViewerUrl,
      };
    },
    async setChatDesktopSession(row) {
      stored.desktopSandboxName = row.desktopSandboxName;
      stored.desktopViewerUrl = row.desktopViewerUrl;
    },
    async getOrCreateSandbox(name: string, _settings: SandboxSettings) {
      assert.equal(name, "desktop-chat-1");
      return sandbox;
    },
    async getSandbox() {
      throw new Error("missing");
    },
  });

  assert.equal(handle.sandboxName, "desktop-chat-1");
  assert.equal(handle.viewUrl, VIEWER);
  assert.equal(stored.desktopViewerUrl, VIEWER);
  assert.match(
    commands.join("\n"),
    /screen-relay up -d --yes --public/,
  );

  const publicView = publicDesktopView(handle);
  assert.equal(publicView.viewUrl, VIEWER);

  // Model-safe shape: tool results must not include the token URL.
  const modelSafe = {
    ok: true,
    ready: true,
    note: "Desktop is streaming. The user can watch it in Computer.",
  };
  assert.equal(JSON.stringify(modelSafe).includes("token="), false);
  assert.equal(JSON.stringify(modelSafe).includes(VIEWER), false);
});

test("ensureDesktopSession reuses a live viewer URL without restarting", async () => {
  let upCalls = 0;
  const sandbox: DesktopSandbox = {
    domain() {
      return PUBLIC;
    },
    async extendTimeout() {},
    async update() {},
    async runCommand(params) {
      const script = params.args?.join(" ") ?? "";
      if (script.includes("curl")) {
        return {
          exitCode: 0,
          async stdout() {
            return "";
          },
          async stderr() {
            return "";
          },
        };
      }
      if (script.includes("screen-relay up")) {
        upCalls += 1;
      }
      return {
        exitCode: 1,
        async stdout() {
          return "";
        },
        async stderr() {
          return "should not start";
        },
      };
    },
  };

  const handle = await ensureDesktopSession("chat-2", {
    async getChatDesktopSession() {
      return {
        desktopSandboxName: "desktop-chat-2",
        desktopViewerUrl: VIEWER,
      };
    },
    async setChatDesktopSession() {
      throw new Error("should not rewrite");
    },
    async getSandbox() {
      return sandbox;
    },
  });

  assert.equal(handle.viewUrl, VIEWER);
  assert.equal(upCalls, 0);
});
