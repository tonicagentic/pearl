import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default withEve(withAui(nextConfig));
