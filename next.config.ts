import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec", "@xenova/transformers"],
  // A stray lockfile in the home directory makes Next mis-infer the workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
