# raavl product reference

This document describes the features implemented in this repository. It is the
starting point for agents planning changes, answering product questions, or
building integrations. Update it whenever shipped behavior, public APIs, or
product limits change. Last reviewed against the source: 2026-11-10.

## Product and status

raavl is a TypeScript audio waveform player and annotation toolkit for vanilla
JavaScript and React. Applications can play finite recordings, visualize audio,
edit regions and markers, and compose navigation and editing tools around a
shared player. The controller, visual view, and annotation data have separate
lifecycles so applications can use them independently.

Phases 2–5 are implemented. The package is private and intended for local
development; it is not a published release. Optional recording and spectrogram
modules have been assessed but are not implemented.

The source and exported types determine actual behavior. This document records
current product capabilities. `docs/design/` contains historical proposals that
may exceed the implemented API.

## Feature inventory

| Area                 | Available capabilities                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Audio sources        | URL, local File/Blob, borrowed HTML media element; source ID and optional revision                                                         |
| Playback             | Play, pause, seek, volume, mute, speed, full-recording loop, best-effort range play/loop                                                   |
| Visualization        | Multichannel min/max peaks, browser decoding, supplied peaks, data-only views, line/bars rendering                                         |
| Navigation           | Fit or numeric zoom, horizontal scrolling, playhead following, viewport subscriptions, timeline, minimap                                   |
| Annotations          | Regions, markers, labels, channel-specific regions, metadata, locks, selection, move/resize/delete                                         |
| Editing ownership    | Library-owned store, application-controlled document/revision, React defaults or borrowed store                                            |
| Editing helpers      | Grid snapping, optional magnetic snapping, immutable undo/redo history                                                                     |
| Persistence          | Validated annotation JSON import/export; application-owned storage                                                                         |
| Interaction          | Mouse, touch, keyboard seeking and editing, accessible annotation list and viewport slider                                                 |
| Integration          | Typed ESM entry points, React component/hooks, SSR-safe imports, optional CSS theme                                                        |
| Developer experience | Public Fumadocs site, agent-readable Markdown, interactive examples, browser API reference, copyable snippets, scale lab, automated checks |

## Audio sources, preparation, and playback

`createPlayer()` returns an independent controller. Multiple controllers can play
independent sources; multiple views can borrow the same controller.

Sources require a nonempty `id` and support an optional `revision`:

- `kind: 'url'`: native media playback from `url`; optional `request` options for
  the separate visualization fetch.
- `kind: 'file'`: a local `File` or `Blob`, played through a library-created
  object URL. The library does not upload it.
- `kind: 'media'`: an existing `HTMLMediaElement`. The library borrows it without
  assigning its source. Explicit supplied peaks or `waveform: { kind: 'none' }`
  are required; implicit decoding is unavailable for borrowed media.

URL and file sources default to `waveform: { kind: 'decode' }`. Applications may
instead provide `{ kind: 'peaks', data }` or disable preparation with
`{ kind: 'none' }`. Playback and visualization preparation are independent.
`setSource(source, { signal? })` resolves after finite audio metadata is available,
before visualization necessarily finishes or playback is buffered.

| Player API                                 | Product behavior                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `play()` / `pause()`                       | Start/resume and pause audio; handle the play promise, including autoplay failures |
| `seek(seconds)` / `seekFraction(fraction)` | Seek in seconds or a fraction in `[0, 1]`; seconds above duration clamp to the end |
| `setVolume(value)` / `setMuted(value)`     | Volume in `[0, 1]` and independent mute control                                    |
| `setPlaybackRate(rate)`                    | Speed from 0.25× through 4×                                                        |
| `setLoop(boolean)`                         | Native full-recording looping                                                      |
| `playRange({ start, end, loop? })`         | Play or loop a finite interval within the recording; resolves when playback starts |
| `setSource()` / `clearSource()`            | Replace the active asset or release it and return to idle                          |
| `getMediaElement()`                        | Access the current underlying media element, or null                               |
| `getSnapshot()` / `subscribe()`            | Read and observe semantic state; subscription returns an unsubscribe function      |
| `getCurrentTime()` / `subscribeTime()`     | Read and observe a separate cached playback clock                                  |
| `dispose()`                                | Release owned resources and subscriptions; repeated disposal is safe               |

