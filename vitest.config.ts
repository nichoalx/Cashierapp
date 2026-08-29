import { defineConfig } from "vitest/config";

// Standalone config so Vitest does not pull in the app's Vite plugins
// (React/Tailwind/PWA). The edge-runtime environment is required by convex-test.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
