# Releasing raavl

One package, one version, manual publication. GitHub Actions validates pull
requests and main; it has no publishing credentials and never publishes.

## Prepare a version

Start from clean, up-to-date main. Review CI and the changes since the last tag:

```sh
git switch main
git pull --ff-only
git fetch --tags origin
git status --short
git log --oneline -20
```

For the first release, inspect the changes without a previous tag and keep the
prepared `0.1.0` version. For subsequent releases, choose a version:

```sh
npm version patch --no-git-tag-version
```

Use `minor` for new features. Before 1.0, breaking changes also increment minor
and must include migration notes. After 1.0, breaking changes increment major.
Exports, public types, CSS hooks/tokens, and serialized formats are part of the
public API. Internal and test-only changes do not require a release.

Add a `## X.Y.Z` entry to CHANGELOG.md, describing changes for consumers. Include
the release date when ready. Commit the version, lockfile, and changelog using
`Release vX.Y.Z` as the commit title. Push the commit and wait for CI to pass.

## Validate and pack

```sh
npm run release:prepare
```

This requires a clean checkout and an unused version tag. It runs the source
checks, builds from scratch, packs the package, and validates the tarball using
publint, Are the Types Wrong, isolated Node/TypeScript consumers, SSR, a
production Vite app, and native audio playback in Chromium. It writes:

- `artifacts/raavl-X.Y.Z.tgz`: the tested package.
- The accompanying `.sha512` checksum.
- `artifacts/release.json`: version, source commit, tag, and checksum.

The script prints the exact next commands. It never publishes or changes Git
history. If validation fails, fix the issue, commit it, and prepare again.

## Publish manually

Use the commands printed by preparation, for example:

```sh
shasum -a 512 -c artifacts/raavl-0.1.0.tgz.sha512
npm publish ./artifacts/raavl-0.1.0.tgz --access public --tag latest
```

Complete npm's interactive authentication. Publish the tested tarball; do not
rebuild between validation and publishing. Bare `npm publish` from the checkout
is deliberately blocked by `prepublishOnly`. Normal `npm pack` remains available
and builds first, but only `release:prepare` produces a release receipt after
all checks pass. Treat the tarball and receipt as a pair; rerunning package
checks invalidates the previous receipt.

## Verify publication

After npm confirms publication, run:

```sh
npm run release:verify
```

This reads `artifacts/release.json` and verifies the exact recorded release:

1. Query public npm anonymously for the version and its `latest` or `next` tag.
2. Download the tarball directly, bypassing your existing npm cache.
3. Match both npm's integrity metadata and the downloaded SHA-512 checksum to
   the validated release receipt.
4. Install the downloaded tarball in a temporary consumer with a fresh npm cache.
   Reuse the package metadata, vanilla imports without React, React SSR,
   NodeNext/bundler TypeScript, CSS, JSON, and production Vite checks.

Registry propagation, temporary server errors, and network failures are retried
up to 12 times, with 5 seconds between attempts and a 10-second timeout per
request. Integrity mismatches and access errors fail immediately. A successful
run prints `Verified published raavl@X.Y.Z from public npm` and exits zero;
failures exit nonzero with the reason.

Verification does not publish, change distribution tags, rebuild, repack, or
invalidate your release receipt. It cleans up its temporary download, cache,
and consumer. Keep the original receipt after publication; do not regenerate it
just to verify an already published version. You can specify a saved receipt:

```sh
npm run release:verify -- /path/to/release.json
```

The verifier uses the receipt's version, not whichever version `latest` happens
to select. It requires the recorded tag to point to that version, so run it
before moving that tag to a later release. It needs the repository's development
dependencies (`npm ci`), but does not need npm login or a local `dist` directory.
Chromium playback is checked before publication by `release:prepare`; the
post-publication check builds the consumer app without launching a browser.

If verification fails, inspect the error and retry verification when appropriate.
Do not automatically publish again: the version may already exist. A different
published tarball needs investigation and a new version rather than overwriting.

## Tag and create a GitHub release

After verification succeeds, tag the **commit recorded in release.json**:

```sh
git tag -a v0.1.0 SOURCE_COMMIT -m "Release v0.1.0"
git push origin v0.1.0
```

Create a GitHub release from that tag, using the changelog entry as its notes.
The GitHub website is sufficient; no extra CLI or automation is needed.

## Prereleases and recovery

For previews, set a version such as `0.2.0-next.0` with
`npm version 0.2.0-next.0 --no-git-tag-version`, add its changelog entry, and use
the same process. Preparation prints `--tag next` for prerelease versions.
Consumers opt in with `npm install raavl@next`; stable versions use `latest`.

If publication fails, inspect npm before retrying: the registry may have
accepted the upload even if the command lost its connection. Retry the same
validated tarball only when the version is absent. If npm publication succeeded
but tagging or the GitHub release failed, finish those steps at the recorded
commit; do not bump and republish just to recreate release metadata.

Published versions cannot be overwritten. Fix a bad release with a new version;
use `npm deprecate raavl@X.Y.Z "Upgrade to X.Y.Z"` when consumers need a warning.
