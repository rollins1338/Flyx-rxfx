// OpenNext configuration for Cloudflare Pages deployment
// See: https://opennext.js.org/cloudflare

import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    // Use Cloudflare's edge runtime
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      // Use Cloudflare's cache API
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },

  // Middleware configuration
  middleware: {
    external: true,
  },

  // Build options
  buildCommand: "npx next build",

  // Dangerous options (use with caution)
  dangerous: {
    // Disable tag cache revalidation (not supported on Cloudflare)
    disableTagCache: true,
    // Disable incremental cache (use Cloudflare KV instead if needed)
    disableIncrementalCache: true,
  },
};

export default config;
