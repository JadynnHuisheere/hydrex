import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const outputFileTracingRoot = fileURLToPath(new URL("./", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;