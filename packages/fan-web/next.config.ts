import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This package has its own git repo nested inside the LeagueLive workspace, so
  // Turbopack's git-boundary detection would otherwise stop here instead of at the
  // workspace root where shared deps (next, react) are hoisted.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
