import { defineTool } from "eve/tools";
import { z } from "zod";

import { requireCoderUserId } from "@/lib/coder/principal";
import { getVercelUserToken } from "@/lib/connections/tokens";

export default defineTool({
  description:
    "Read runtime logs for a Vercel deployment (read-only). Use when a " +
    "preview is unhealthy. Never returns environment variable values.",
  inputSchema: z.object({
    deploymentId: z
      .string()
      .min(1)
      .describe("Vercel deployment id or url hostname."),
  }),
  async execute(input, ctx) {
    const auth = requireCoderUserId(ctx.session.auth.current);
    if ("error" in auth) return { status: "error", error: auth.error };

    let token: string;
    try {
      token = await getVercelUserToken(auth.userId);
    } catch (cause) {
      return {
        status: "error",
        error: cause instanceof Error ? cause.message : "Vercel token unavailable.",
      };
    }

    const id = input.deploymentId.replace(/^https?:\/\//, "").split("/")[0]!;
    const res = await fetch(
      `https://api.vercel.com/v2/deployments/${encodeURIComponent(id)}/events?direction=backward&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      return {
        status: "error",
        error: `Vercel logs → ${res.status}: ${body.slice(0, 400)}`,
      };
    }

    const events = (await res.json()) as unknown;
    const lines = Array.isArray(events)
      ? events
          .map((event) => {
            if (!event || typeof event !== "object") return null;
            const row = event as Record<string, unknown>;
            const text =
              typeof row.text === "string"
                ? row.text
                : typeof row.payload === "object" &&
                    row.payload &&
                    typeof (row.payload as { text?: string }).text === "string"
                  ? (row.payload as { text: string }).text
                  : null;
            return text;
          })
          .filter((line): line is string => Boolean(line))
      : [];

    return {
      status: "ok",
      deploymentId: id,
      lines: lines.slice(0, 50).map(stripEnvShapes),
    };
  },
});

/** Best-effort scrub of KEY=value patterns so logs don't echo secrets. */
function stripEnvShapes(line: string): string {
  return line.replace(
    /\b([A-Z][A-Z0-9_]{2,})=([^\s]+)/g,
    (_, key: string) => `${key}=[redacted]`,
  );
}