Range playback uses best-effort HTML media timing. It disables full-recording
looping. Pause, explicit seek, source replacement, or disposal clears range
scheduling. Browser scheduling can cause overshoot or gaps.

Source replacement cancels the previous loading pipeline. An unfinished metadata
promise rejects with `CANCELLED`; stale loading, decoding, and play results cannot
overwrite the current state. Abort signals support explicit loading cancellation.
An in-progress browser decode itself cannot be interrupted; its stale result is
ignored and decoder resources are released when it settles.

Owned audio is paused/reset on replacement or disposal, and created object URLs
are revoked. Detaching a view never disposes its borrowed player. Disposal of a
player does not pause, reset, or remove borrowed media; explicit playback commands
still control it. After player disposal, reads expose final state and mutating
commands fail with `DISPOSED`.

## Observable state and errors

The player exposes separate state dimensions:

| Snapshot field                            | Values or purpose                                                |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `source`                                  | `idle`, `loading`, `ready`, `error`, `disposed`                  |
| `playback`                                | `paused`, `starting`, `playing`, `buffering`, `ended`            |
| `waveform`                                | `idle`, `fetching`, `decoding`, `ready`, `error`, `cancelled`    |
| `canPlay`                                 | Browser media readiness, separate from source metadata readiness |
| `sourceId`, `duration`, `data`            | Asset identity, duration in seconds, prepared peaks or null      |
| `volume`, `muted`, `playbackRate`, `loop` | Current media settings                                           |
| `error`, `waveformError`                  | Audio/playback error and independent visualization error         |

A visualization failure can coexist with working audio playback. `RaavlError`
provides `code`, `stage`, optional `sourceId`, and an underlying cause where
available. Codes are `CANCELLED`, `DISPOSED`, `INVALID_DATA`, `NETWORK`, `DECODE`,
`MEDIA`, `NOT_READY`, and `DURATION_MISMATCH`. Stages are `source`, `waveform`,
`playback`, `lifecycle`, and `view`. Cancellation can identify `superseded`,
`aborted`, `disposed`, or `cleared` as its reason.

## Visualization and viewport

`mountWaveform(container, options)` accepts exactly one `player` or immutable
`data` source. A data-only view renders without allocating audio playback.
Canvas displays each channel in its own vertical band, plus played progress and
a playhead for player-backed views. Canvas allocation follows the visible
viewport and device pixel ratio, capped at 3, rather than recording length.

