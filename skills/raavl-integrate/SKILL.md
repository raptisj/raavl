---
name: raavl-integrate
description: "Integrate a raavl audio waveform player into an existing JavaScript or TypeScript app. Use when asked to add raavl, wire its playback controls, or extend an existing raavl integration with themes, supplied peaks, annotations, or optional modules."
---

# Integrate raavl

Add a working audio waveform player using the application's existing framework,
design, and controls. Keep additions within the requested audio experience.

## Read the current contract

When the user provides a raavl documentation URL, read its `/llms.txt` index and
fetch only the relevant Markdown pages. The full reference is `/llms-full.txt`.
When a raavl checkout is available, read the matching files in
`docs/content/docs/` and inspect the exported types in `src/` as needed.

If neither is available, the maintained guides are in the raavl repository:

- [Quickstart](https://github.com/raptisj/raavl/blob/main/docs/content/docs/quickstart.mdx): installation and a first JavaScript or React player.
- [Sources](https://github.com/raptisj/raavl/blob/main/docs/content/docs/sources.mdx): URL, File/Blob, borrowed media, and supplied peaks.
- [Player](https://github.com/raptisj/raavl/blob/main/docs/content/docs/player.mdx), [waveform](https://github.com/raptisj/raavl/blob/main/docs/content/docs/waveform.mdx), and [React](https://github.com/raptisj/raavl/blob/main/docs/content/docs/react.mdx): use the reference matching the selected API.
- [Styling](https://github.com/raptisj/raavl/blob/main/docs/content/docs/styling.mdx): CSS tokens and validated JSON themes.
- [Annotations](https://github.com/raptisj/raavl/blob/main/docs/content/docs/annotations.mdx) and [optional modules](https://github.com/raptisj/raavl/blob/main/docs/content/docs/modules.mdx): read when the requested task needs them.
- [State and errors](https://github.com/raptisj/raavl/blob/main/docs/content/docs/errors.mdx): separate playback and visualization failures.

Match documentation to the installed version. If documentation cannot be fetched,
use the available checkout or installed declarations; report missing information
instead of inventing APIs. Historical proposals under `docs/design/` may describe
unimplemented features.

## Choose an integration

Inspect the consuming app's package manager, package boundaries, framework,
React version, asset serving, existing player code, and design conventions.

- For React 19 with React DOM 19, use `Waveform` and hooks from `raavl/react`.
  In Next.js App Router, place the interactive integration in a client component.
- For vanilla JavaScript, other frameworks, or an app retaining another React
  version, use `createPlayer` and `mountWaveform` through browser lifecycle hooks.
  Preserve the app's framework version unless upgrading it is part of the task.
- Reuse an application-owned media element when the app already owns playback.
  That source requires supplied peaks or `waveform: { kind: 'none' }`.

Follow the quickstart's installation command using the consuming application's
package manager. Match the installed package version to the documentation and
reuse an existing compatible dependency when present.

## Build the requested experience

Use the quickstart and API references for code. Add a waveform and the controls
the user needs, using the app's existing components, colors, and spacing.

- Supply a real audio URL, File/Blob, or borrowed media source with a stable ID.
  Demo recordings from the documentation site are not installed package assets.
- Handle source loading, waveform preparation, buffering, and playback errors
  separately. Metadata readiness does not guarantee a waveform or buffered audio.
- Start playback from a user gesture and handle rejected `play()` promises.
- Keep accessible names, real buttons, and keyboard/touch seeking available.
- Prefer supplied peaks for long recordings instead of decoding the entire audio
  solely for visualization. Verify source ID, revision, and duration match.
- Add a theme, annotations, timeline, minimap, history, or snapping only when the
  requested experience calls for it. Application code owns persistence.

## Preserve ownership

In React, choose an owned `source` or a borrowed `player`, never both. An owned
`Waveform` cleans up its own resources; a supplied player or annotation store
remains application-owned. Keep large peak buffers, Files, and request objects
stable; update source revisions when asset data changes.

With the DOM API, unsubscribe listeners and dispose mounted accessories and
views before the owned player/store during teardown. Disposing a view does not
dispose its borrowed player. Borrowed media must remain application-owned.

All time commands use seconds except `seekFraction()`, which takes a fraction
in `[0, 1]`. After external CSS color changes, call `view.refreshTheme()` or
change React's `themeVersion`; Canvas needs a redraw to reflect computed colors.

## Verify and report

Run checks appropriate to the consuming app and exercise real playback,
pause/resume, pointer and keyboard seeking, source replacement, visible errors,
and component cleanup. Verify waveform CORS separately from native playback for
cross-origin audio. When a browser, agent environment, or audio source is
unavailable, identify the unverified behavior explicitly.

Report the integration chosen, changed files, commands to run, and verification
results. Keep browser-dependent timing claims accurate: range playback uses
best-effort media timing. Recording, spectrograms, sample-accurate playback, and
automatic backend storage are not implemented.
