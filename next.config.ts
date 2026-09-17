import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // @firecrawl/pdf-inspector ships a native .node binding that Turbopack
  // cannot bundle — require it from node_modules at runtime instead.
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withEve(withAui(nextConfig));