| Configuration      | Options and defaults                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme`            | Versioned JSON theme or null; presets `sage`, `studio`, `neon`, `paper` from `raavl/themes`                                                                                         |
| `appearance`       | `style: 'line'` (or `'bars'`), `height: 160`, `lineWidth: 1`, `barWidth: 2`, `barGap: 1`, `barRadius: 0`, `amplitude: 0.9`, `cursorWidth: 2`, `borderRadius: 8`, `normalize: false` |
| `viewport`         | `zoom: 'fit'` (or pixels per second), `follow: 'visible'` (or `'off'`, `'center'`)                                                                                                  |
| `interaction`      | `seek: 'click'` (or `'off'`), `drag: 'none'` (or `'seek'`, `'select'`)                                                                                                              |
| Other view options | Accessible `label`, `onDraw`, annotation options and callbacks                                                                                                                      |

`view.update()` changes configuration without replacing the player. Vanilla
updates merge fields within groups; explicit `undefined` resets a field to its
default. Data-only views can replace peaks through `update({ data })`.
`refreshTheme()` redraws Canvas colors after external CSS changes.

`getViewport()` returns a cached frozen snapshot containing `sourceId`, `duration`,
`start`, `end`, `width`, `pixelsPerSecond`, and `disposed`. Times use seconds;
width uses CSS pixels. `subscribeViewport()` observes changes and returns an
unsubscribe function. Initial geometry is zero until layout.
`scrollTo(seconds)` positions the left edge within valid bounds without seeking
audio. Use `follow: 'off'` for application-controlled navigation during playback.

### Peak data

The version 1 format contains `sourceId`, optional `sourceRevision`, positive
finite `duration`, and one or more channels. Each channel has `min` and `max`
arrays, using `Float32Array` or readonly numeric arrays. All arrays have the same
nonzero length and describe uniform time buckets. Each bucket requires finite
`-1 <= min <= max <= 1`.

`validateWaveform()` validates structure and amplitudes. The player additionally
checks source ID/revision and duration, allowing duration differences up to
`max(0.1 seconds, audio duration × 0.001)`. `createPeaks()` derives up to 24,000
min/max buckets per channel from an AudioBuffer-compatible object. Supplied peak
buffers remain caller-owned and must not be mutated while in use.

## Regions, markers, and selections

Annotations use a version 1 document: `{ version, sourceId, regions, markers }`.
Regions have unique `id`, finite `0 <= start < end`, optional `label`, `locked`,
JSON `metadata`, and zero-based `channel`. Omitting `channel` spans all channels.
Markers have unique `id`, finite nonnegative `time`, and optional `label`,
`locked`, and JSON `metadata`. IDs are unique across both arrays; overlaps are
allowed. Validation copies and deeply freezes annotation documents and metadata.

Documents are bound to `sourceId`. A mismatched source hides annotations without
deleting them; restoring that source reveals them again. Applications supply the
matching document; the view does not cache documents for every asset. Annotations
may exist before duration is known. Later out-of-bounds items remain in the
document and appear in `invalidIds`, but their overlays are hidden. Known-invalid
channel indices are hidden by the view. Saved coordinates are not silently clamped.

Implemented editing behavior:

- Add, update, and remove regions and markers; replace a complete document.
- Select an annotation, drag its body to move it, or resize region boundaries.
- Label annotations and attach serializable application metadata.
- Lock items against coordinate edits and individual removal; unlock explicitly.
  Whole-document replacement, including undo restoration, can restore locks.
- Drag empty space in selection mode to make a temporary range. It neither
  creates a region nor seeks automatically. Vanilla views expose `getSelection()`,
  `clearSelection()`, and `createRegionFromSelection(id, label?)`.
- Enforce `minLength`/`maxLength` and snap user edits to a time grid through
  `annotationRules`. Store rules enforce edited region lengths; use matching
  store and view rules when borrowing a store. API/imported values are not
  implicitly snapped.
- Render custom region labels as DOM nodes, with optional disposal callbacks,
  or React nodes through portals. Labels are presentation content and are not
  serialized. Keep interactive inputs in the application inspector.
- Observe selection, selected IDs, commit proposals, and annotation errors.

### Ownership and commit contract

`createAnnotations({ document, rules? })` creates a library-owned committed store.
Its API includes `getSnapshot`, `subscribe`, `onCommit`, `addRegion`,
`updateRegion`, `addMarker`, `updateMarker`, `remove`, `replaceDocument`,
`setDuration`, and `dispose`. Snapshots contain `document`, `revision`, `duration`,
and `invalidIds`. Subscriptions return unsubscribe functions.

Controlled annotations use `{ value, revision, onCommit }`, either on the view or
through a controlled store with `setControlled`. A commit callback proposes a new
document; the application accepts by publishing it with a new revision. Ignoring
the proposal restores committed geometry. External revisions cancel stale gestures.
Change metadata includes `operation`, `origin`, affected `ids`, and `baseRevision`.
One pointer gesture produces one proposal on release; cancellation produces none.

## Optional editing and navigation modules

| Module           | Implemented behavior                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raavl/timeline` | `mountTimeline(host, { view, minSpacing?, formatTime? })`; adaptive 1/2/5 time intervals covering the visible viewport; default spacing 80 CSS pixels; exported `formatTime`; dispose/remount to change options |
| `raavl/minimap`  | `mountMinimap(host, { view, player                                                                                                                                                                              | data, height?, label? })`; fit-width overview with visible-window indicator; default height 64; pointer and keyboard panning without audio seeking; `refreshTheme()`and`dispose()` |
| `raavl/history`  | Pure immutable `createHistory`, `recordHistory`, `undoHistory`, `redoHistory`; full annotation snapshots with default 100-entry undo limit; new edits clear redo; a different source ID resets history          |
| `raavl/snapping` | `createSnapper()`; magnetic pointer snapping to markers, region boundaries, optional grid, playhead, and custom targets; default tolerance 8 CSS pixels                                                         |

