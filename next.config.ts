import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";
import { withEve } from "eve/next";

/** Phone → Mac LAN IP for Next.js 16 allowedDevOrigins (hostname only). */
function localLanDevOrigins(): string[] {
  try {
    const hosts = new Set<string>(["127.0.0.1"]);
    for (const addrs of Object.values(networkInterfaces())) {
      for (const addr of addrs ?? []) {
        if (addr.family === "IPv4" && !addr.internal) hosts.add(addr.address);
      }
    }
    return [...hosts];
  } catch {
    return ["127.0.0.1"];
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: localLanDevOrigins(),
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
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withEve(withAui(nextConfig));
