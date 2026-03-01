import path from "path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load .env from monorepo root so API routes can access env vars
loadEnvConfig(path.resolve(__dirname, "../.."));

const config: NextConfig = {
  // API-only for now; no static pages needed
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  serverExternalPackages: ["@resvg/resvg-js", "satori", "@remotion/renderer", "@remotion/bundler"],

  // Resolve @agents/* for both webpack and turbopack
  webpack(webpackConfig) {
    webpackConfig.resolve.alias["@agents"] = path.resolve(__dirname, "../../agents");
    return webpackConfig;
  },

  // Turbopack: relative paths to avoid Windows absolute-path limitation
  turbopack: {
    resolveAlias: {
      "@agents/shared/*": ["../../agents/shared/*"],
      "@agents/shared": ["../../agents/shared"],
    },
  },
};

export default config;
