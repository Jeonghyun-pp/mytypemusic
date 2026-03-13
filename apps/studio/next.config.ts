import path from "path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(__dirname, "../..");

// Load .env from monorepo root so API routes can access env vars
loadEnvConfig(monorepoRoot);

const config: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/api/design/render": [
      "../../agents/shared/templates/figma/**/*.svg",
      "../../agents/shared/templates/figma/_registry.json",
    ],
  },
  serverExternalPackages: ["@resvg/resvg-js", "satori", "@remotion/renderer", "@remotion/bundler", "@remotion/lambda", "jose"],

  // Resolve @agents/* for both webpack and turbopack
  webpack(webpackConfig) {
    webpackConfig.resolve.alias["@agents"] = path.resolve(monorepoRoot, "agents");
    return webpackConfig;
  },

  turbopack: {
    resolveAlias: {
      "@agents/shared/*": ["../../agents/shared/*"],
      "@agents/shared": ["../../agents/shared"],
    },
  },
};

export default config;
