import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  outputDir: "../../test-results",
  workers: 1,
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    command:
      "node node_modules/vite/bin/vite.js preview --config tests/package/vite.config.mjs --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
