import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Workspace package is consumed from TypeScript source; Next compiles it.
  transpilePackages: ["@calibrum/poo"],
  // Model contracts and evidence are imported from ../../engine — keep the monorepo root as the tracing root.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  turbopack: { root: path.join(__dirname, "../../") },
};

export default nextConfig;
