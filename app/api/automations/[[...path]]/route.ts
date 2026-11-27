import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Eve serves these routes on its own process. Next only proxies `/eve/v1/*`,
 * so the mobile app and the web hub would 404 on `/api/automations` without
 * this forwarder. On Vercel the build publishes the same paths onto the eve
 * service, and this handler is the local / `next start` path.
 */
const FORWARDED_HEADERS = ["authorization", "cookie", "content-type", "accept"];

type RouteContext = {
  readonly params: Promise<{ readonly path?: readonly string[] }>;
};

async function eveOrigin(): Promise<string | null> {
  const fromEnv = process.env.EVE_BASE_URL?.trim();
  if (fromEnv) return new URL(fromEnv).origin;

  if (process.env.NODE_ENV !== "production") {
    try {
      const raw = await readFile(
        join(process.cwd(), ".eve/next-dev-server.json"),
        "utf8",
      );
      const parsed = JSON.parse(raw) as { readonly origin?: string };
      if (parsed.origin) return new URL(parsed.origin).origin;
    } catch {
      return null;
    }
    return null;
  }

  if (process.env.VERCEL) return null;

  const port = process.env.EVE_NEXT_PRODUCTION_PORT?.trim() || "4274";
  return `http://127.0.0.1:${port}`;
}

async function proxy(
  request: Request,
  path: readonly string[] | undefined,
): Promise<Response> {
  const origin = await eveOrigin();
  if (!origin) {
    return Response.json(
      { error: "Automations service is not running." },
      { status: 503 },
    );
  }

  const suffix =
    path && path.length > 0
      ? `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`
      : "";
  const incoming = new URL(request.url);
  const target = `${origin}/api/automations${suffix}${incoming.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Automations service is not running." },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
