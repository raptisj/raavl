import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist/library",
    lib: {
      entry: {
        index: "src/index.ts",
        core: "src/core/index.ts",
        dom: "src/dom/index.ts",
        react: "src/react/index.tsx",
        themes: "src/themes/index.ts",
        regions: "src/regions/index.ts",
        timeline: "src/timeline/index.ts",
        minimap: "src/minimap/index.ts",
        history: "src/history/index.ts",
        snapping: "src/snapping/index.ts",
      },
      formats: ["es"],
    },
    rollupOptions: { external: ["react", "react/jsx-runtime", "react-dom"] },
  },
});
