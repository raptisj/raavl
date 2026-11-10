import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

// The library is an ESM module tree. tsc preserves client directives and keeps
// JavaScript and declarations at the same paths; no post-build rewriting.
rmSync(new URL("../dist/", import.meta.url), { recursive: true, force: true });
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"], {
  stdio: "inherit",
  cwd: new URL("../", import.meta.url),
});
mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
for (const file of ["styles.css", "styles.d.css.ts"]) {
  cpSync(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
}