Optional modules have separate entry points and no global registration. Timeline
and minimap borrow the main view; the minimap shares its player's prepared data
without another audio fetch/decode. Dispose accessories before the main view.
For data-only minimaps, remount to replace immutable data.

History records accepted documents only. The application applies undo/redo to its
store or controlled state, increments controlled revisions, and prevents restored
documents from being recorded as fresh edits. History has no automatic keyboard
shortcuts, store subscription, or transaction grouping.

Magnetic snapping chooses the nearest eligible target within pixel tolerance;
ties choose the earlier time and edited items exclude their own boundaries.
Region moves preserve length. Duration and length constraints take precedence.
The `snapAnnotation` callback replaces pointer grid snapping, including selection;
keyboard editing keeps `annotationRules.snap`. Custom pure snappers receive
document, excluded ID, duration, and pixels per second.

## React integration

The React ownership examples in the reference have Preview/Code tabs, with bundled
audio and interactive card removal / waveform hiding. Tabs keep the previews
mounted so inspecting code preserves playback and example state.

- `AudioPlayer` composes the public player parts into a default waveform,
  seek slider, play/pause, time, mute, volume, and status UI. Optional speed and
  loop controls are configured through `controls`; every part accepts false,
  true, or native component props. `waveform={false}` and `controls={false}`
  independently hide these sections without disposing playback. Named slots
  replace/wrap parts; `status` controls feedback visibility and props.
- `PlayerRoot` shares a `usePlayer` controller without adding a DOM wrapper.
  `Waveform` with no explicit source/player uses its context, including the
  initially null player. Explicit waveform ownership still takes precedence.
- Public parts are `PlayPauseButton`, `SeekSlider`, `TimeDisplay`, `MuteButton`,
  `VolumeSlider`, `PlaybackRateSelect`, `LoopButton`, and `PlayerStatus`.
  They forward native refs/attributes, support accessible labels, and subscribe
  narrowly. `usePlayerContext()` exposes the nearest controller for custom parts.
- Complete/individual controls catch command failures through the root. Pending
  play disables repeat starts; buffering remains pausable. Seek gestures retain
  their preview through clock updates and cancel on source changes. Waveform
  errors remain independent of audio readiness.
- Owned roots preserve volume, mute, speed, and loop across source changes;
  borrowed players retain application ownership. `AudioPlayer` forwards a div
  ref and exposes the controller through `onPlayer`.

The headless and waveform APIs remain available: `Waveform`, `usePlayer`, `usePlayerState`, `usePlayerTime`,
and `useAnnotations`, with React and React DOM as optional peers. Vanilla
entry points do not import React.

- `usePlayer({ source, onError? })` owns a controller created after commit,
  returns null until then, and manages source replacement, cancellation, and
  disposal. Omit the source for imperative loading or set it to null to clear.
  `usePlayer({ player, onError? })` borrows an existing controller without loading
  or disposing it. Errors are observed without a view; cancellations are filtered
  and repeated delivery of the same error is deduplicated.
- `<Waveform source={source} />` uses the same player lifecycle hook.
  `<Waveform player={player} />` borrows one; these props are mutually exclusive.
- `onPlayer` and the forwarded ref expose the player. `onView` exposes the
  committed view for accessories. Callbacks receive null during cleanup.
- Visual prop changes preserve player identity and playback. Removing a visual
  prop restores its theme value or default. Change `themeVersion` after external CSS theme updates.
- Inline URL descriptors with unchanged fields do not reload audio. Keep large
  peak buffers, File/Blob objects, and request options stable; update source
  `revision` when asset data changes.
- Annotation ownership modes are mutually exclusive: controlled `annotations`
  plus `annotationsRevision` and `onAnnotationsCommit`; internally owned
  `defaultAnnotations`; or borrowed `annotationStore`. Defaults initialize once.
- `usePlayerState(player, selector)` observes selected semantic state;
  `usePlayerTime(player)` observes the separate clock, roughly 10 Hz during
  playback plus media/seek events. The Canvas playhead animates outside React.
  `useAnnotations(store)` observes annotation snapshots.
