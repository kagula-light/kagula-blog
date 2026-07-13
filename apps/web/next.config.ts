import { resolve } from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@kagura/config", "@kagura/contracts", "@kagura/database"],
};

export default nextConfig;
