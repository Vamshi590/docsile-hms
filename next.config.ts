import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native-binary deps used by the social module's image renderer. Bundlers
  // can't trace platform-specific .node files, so we mark them external and
  // let Node's runtime require() resolve them directly from node_modules.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  experimental: {
    serverActions: {
      // Social "Generate from photos" accepts up to 5 × 10 MB images plus
      // form fields. Next.js' 1 MB default rejects the upload outright.
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
