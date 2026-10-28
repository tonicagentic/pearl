import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";
import { withDurableHarness } from "durable-harness/next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Composer attachments travel inline (base64 data URLs) inside the
    // message, and the chat template persists every event through server
    // actions. The default 1 MB limit rejects image attachments.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Native addons / packages that Turbopack cannot bundle.
  serverExternalPackages: [
    "@firecrawl/pdf-inspector",
    "libfx",
    "durable-harness",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

// withDurableHarness discovers lib/apps/fx-agent.ts (createFxAgent) and mounts
// libfx's wake handler on its own queue topic, separate from eve.
export default withDurableHarness(withEve(withAui(nextConfig)), {
  agents: ["lib/apps/fx-agent.ts"],
});
