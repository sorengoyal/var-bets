import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@var-bets/dashboard-contract"],
};

export default nextConfig;
