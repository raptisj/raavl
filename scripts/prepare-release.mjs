import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tag = `v${pkg.version}`;
const distTag = pkg.version.includes("-") ? "next" : "latest";
const clean = () => assert.equal(git("status", "--porcelain"), "", "Commit or set aside local changes before preparing a release.");
mkdirSync(join(root, "artifacts"), { recursive: true });
rmSync(join(root, "artifacts/release.json"), { force: true });
clean();
assert.equal(git("branch", "--show-current"), "main", "Prepare releases from main.");
assert.equal(pkg.private, undefined, "The package must be public.");
assert.notEqual(pkg.version, "0.0.0", "Choose a release version first.");
assert.equal(git("tag", "--list", tag), "", `${tag} already exists; choose a new version or finish the existing release.`);
const heading = new RegExp(`^## ${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "m");
assert(heading.test(readFileSync(join(root, "CHANGELOG.md"), "utf8")), `Add a CHANGELOG.md entry for ${pkg.version}.`);
const commit = git("rev-parse", "HEAD");
execFileSync("npm", ["run", "check:release"], { cwd: root, stdio: "inherit" });
clean();
assert.equal(git("rev-parse", "HEAD"), commit, "HEAD changed during release validation.");
const filename = `${pkg.name}-${pkg.version}.tgz`;
const tarball = `./artifacts/${filename}`;
const sha512 = createHash("sha512").update(readFileSync(join(root, tarball))).digest("hex");
writeFileSync(join(root, `${tarball}.sha512`), `${sha512}  ${tarball}\n`);
writeFileSync(join(root, "artifacts/release.json"), JSON.stringify({ name: pkg.name, version: pkg.version, commit, tag, distTag, tarball, sha512 }, null, 2) + "\n");
console.log(`
Release validated: ${pkg.name}@${pkg.version}
Commit: ${commit}

If the validated commit is still local, push it to main:
  git push origin main

After CI passes for the validated commit, publish manually from the repository root:
  shasum -a 512 -c ${tarball}.sha512
  npm publish ${tarball} --access public --tag ${distTag}

After npm confirms publication:
  npm run release:verify

After verification succeeds:
  git tag -a ${tag} ${commit} -m "Release ${tag}"
  git push origin ${tag}

See RELEASING.md for first-publish setup, GitHub release notes, and recovery.
Nothing was published, tagged, or pushed.`);
