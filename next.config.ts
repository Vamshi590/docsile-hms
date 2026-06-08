import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native-binary deps used by the social module's image renderer. Bundlers
  // can't trace platform-specific .node files, so we mark them external and
  // let Node's runtime require() resolve them directly from node_modules.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
};

export default nextConfig;