- Imports and server rendering require no browser globals. SSR emits an empty
  wrapper; resources are allocated after browser commit. Strict Mode remounts
  clean up owned resources.

## Interaction, accessibility, and styling

| Surface             | Controls                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waveform playback   | Click/tap to seek when enabled; drag/touch scrub in seek mode; double-click/double-tap the background to play                                                               |
| Waveform keyboard   | Left/Right seek 1 second, Shift seeks 10 seconds, Home/End seek bounds                                                                                                      |
| Annotation keyboard | Arrows move items/handles by 0.1 seconds or the configured snap interval; Shift multiplies by 10; Delete/Backspace removes unlocked items; Escape cancels gesture/selection |
| Minimap keyboard    | Left/Right pan 10% of a window; Shift pans a full window; Home/End reach viewport bounds                                                                                    |
| Annotation list     | 100 items per page; selecting an item scrolls to and focuses its overlay; invalid annotations remain listed for correction                                                  |

The player view exposes slider semantics, annotation views use a group with
individual controls, and data-only visuals use image semantics. Decorative Canvas
and timeline content are hidden from accessibility APIs. The minimap exposes one
viewport slider. Focus indicators and meaningful control labels are provided.
Touch background gestures preserve vertical page scrolling and pinch zoom;
annotation editing handles reserve gestures for editing. Comprehensive mobile and
screen-reader certification remains pending.

Rendering uses light DOM with ordinary `.raavl-*` classes and an optional
low-specificity stylesheet at `raavl/styles.css`. Public hooks cover waveform,
surface, wave/progress canvases, cursor, annotations, region body/handles/labels,
markers, selection, annotation list/pagination/status, timeline, and minimap.
Selected annotations expose `data-selected="true"`.

`parseTheme` validates an imported object or JSON string. Presets are authored in
one JSON catalog, also exported as `raavl/themes.json`. View `theme` updates and
React theme props replace preset values and redraw without reloading audio;
explicit appearance fields override theme fields. Themes cover drawing geometry,
surface background/corners, playhead and annotation color tokens. See the
[theme guide](docs/content/docs/styling.mdx) for loading, ranges and override semantics.

CSS tokens include `--raavl-wave-color`, `--raavl-progress-color`,
`--raavl-cursor-color`, `--raavl-background`, `--raavl-border-radius`,
`--raavl-focus-color`, `--raavl-region-color`, `--raavl-handle-color`,
`--raavl-marker-color`, `--raavl-selection-color`, `--raavl-label-color`,
`--raavl-annotation-list-height`, `--raavl-timeline-color`, and
`--raavl-minimap-window-color`. Refresh Canvas themes explicitly after CSS changes.

## Persistence and example application

`validateAnnotations`, `parseAnnotations(text, expectedSourceId?)`, and
`stringifyAnnotations(document)` support validated JSON persistence. The library
does not supply a backend, upload audio, or automatically save documents.

The example app supplies application-level controls for playback, annotation
label/time editing, locking, markers, region play/loop, localStorage save/load,
and annotation JSON editing/import/download. Saved JSON contains annotations,
not audio. Its annotation storage key is `raavl-annotations-demo`.

Run `npm run docs:dev` (or its `npm run examples` alias) and open
`http://127.0.0.1:3000/examples`. The gallery includes URL,
file, precomputed-peaks, borrowed-media, two-player, styling, annotation-editor,
scale-lab, and optional-module scenarios. Vanilla/React tabs expose copyable code.
The annotation and optional-module demos run their respective framework
implementations; the scale lab uses the vanilla engine under either tab.
The single documentation reference at `/docs` covers public options, APIs,
styling, interaction, and errors.
Included synthetic audio and peak fixtures run locally without credentials.

The single public site is a Next.js/Fumadocs app under `docs/`. Run
`npm --prefix docs ci` and `npm run docs:dev` for the landing page and searchable
MDX guides at `http://127.0.0.1:3000`. Use Node.js 22.22+ or Node.js 24 LTS for
this app. Its landing demo uses the real player with ordinary playback controls,
while the full gallery and builder are mounted once at `/examples` using the
shared components in `examples/live/`. No standalone examples server remains.

