import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const registry = "https://registry.npmjs.org/";
class NotReady extends Error {}

function validateReceipt(receipt) {
  assert(receipt && typeof receipt === "object", "Invalid release receipt.");
  for (const field of ["name", "version", "distTag"]) {
    assert(typeof receipt[field] === "string" && receipt[field].length > 0, `Release receipt is missing ${field}.`);
  }
  assert(typeof receipt.sha512 === "string" && /^[a-f\d]{128}$/i.test(receipt.sha512), "Release receipt must contain the prepared tarball's SHA-512 checksum.");
}

async function request(url, fetchImpl, timeoutMs, accept = "application/json") {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept, "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(timeoutMs),
      // Verification must work without the maintainer's npm credentials.
      credentials: "omit",
    });
  } catch (error) {
    throw new NotReady(`Cannot reach npm: ${error.message}`);
  }
  if ([404, 408, 429].includes(response.status) || response.status >= 500) {
    throw new NotReady(`npm returned HTTP ${response.status} for ${url}`);
  }
  assert(response.ok, `Anonymous npm request failed: HTTP ${response.status} for ${url}`);
  return response;
}

function checkDownloadedPackage(tarball, cache) {
  const npmrc = `${cache}.npmrc`, globalNpmrc = `${cache}.global.npmrc`;
  writeFileSync(npmrc, "");
  writeFileSync(globalNpmrc, "");
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^npm_config_/i.test(key) &&
    !["NPM_TOKEN", "NODE_AUTH_TOKEN"].includes(key.toUpperCase()),
  ));
  execFileSync(process.execPath, [join(root, "scripts/check-package.mjs"), "--tarball", tarball], {
    cwd: root,
    stdio: "inherit",
    timeout: 120_000,
    env: {
      ...environment,
      npm_config_userconfig: npmrc,
      npm_config_globalconfig: globalNpmrc,
      npm_config_cache: cache,
      npm_config_registry: registry,
      npm_config_prefer_online: "true",
      npm_config_fetch_retries: "0",
      npm_config_fetch_timeout: "10000",
    },
  });
}

// Inject requests and the consumer check so propagation and failure cases can
// be tested without publishing anything or depending on registry availability.
export async function verifyRelease(receipt, {
  fetchImpl = globalThis.fetch,
  attempts = 12,
  retryDelayMs = 5_000,
  timeoutMs = 10_000,
  sleep = setTimeout,
  checkPackage = checkDownloadedPackage,
  log = console.log,
} = {}) {
  validateReceipt(receipt);
  assert(Number.isInteger(attempts) && attempts > 0, "attempts must be a positive integer.");
  const expectedHash = receipt.sha512.toLowerCase();
  const expectedIntegrity = `sha512-${Buffer.from(expectedHash, "hex").toString("base64")}`;
  const metadataURL = new URL(encodeURIComponent(receipt.name), registry).href;
  const maxRetryDelayMs = 30_000;
  let delayMs = Math.min(retryDelayMs, maxRetryDelayMs);
  let bytes;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await request(metadataURL, fetchImpl, timeoutMs);
      let metadata;
      try {
        metadata = await response.json();
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error("npm returned invalid package metadata.", { cause: error });
        throw new NotReady(`npm metadata download failed: ${error.message}`);
      }
      assert(metadata && typeof metadata === "object", "npm returned invalid package metadata.");
      const version = metadata.versions?.[receipt.version];
      if (!version) throw new NotReady(`${receipt.name}@${receipt.version} is not visible yet.`);
      assert.equal(version.name, receipt.name, "Registry returned a different package name.");
      assert.equal(version.version, receipt.version, "Registry returned a different version.");
      const taggedVersion = metadata["dist-tags"]?.[receipt.distTag];
      if (taggedVersion !== receipt.version) {
        throw new NotReady(`The ${receipt.distTag} tag points to ${taggedVersion ?? "nothing"}; expected ${receipt.version}.`);
      }
      assert(version.dist?.integrity?.split(/\s+/).includes(expectedIntegrity), "Registry integrity differs from the validated release. Do not republish this version; inspect the published artifact.");
      const downloadURL = new URL(version.dist.tarball);
      assert.equal(downloadURL.protocol, "https:", "npm must supply an HTTPS tarball URL.");
      const download = await request(downloadURL.href, fetchImpl, timeoutMs, "*/*");
      try {
        bytes = Buffer.from(await download.arrayBuffer());
      } catch (error) {
        throw new NotReady(`Tarball download failed: ${error.message}`);
      }
      const hash = createHash("sha512").update(bytes).digest("hex");
      assert.equal(hash, expectedHash, "Downloaded tarball differs from the validated release. Do not republish this version; inspect the published artifact.");
      break;
    } catch (error) {
      if (!(error instanceof NotReady)) throw error;
      if (attempt === attempts) {
        throw new Error(`Could not verify ${receipt.name}@${receipt.version} after ${attempts} attempts: ${error.message}`, { cause: error });
      }
      log(`Waiting for npm (${attempt}/${attempts}): ${error.message} Retrying in ${delayMs / 1000}s.`);
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, maxRetryDelayMs);
    }
  }

  const directory = mkdtempSync(join(tmpdir(), "raavl-published-"));
  try {
    const tarball = join(directory, "package.tgz");
    writeFileSync(tarball, bytes);
    log(`Downloaded ${receipt.name}@${receipt.version}; SHA-512 and ${receipt.distTag} tag match the release receipt.`);
    // This mode never builds, repacks, or invalidates artifacts/release.json.
    await checkPackage(tarball, join(directory, "npm-cache"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  log(`Verified published ${receipt.name}@${receipt.version} from public npm. Nothing was published or changed on npm.`);
}

async function main() {
  assert(process.argv.length <= 3, "Usage: npm run release:verify -- [path/to/release.json]");
  const receiptPath = resolve(root, process.argv[2] ?? "artifacts/release.json");
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read release receipt at ${receiptPath}. Keep the receipt created by release:prepare before publishing. ${error.message}`);
  }
  validateReceipt(receipt);
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(receipt.name, pkg.name, "Release receipt belongs to a different package.");
  await verifyRelease(receipt);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`release:verify failed: ${error.message}`);
    process.exitCode = 1;
  });
}
