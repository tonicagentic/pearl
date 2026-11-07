/**
 * Source for the collaborative browser control server that runs inside a
 * dedicated Vercel Sandbox. Written to disk on first ensure and started
 * detached. Keep this self-contained — it only has Node + playwright-core + ws.
 */
export const BROWSER_CONTROL_PORT = 3456;

export const BROWSER_CONTROL_SERVER_SOURCE = `#!/usr/bin/env node
"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");
const { chromium } = require("playwright-core");

const PORT = Number(process.env.BROWSER_CONTROL_PORT || ${BROWSER_CONTROL_PORT});
const SECRET = process.env.BROWSER_CONTROL_SECRET || "";
const FRAME_ANCESTORS = process.env.BROWSER_FRAME_ANCESTORS || "'self'";

if (!SECRET) {
  console.error("BROWSER_CONTROL_SECRET is required");
  process.exit(1);
}

/** @type {import('playwright-core').Browser | null} */
let browser = null;
/** @type {Map<string, import('playwright-core').Page>} */
const pages = new Map();
let activePageId = null;
let nextPageNum = 1;
/** @type {"agent" | "user"} */
let controlMode = "agent";
/** @type {Map<string, { role: string, name: string, element: import('playwright-core').ElementHandle }>} */
let lastRefs = new Map();

const viewers = new Set();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function unauthorized(res) {
  json(res, 401, { ok: false, note: "unauthorized" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function authOk(req, url) {
  const header = req.headers["x-browser-secret"];
  if (typeof header === "string" && header === SECRET) return true;
  const q = url.searchParams.get("secret");
  return q === SECRET;
}

async function ensureBrowser() {
  if (browser) return browser;
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  browser.on("disconnected", () => {
    browser = null;
    pages.clear();
    activePageId = null;
  });
  return browser;
}

async function ensurePage() {
  await ensureBrowser();
  if (activePageId && pages.has(activePageId)) {
    return { id: activePageId, page: pages.get(activePageId) };
  }
  return createPage("about:blank");
}

async function createPage(url) {
  const b = await ensureBrowser();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const id = "p" + String(nextPageNum++);
  pages.set(id, page);
  activePageId = id;
  page.on("close", () => {
    pages.delete(id);
    if (activePageId === id) {
      activePageId = pages.keys().next().value || null;
    }
    broadcast({ type: "tabs", tabs: listTabs() });
  });
  if (url && url !== "about:blank") {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  }
  return { id, page };
}

function listTabs() {
  const out = [];
  for (const [id, page] of pages) {
    out.push({
      id,
      url: page.url(),
      title: "",
      active: id === activePageId,
    });
  }
  return out;
}

async function enrichTabs() {
  const out = [];
  for (const [id, page] of pages) {
    let title = "";
    try {
      title = await page.title();
    } catch {}
    out.push({
      id,
      url: page.url(),
      title,
      active: id === activePageId,
    });
  }
  return out;
}

async function buildSnapshot(page) {
  lastRefs = new Map();
  const handles = await page.$$(
    "a, button, input, textarea, select, [role='button'], [role='link'], [role='textbox'], [role='checkbox'], [role='radio'], [role='menuitem'], [contenteditable='true']",
  );
  const lines = [];
  let n = 0;
  for (const handle of handles) {
    if (n >= 80) break;
    const info = await handle
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return null;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        const role =
          el.getAttribute("role") ||
          (el.tagName === "A"
            ? "link"
            : el.tagName === "BUTTON"
              ? "button"
              : el.tagName === "INPUT"
                ? el.type || "textbox"
                : el.tagName === "TEXTAREA"
                  ? "textbox"
                  : el.tagName === "SELECT"
                    ? "combobox"
                    : el.tagName.toLowerCase());
        const name = (
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          (el.innerText || el.textContent || "").trim() ||
          el.getAttribute("href") ||
          ""
        ).slice(0, 80);
        return { role, name };
      })
      .catch(() => null);
    if (!info) {
      await handle.dispose().catch(() => {});
      continue;
    }
    n += 1;
    const ref = "e" + n;
    lastRefs.set(ref, { role: info.role, name: info.name, element: handle });
    lines.push(\`- \${info.role} "\${info.name.replace(/"/g, "'")}" [\${ref}]\`);
  }
  return lines.join("\\n");
}

async function resolveRef(ref) {
  const entry = lastRefs.get(ref);
  if (!entry) throw new Error("Unknown ref: " + ref + ". Call snapshot first.");
  return entry.element;
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of viewers) {
    if (ws.readyState === 1) ws.send(data);
  }
}

async function resultBase(extra) {
  const tabs = await enrichTabs();
  const active = activePageId ? pages.get(activePageId) : null;
  let url = null;
  let title = null;
  if (active) {
    url = active.url();
    try {
      title = await active.title();
    } catch {
      title = null;
    }
  }
  return {
    ok: true,
    controlMode,
    url,
    title,
    tabs: tabs.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
    })),
    snapshot: null,
    ...extra,
  };
}

async function handleAction(body) {
  if (body.action === "heartbeat") {
    return resultBase({ note: "ok" });
  }
  if (body.action === "control") {
    controlMode = body.mode === "user" ? "user" : "agent";
    broadcast({ type: "control", mode: controlMode });
    return resultBase({ note: "control set to " + controlMode });
  }

  const agentOnly = ["navigate", "click", "type", "press", "scroll", "snapshot"].includes(
    body.action,
  );
  if (agentOnly && controlMode === "user") {
    return resultBase({
      ok: false,
      note: "the user has control — stop and wait until they hand back",
    });
  }
  if (body.action === "tabs" && body.op !== "list" && controlMode === "user") {
    return resultBase({
      ok: false,
      note: "the user has control — stop and wait until they hand back",
    });
  }

  if (body.action === "tabs") {
    if (body.op === "list") return resultBase({});
    if (body.op === "new") {
      const { id } = await createPage(body.url || "about:blank");
      broadcast({ type: "tabs", tabs: await enrichTabs() });
      const snap = await buildSnapshot(pages.get(id));
      return resultBase({ snapshot: snap, note: "opened tab " + id });
    }
    if (body.op === "select") {
      if (!pages.has(body.tabId)) {
        return resultBase({ ok: false, note: "unknown tab" });
      }
      activePageId = body.tabId;
      broadcast({ type: "tabs", tabs: await enrichTabs(), active: activePageId });
      return resultBase({ note: "selected " + body.tabId });
    }
    if (body.op === "close") {
      const page = pages.get(body.tabId);
      if (!page) return resultBase({ ok: false, note: "unknown tab" });
      await page.close().catch(() => {});
      pages.delete(body.tabId);
      if (activePageId === body.tabId) {
        activePageId = pages.keys().next().value || null;
      }
      if (!activePageId) await createPage("about:blank");
      broadcast({ type: "tabs", tabs: await enrichTabs() });
      return resultBase({ note: "closed " + body.tabId });
    }
  }

  const { id, page } = body.tabId && pages.has(body.tabId)
    ? { id: body.tabId, page: pages.get(body.tabId) }
    : await ensurePage();
  activePageId = id;

  if (body.action === "navigate") {
    await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const snap = await buildSnapshot(page);
    broadcast({ type: "tabs", tabs: await enrichTabs() });
    return resultBase({ snapshot: snap });
  }
  if (body.action === "snapshot") {
    const snap = await buildSnapshot(page);
    return resultBase({ snapshot: snap });
  }
  if (body.action === "click") {
    const el = await resolveRef(body.ref);
    await el.click({ timeout: 10000 });
    await page.waitForTimeout(300);
    const snap = await buildSnapshot(page);
    return resultBase({ snapshot: snap });
  }
  if (body.action === "type") {
    const el = await resolveRef(body.ref);
    await el.click({ timeout: 5000 }).catch(() => {});
    await el.fill(body.text);
    if (body.submit) await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const snap = await buildSnapshot(page);
    return resultBase({ snapshot: snap });
  }
  if (body.action === "press") {
    await page.keyboard.press(body.key);
    await page.waitForTimeout(200);
    const snap = await buildSnapshot(page);
    return resultBase({ snapshot: snap });
  }
  if (body.action === "scroll") {
    const dy = body.direction === "up" ? -600 : 600;
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(200);
    const snap = await buildSnapshot(page);
    return resultBase({ snapshot: snap });
  }

  return resultBase({ ok: false, note: "unknown action" });
}

const VIEWER_HTML = \`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="referrer" content="no-referrer"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Browser</title>
<style>
  html, body { margin: 0; height: 100%; background: #111; color: #eee; font: 13px system-ui, sans-serif; }
  #bar { display: flex; gap: 8px; align-items: center; padding: 8px 10px; background: #1a1a1a; border-bottom: 1px solid #333; }
  #bar button { background: #2a2a2a; color: #eee; border: 1px solid #444; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  #bar button:disabled { opacity: 0.4; cursor: default; }
  #status { flex: 1; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #wrap { position: relative; height: calc(100% - 41px); }
  canvas { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
</style>
</head>
<body>
  <div id="bar">
    <button id="takeover" type="button">Take over</button>
    <button id="handback" type="button" disabled>Hand back</button>
    <span id="status">Connecting…</span>
  </div>
  <div id="wrap"><canvas id="c"></canvas></div>
  <script>
    const secret = location.pathname.split("/").pop();
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");
    const status = document.getElementById("status");
    const takeover = document.getElementById("takeover");
    const handback = document.getElementById("handback");
    let mode = "agent";
    let ws;

    function setMode(m) {
      mode = m;
      takeover.disabled = mode === "user";
      handback.disabled = mode === "agent";
      status.textContent = mode === "user" ? "You have control" : "Agent has control";
    }

    function connect() {
      ws = new WebSocket(proto + "//" + location.host + "/ws?secret=" + encodeURIComponent(secret));
      ws.binaryType = "arraybuffer";
      ws.onopen = () => { status.textContent = mode === "user" ? "You have control" : "Agent has control"; };
      ws.onclose = () => { status.textContent = "Disconnected — retrying…"; setTimeout(connect, 1500); };
      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "control") setMode(msg.mode);
            if (msg.type === "frame") {
              // metadata only; frames arrive as binary
            }
          } catch {}
          return;
        }
        const blob = new Blob([ev.data], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (canvas.width !== img.width) canvas.width = img.width;
          if (canvas.height !== img.height) canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      };
    }

    function send(obj) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    }

    takeover.onclick = () => send({ type: "control", mode: "user" });
    handback.onclick = () => send({ type: "control", mode: "agent" });

    canvas.addEventListener("pointerdown", (e) => {
      if (mode !== "user") return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      send({ type: "pointer", event: "down", x, y, button: e.button });
    });
    canvas.addEventListener("pointerup", (e) => {
      if (mode !== "user") return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      send({ type: "pointer", event: "up", x, y, button: e.button });
    });
    canvas.addEventListener("pointermove", (e) => {
      if (mode !== "user") return;
      if (e.buttons === 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      send({ type: "pointer", event: "move", x, y, button: e.button });
    });
    window.addEventListener("keydown", (e) => {
      if (mode !== "user") return;
      send({ type: "key", event: "down", key: e.key });
      e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      if (mode !== "user") return;
      send({ type: "key", event: "up", key: e.key });
      e.preventDefault();
    });

    connect();
    setInterval(() => send({ type: "heartbeat" }), 20000);
  </script>
</body>
</html>\`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors " + FRAME_ANCESTORS + ";",
  );

  if (url.pathname.startsWith("/view/")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(VIEWER_HTML);
    return;
  }

  if (url.pathname === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/action" && req.method === "POST") {
    if (!authOk(req, url)) return unauthorized(res);
    try {
      const body = await readBody(req);
      const result = await handleAction(body);
      json(res, 200, result);
    } catch (err) {
      json(res, 500, {
        ok: false,
        controlMode,
        url: null,
        title: null,
        tabs: listTabs(),
        snapshot: null,
        note: err && err.message ? err.message : String(err),
      });
    }
    return;
  }

  json(res, 404, { ok: false, note: "not found" });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname !== "/ws" || url.searchParams.get("secret") !== SECRET) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    viewers.add(ws);
    ws.send(JSON.stringify({ type: "control", mode: controlMode }));
    startScreencast(ws).catch(() => {});
    ws.on("close", () => viewers.delete(ws));
    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === "control") {
        controlMode = msg.mode === "user" ? "user" : "agent";
        broadcast({ type: "control", mode: controlMode });
        return;
      }
      if (msg.type === "heartbeat") return;
      if (controlMode !== "user") return;
      const active = activePageId ? pages.get(activePageId) : null;
      if (!active) return;
      try {
        if (msg.type === "pointer") {
          if (msg.event === "move") await active.mouse.move(msg.x, msg.y);
          if (msg.event === "down") {
            await active.mouse.move(msg.x, msg.y);
            await active.mouse.down({ button: msg.button === 2 ? "right" : "left" });
          }
          if (msg.event === "up") {
            await active.mouse.move(msg.x, msg.y);
            await active.mouse.up({ button: msg.button === 2 ? "right" : "left" });
          }
        }
        if (msg.type === "key") {
          if (msg.event === "down") await active.keyboard.down(msg.key).catch(() => active.keyboard.press(msg.key));
          if (msg.event === "up") await active.keyboard.up(msg.key).catch(() => {});
        }
      } catch {}
    });
  });
});

/** @type {Map<any, import('playwright-core').CDPSession>} */
const screencasts = new Map();

async function startScreencast(ws) {
  await ensurePage();
  const page = activePageId ? pages.get(activePageId) : null;
  if (!page) return;
  const client = await page.context().newCDPSession(page);
  screencasts.set(ws, client);
  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 60,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 2,
  });
  client.on("Page.screencastFrame", async (frame) => {
    try {
      if (ws.readyState === 1) {
        ws.send(Buffer.from(frame.data, "base64"), { binary: true });
      }
      await client.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
    } catch {}
  });
  ws.on("close", async () => {
    const c = screencasts.get(ws);
    screencasts.delete(ws);
    if (c) {
      try {
        await c.send("Page.stopScreencast");
        await c.detach();
      } catch {}
    }
  });
}

ensurePage()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log("browser-control listening on " + PORT);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
`;