Agent support includes the Skills page at `/docs/skills`, one shared
`skills/raavl-integrate/SKILL.md` workflow, project installation commands for Codex,
Cursor, and Claude Code, optional Codex display metadata, and generated skill
downloads at `/skill.md` and `/skills/raavl-integrate/SKILL.md`. The preview and
downloads derive from the same source. `/docs/agents` and its Markdown endpoint
are compatibility aliases, with no separately maintained guide.

The site also includes an origin-aware copyable integration prompt, `/llms.txt`,
`/llms-full.txt`, individual `/markdown/<slug>/content.md` pages, and Markdown
copy/read actions. All text endpoints derive from the same MDX content as the
human docs. A static export to `docs/out/` can be hosted independently; see
[Vercel hosting](docs/HOSTING.md). The player and CSS source outside `docs/` are
build inputs, not separately published source directories.

The site's navigation and docs sidebar expose Light, Dark, and System themes.
System is the default; the selected preference persists through the Fumadocs
theme provider. The dark palette uses forest-green surfaces, sage foregrounds,
and amber focus accents while retaining the light design and typography.
CSS-owned Canvas examples observe the resolved HTML theme and redraw without
reloading audio. Explicit waveform JSON presets keep their configured colors.

## Scale, limits, and unimplemented capabilities

Overlays are culled to the visible time range, with focused/dragged controls kept
mounted. Custom labels can unmount offscreen; durable editor state belongs in
application data. Accessible list pagination bounds list DOM, but a fit-width view
can still mount every region because all are visible.

The scale lab exercises two-hour supplied stereo peaks and 10,000 regions. The
recorded Chromium 156/macOS run met its 16.7 ms p95 redraw target when zoomed or
with annotations hidden; the dense fit-width overview exceeded that target.
These are historical local measurements, not universal performance guarantees.
The Vite development run used Chromium 156 on macOS, DPR 2, a 458 CSS-pixel-wide
view, height 160, and 30 samples after one warm-up redraw. Timings include waiting
for requestAnimationFrame; they are not isolated CPU timings.

| Scenario                           | Median redraw | p95 redraw | Maximum | Overlays / list rows |
| ---------------------------------- | ------------: | ---------: | ------: | -------------------: |
| 100 px/sec, 10,000 regions         |        8.3 ms |     8.7 ms | 11.2 ms |              7 / 100 |
| Fit two hours, annotations hidden  |        8.3 ms |     9.4 ms |  9.4 ms |                0 / 0 |
| Fit two hours, all regions visible |       17.8 ms |    28.7 ms | 53.9 ms |         10,000 / 100 |

The stereo fixture contains 720,000 min/max buckets per channel, totaling
11,520,000 Float32 bytes. The two canvases used 2,344,960 backing bytes in that
setup. These counts exclude total heap, DOM, GPU and compositor overhead.
Reproduce through the Scale lab at `/examples#demos/scale/vanilla`.

Remaining validation includes published source-to-playable and waveform-readiness
latency, drag latency, React render measurements, and many-player benchmarks.
Automated tests verify ownership and teardown, but total heap reclamation and a
long-recording full-decode memory budget remain unverified.

Current limits:

- Finite recordings and HTML media playback only; codec support, autoplay,
  seeking precision, and background timers depend on the browser.
- No live/infinite-stream support, sample-accurate range scheduling, or Web Audio
  playback backend. Web Audio is used for visualization decoding.
- URL/file visualization decoding reads the whole input. It has no memory
  ceiling or streaming decoder; use supplied peaks for long recordings.
- Request headers apply to visualization fetches, not native playback. Applications
  can fetch authenticated audio into a Blob. Remote decoding requires CORS.
- No byte-level loading progress, worker processing, decoder pools,
  multi-resolution caches, annotation spatial index, or overview aggregation.
- No overlap policy, automatic label collision avoidance, drag edge auto-scroll,
  snapping target highlights/hysteresis, zero-crossing, or beat analysis.
- History stores full documents; large documents and long history limits cost
  memory. No collaboration, multi-user merge logic, or history patches.
