import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";
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
  // @firecrawl/pdf-inspector ships a native .node binding that Turbopack
  // cannot bundle — require it from node_modules at runtime instead.
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withEve(withAui(nextConfig));
