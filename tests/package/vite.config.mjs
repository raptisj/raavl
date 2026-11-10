import { defineConfig } from "vite";

export default defineConfig({
  root: process.env.RAAVL_CONSUMER_DIR,
  esbuild: { jsx: "automatic" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      onwarn(warning, warn) {
        // This fixture is a browser SPA; its final bundle has no RSC boundary.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes("use client")
        )
          return;
        warn(warning);
      },
    },
  },
});