- No recording module, spectrogram module, multitrack mixing, or destructive
  audio editing.
- Browser measurements cover Chromium on macOS. Safari, Firefox, iOS/Android,
  and comprehensive screen-reader certification are unverified.

## Repository map and agent maintenance

| Concern                                           | Source or reference                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Player lifecycle, sources, playback               | `src/player.ts`, `src/core/types.ts`                                                                                         |
| Peak validation/generation                        | `src/core/data.ts`                                                                                                           |
| Canvas view and viewport                          | `src/dom/index.ts`                                                                                                           |
| Annotation data/store                             | `src/regions/index.ts`                                                                                                       |
| Annotation overlays and gestures                  | `src/dom/annotations.ts`                                                                                                     |
| React ownership and hooks                         | `src/react/index.tsx`                                                                                                        |
| Optional modules                                  | `src/timeline/`, `src/minimap/`, `src/history/`, `src/snapping/`                                                             |
| Styling                                           | `src/styles.css`                                                                                                             |
| Site light/dark palettes and Canvas theme bridge  | `docs/app/global.css`, `docs/app/dark.css`, `examples/live/usePageTheme.ts`                                                  |
| Theme format and JSON presets                     | `src/themes/`, [Theme guide](docs/content/docs/styling.mdx)                                                                  |
| Public package exports                            | `package.json`, `src/index.ts`, `src/core/index.ts`                                                                          |
| Shared gallery and builder components             | `examples/live/`, `docs/app/(home)/examples/page.tsx`, `examples/README.md`                                                  |
| Public landing page and Fumadocs guides           | `docs/app/`, `docs/components/`, `docs/content/docs/`                                                                        |
| Agent-readable docs and export checks             | `docs/lib/source.ts`, `docs/app/llms*`, `docs/scripts/verify-export.mjs`                                                     |
| Public integration skill and Codex metadata       | `skills/raavl-integrate/`                                                                                                    |
| Skill page, prompt, installation, and publication | `docs/content/docs/skills.mdx`, `docs/lib/skill-config.ts`, `docs/components/skill-*.tsx`, `docs/scripts/prepare-skills.mjs` |
| Docs development and independent hosting          | [Docs app](docs/README.md), [Vercel hosting](docs/HOSTING.md)                                                                |
| Detailed annotation contract                      | [Annotation guide](docs/content/docs/annotations.mdx)                                                                        |
| Detailed optional-module contract                 | [Module guide](docs/content/docs/modules.mdx)                                                                                |
| Historical API proposals                          | `docs/design/api.md`, `docs/design/workflows.md`                                                                             |
| Behavior and lifecycle checks                     | `tests/`                                                                                                                     |

Public entry points are `raavl`, `raavl/core`, `raavl/dom`, `raavl/react`,
`raavl/regions`, `raavl/timeline`, `raavl/minimap`, `raavl/history`, `raavl/snapping`,
`raavl/themes`, `raavl/themes.json`, and `raavl/styles.css`. Build the checkout before consuming it as a local package.
Use Node.js 22.12+ or a newer supported LTS for development.

For changes, verify the affected implementation and exported types before
claiming support. Preserve ownership, source isolation, controlled revisions,
and separation of audio/visualization readiness. Update this inventory and the
relevant detailed guide/examples when behavior changes. Keep proposals explicitly
marked as unimplemented. Avoid external library comparisons in product docs.

Available library checks: `npm run typecheck`, `npm test`, and `npm run build`;
`npm run check` runs all three. `npm run check:docs` runs the site typecheck and
Turbopack build. The examples commands are compatibility aliases for this site. Documentation-only edits
need link and diff checks; behavior changes need the relevant runtime checks.
The docs app has separate `npm run docs:typecheck`, `npm --prefix docs run test:skills`, and `npm run docs:build`
commands. Its postbuild verifies static pages, Markdown/index parity, content
links, search data, all nine gallery links, shared fixtures, skill-source parity,
legacy aliases, and landing assets; `.github/workflows/docs.yml` runs those
checks for documentation, skill, shared-example, and library-source changes.
Maintain user-facing API documentation only in `docs/content/docs/`. The legacy
Markdown guides are compatibility pointers to those canonical MDX pages.
