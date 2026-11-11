import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";
import { verifyRelease } from "../scripts/verify-release.mjs";

const bytes = Buffer.from("a prepared release tarball");
const sha512 = createHash("sha512").update(bytes).digest("hex");
const receipt = { name: "raavl", version: "0.1.0", distTag: "latest", sha512 };
const tarballURL = "https://registry.npmjs.org/raavl/-/raavl-0.1.0.tgz";
const version = {
  name: receipt.name,
  version: receipt.version,
  dist: { tarball: tarballURL, integrity: `sha512-${Buffer.from(sha512, "hex").toString("base64")}` },
};
const metadata = { versions: { [receipt.version]: version }, "dist-tags": { latest: receipt.version } };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const options = (extra = {}) => ({ attempts: 3, retryDelayMs: 0, sleep: async () => {}, log: () => {}, ...extra });
const okFetch = async (url) => url === tarballURL ? new Response(bytes) : json(metadata);

test("waits for the version and tag, downloads anonymously, checks a fresh temporary artifact, and cleans up", async () => {
  let queries = 0, downloads = 0, checked = 0, directory;
  const delays = [];
  const original = structuredClone(receipt);
  await verifyRelease(receipt, options({
    attempts: 4,
    sleep: async (ms) => delays.push(ms),
    fetchImpl: async (url, init) => {
      assert.equal(init.credentials, "omit");
      assert(!Object.keys(init.headers).some((key) => /authorization/i.test(key)));
      assert(init.signal instanceof AbortSignal);
      assert.equal(init.headers["Cache-Control"], "no-cache");
      if (url === tarballURL) { downloads++; return new Response(bytes); }
      assert.equal(url, "https://registry.npmjs.org/raavl");
      queries++;
      if (queries === 1) return json({}, 404);
      if (queries === 2) return json({ versions: {} });
      if (queries === 3) return json({ ...metadata, "dist-tags": { latest: "0.0.9" } });
      return json(metadata);
    },
    checkPackage: (path, cache) => {
      checked++;
      assert.deepEqual(readFileSync(path), bytes);
      directory = dirname(path);
      assert.equal(dirname(cache), directory);
      assert(!existsSync(cache));
    },
  }));
  assert.equal(queries, 4);
  assert.equal(downloads, 1);
  assert.equal(checked, 1);
  assert.equal(delays.length, 3);
  assert(!existsSync(directory));
  assert.deepEqual(receipt, original);
});

for (const status of [429, 500, 503]) {
  test(`retries temporary HTTP ${status} failures`, async () => {
    let calls = 0, checked = false;
    await verifyRelease(receipt, options({
      fetchImpl: async (url) => ++calls === 1 ? json({}, status) : okFetch(url),
      checkPackage: () => { checked = true; },
    }));
    assert.equal(calls, 3);
    assert(checked);
  });
}

test("retries network and incomplete download failures", async () => {
  let attempts = 0, downloads = 0;
  await verifyRelease(receipt, options({
    attempts: 4,
    fetchImpl: async (url) => {
      if (url !== tarballURL && ++attempts === 1) throw new Error("connection reset");
      if (url === tarballURL && ++downloads === 1) {
        return { status: 200, ok: true, arrayBuffer: async () => { throw new Error("download interrupted"); } };
      }
      return okFetch(url);
    },
    checkPackage: () => {},
  }));
  assert.equal(attempts, 3);
  assert.equal(downloads, 2);
});

test("times out requests and stops after the configured attempt count", async () => {
  let calls = 0, sleeps = 0;
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async () => { calls++; throw new DOMException("Request timed out", "TimeoutError"); },
    sleep: async () => { sleeps++; },
    checkPackage: () => assert.fail("Must not check a missing package"),
  })), /after 3 attempts.*timed out/);
  assert.equal(calls, 3);
  assert.equal(sleeps, 2);
});

test("checks immediately and backs off between attempts when a version never appears", async () => {
  const events = [];
  await assert.rejects(verifyRelease(receipt, {
    fetchImpl: async () => { events.push("request"); return json({}, 404); },
    sleep: async (ms) => events.push(ms),
    log: () => {},
  }), /after 12 attempts.*HTTP 404/);
  assert.deepEqual(events, [
    "request", 5_000, "request", 10_000, "request", 20_000,
    ...Array.from({ length: 8 }, () => ["request", 30_000]).flat(),
    "request",
  ]);
});

test("fails clearly when the intended distribution tag never points to this version", async () => {
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async () => json({ ...metadata, "dist-tags": { latest: "0.0.9" } }),
  })), /latest tag points to 0.0.9; expected 0.1.0/);
});

test("uses the receipt's next tag for prereleases", async () => {
  const next = { ...receipt, version: "0.2.0-next.0", distTag: "next" };
  await verifyRelease(next, options({
    fetchImpl: async (url) => url === tarballURL ? new Response(bytes) : json({
      versions: { [next.version]: { ...version, version: next.version } },
      "dist-tags": { latest: "0.1.0", next: next.version },
    }),
    checkPackage: () => {},
  }));
});

for (const status of [401, 403]) {
  test(`does not retry anonymous access denied with HTTP ${status}`, async () => {
    let calls = 0;
    await assert.rejects(verifyRelease(receipt, options({
      fetchImpl: async () => { calls++; return json({}, status); },
    })), new RegExp(`Anonymous npm request failed: HTTP ${status}`));
    assert.equal(calls, 1);
  });
}

test("rejects different registry integrity before executing downloaded code", async () => {
  let calls = 0;
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async () => {
      calls++;
      return json({ ...metadata, versions: { [receipt.version]: { ...version, dist: { ...version.dist, integrity: "sha512-wrong" } } } });
    },
    checkPackage: () => assert.fail("Must not run mismatched code"),
  })), /Registry integrity differs/);
  assert.equal(calls, 1);
});

test("rejects corrupted downloads even when registry metadata claims the correct integrity", async () => {
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async (url) => url === tarballURL ? new Response("wrong bytes") : json(metadata),
    checkPackage: () => assert.fail("Must not run mismatched code"),
  })), /Downloaded tarball differs/);
});

test("cleans the temporary package and propagates consumer check failures", async () => {
  let directory;
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: okFetch,
    checkPackage: (path) => { directory = dirname(path); throw new Error("import failed"); },
  })), /import failed/);
  assert(!existsSync(directory));
});

test("rejects invalid receipts before making registry requests", async () => {
  for (const invalid of [null, {}, { ...receipt, sha512: "invalid" }, { ...receipt, distTag: "" }]) {
    await assert.rejects(verifyRelease(invalid, options({ fetchImpl: () => assert.fail("Must validate receipt first") })));
  }
});

test("rejects a registry response identifying a different version", async () => {
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async () => json({ ...metadata, versions: { [receipt.version]: { ...version, version: "0.0.1" } } }),
  })), /different version/);
});

test("aborts a stalled HTTP request at its deadline", async () => {
  let aborted = false;
  await assert.rejects(verifyRelease(receipt, options({
    attempts: 1,
    timeoutMs: 1,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      const guard = setTimeout(() => reject(new Error("Abort signal never fired")), 1000);
      signal.addEventListener("abort", () => {
        clearTimeout(guard);
        aborted = true;
        reject(signal.reason);
      }, { once: true });
    }),
  })), /after 1 attempts.*timeout/);
  assert(aborted);
});

test("rejects malformed registry metadata immediately", async () => {
  let calls = 0;
  await assert.rejects(verifyRelease(receipt, options({
    fetchImpl: async () => { calls++; return new Response("not json"); },
  })), /invalid package metadata/);
  assert.equal(calls, 1);
});
