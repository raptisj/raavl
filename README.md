# 🌊 ravl

A TypeScript waveform player with ordinary DOM styling, a functional JavaScript
API, and a React component backed by the same controller and Canvas renderer.

See [PRODUCT.md](PRODUCT.md) for the current feature inventory, product limits,
and source map for agents and contributors.

**Phase 5 is implemented.** The examples use real components, playable audio,
and editable annotations. This is a local development package, not a published
release. [Try the optional modules](http://127.0.0.1:4173/#demos/modules/react), [the scale lab](http://127.0.0.1:4173/#scale/vanilla) or [the annotation editor](http://127.0.0.1:4173/#annotations/react).

## Try the interactive examples

Requires Node.js **22.12+** (or a newer supported LTS release).

```sh
npm ci
npm run examples
```

Open **http://127.0.0.1:4173** for the **Examples** gallery. Each
playground has a shared live preview and copyable **Vanilla JS** / **React** code.
The **Documentation** section covers usage, every public option, player and React
APIs, annotations, styling, touch controls, and error handling.

| Example             | Try it                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| URL playback        | Play the included clip or load your own audio URL                        |
| Your audio file     | Select a local file; nothing is uploaded                                 |
| Precomputed peaks   | Play without decoding audio for visualization; test invalid peaks        |
| Existing media      | Start audio, then detach the waveform without stopping the native player |
| Two players         | Control two independent recordings                                       |
| Style & interaction | Change drawing mode, colors, height, zoom, and scrolling while playing   |

Every player supports play/pause, reset, seeking, volume, speed, and full-recording
looping. Click or drag the waveform to seek. Focus it with Tab and use Left/Right
for one-second steps, Shift for ten-second steps, or Home/End.

The included audio is generated locally from original synthetic tones, with
matching peak JSON. No remote audio service or credentials are needed. See
[examples/README.md](examples/README.md) for source files and verification steps.

## Vanilla JavaScript

These imports describe the built package exports. During local development,
examples import `src` directly. Run `npm run build` before consuming this checkout
as a local package; no npm publication is required.

```ts
import { createPlayer, mountWaveform } from "ravl";
import "ravl/styles.css"; // optional visual theme

const container = document.querySelector<HTMLElement>("#waveform")!;
const playButton = document.querySelector<HTMLButtonElement>("#play")!;
const player = createPlayer();
const view = mountWaveform(container, {
  player,
  appearance: { style: "bars", height: 160, barWidth: 2, barGap: 1 },
  viewport: { zoom: "fit", follow: "visible" },
  interaction: { seek: "click", drag: "seek" },
});

const unsubscribe = player.subscribe(() => {
  const state = player.getSnapshot();
  playButton.disabled = state.source !== "ready";
  if (state.waveformError) console.error(state.waveformError);
});

playButton.onclick = () => {
  void player.play().catch(console.error);
};
try {
  await player.setSource({ kind: "url", id: "episode-1", url: "/episode.mp3" });
} catch (error) {
  console.error(error);
}

// On application teardown:
// unsubscribe()
// view.dispose()
// player.dispose()
```

`view.update({ appearance: { style: 'line' } })` redraws without replacing the
player. Dispose a view and its owned player separately; multiple views can share
one player. Disposal is idempotent.

## React

React 19 and React DOM 19 are optional peer dependencies. Vanilla imports do not include React.

```tsx
import { useState } from "react";
import { Waveform, usePlayerState } from "ravl/react";
import type { Player } from "ravl";
import "ravl/styles.css";

export function AudioPlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const ready = usePlayerState(player, (state) => state?.source === "ready");
  const playing = usePlayerState(
    player,
    (state) => state?.playback === "playing",
  );

  return (
    <>
      <Waveform
        source={{ kind: "url", id: "episode-1", url: "/episode.mp3" }}
        onPlayer={setPlayer}
        onError={console.error}
        appearance={{ style: "bars" }}
        interaction={{ drag: "seek" }}
        aria-label="Episode waveform"
      />
      <button
        disabled={!ready}
        onClick={() => {
          if (playing) player?.pause();
          else void player?.play().catch(console.error);
        }}
      >
        {playing ? "Pause" : "Play"}
      </button>
    </>
  );
}
```

`Waveform` creates and cleans up its controller after mounting. Alternatively,
pass `player={existingPlayer}` to borrow one; do not also pass `source`.
`onPlayer` receives `null` on cleanup. A forwarded ref exposes the same controller.

`usePlayerState(player, selector)` subscribes to selected state; primitive or stable
object selections avoid unrelated rerenders. `usePlayerTime(player)` is a separate
clock subscription. The Canvas playhead animates outside React. Clock subscribers
receive roughly 10 Hz updates during playback, plus media/seek events; browser
background scheduling can reduce that rate. `getCurrentTime()` reads this cached
clock. The underlying media element exposes the browser's immediate playback time.

An inline URL descriptor with unchanged fields does not reload audio. Keep large
peak buffers, Files, and request options stable; update `revision` when asset data
changes. Do not mutate supplied peak arrays. Imports and server rendering are safe
without browser globals; audio resources are allocated only in the browser.

## Sources and readiness

`setSource()` resolves when finite audio metadata is available. It does **not**
wait for waveform decoding or guarantee that playback is buffered. Observe
`source`, `canPlay`, `playback`, and `waveform` in the snapshot separately.
A waveform failure does not prevent otherwise valid audio playback.

```ts
// Local file or Blob
await player.setSource({ kind: "file", id: "upload-1", file });

// Supplied visualization data: skips full audio decoding
await player.setSource({
  kind: "url",
  id: "episode-1",
  url: "/episode.mp3",
  waveform: { kind: "peaks", data: peaks },
});

// Borrow an existing element without assigning its source
await player.setSource({
  kind: "media",
  id: "episode-1",
  element: audioElement,
  waveform: { kind: "peaks", data: peaks },
});
```

Peaks use `{ version: 1, sourceId, sourceRevision?, duration, channels }`.
Each channel contains equally sized `min` and `max` arrays of finite amplitudes
in `[-1, 1]`, representing uniform time buckets. Min must not exceed max.
Source ID/revision and duration must match the audio. `validateWaveform` checks
structure and amplitudes; the controller checks source identity and duration.

Use `waveform: { kind: 'none' }` for playback without visualization data.
A standalone `mountWaveform(container, { data: peaks })` renders without audio.

Replacing a source cancels the old pipeline and rejects an unfinished metadata
promise with `code: 'CANCELLED'`. Pass `{ signal }` as the second argument for
explicit cancellation. Handle all returned promises, including `play()`.
`clearSource()` releases owned resources and returns to idle.

Owned audio is paused/reset on replacement or disposal, and library-created Blob
URLs are revoked. Borrowed media is never paused, removed, or reset by disposal.
Explicit playback commands still control borrowed media. After disposal, reads
return final state and mutating commands reject or throw `DISPOSED`.

## Styling and view options

Waveform themes are JSON configuration, including geometry as well as colors.
Choose `sage`, `studio`, `neon`, or `paper`, or load your own JSON:

```ts
import { waveformThemes, parseTheme } from 'ravl/themes'

view.update({ theme: waveformThemes.neon })
// Or: view.update({ theme: parseTheme(importedJson) })
// React: <Waveform source={source} theme={waveformThemes.neon} />
```

Presets live in [one JSON file](src/themes/presets.json). They cover line thickness,
bar width/gaps/rounding, amplitude, height, playhead width, surface corners, and
colors. Explicit `appearance` fields override theme values. See the
[theme format and loading guide](docs/THEMES.md) and try the
[theme playground](http://127.0.0.1:4173/#demos/styling/react) to edit/export JSON.

There is no Shadow DOM. Style `.ravl-waveform`, `.ravl-cursor`, and other documented
classes with ordinary CSS. Appearance controls Canvas drawing; CSS controls the
surrounding DOM and shared color tokens.

```css
.my-waveform .ravl-waveform {
  --ravl-wave-color: #9ba9db;
  --ravl-progress-color: #463c92;
  --ravl-focus-color: #c27822;
  background: #f7f6fb;
  border-radius: 12px;
}
```

After changing an external CSS theme, call `view.refreshTheme()`; in React, change
`themeVersion`. Canvas pixels need a redraw to reflect new CSS colors.

| Group       | Implemented options                                                        |
| ----------- | -------------------------------------------------------------------------- |
| Appearance  | `style: 'line' \| 'bars'`, `height`, `lineWidth`, `barWidth`, `barGap`, `barRadius`, `amplitude`, `cursorWidth`, `borderRadius`, `normalize` |
| Viewport    | `zoom: 'fit' \| pixelsPerSecond`, `follow: 'off' \| 'visible' \| 'center'` |
| Interaction | `seek: 'click' \| 'off'`, `drag: 'none' \| 'seek' \| 'select'`                         |

Vanilla updates merge fields within a group; `undefined` resets a field to its
theme value or library default. React props describe the current configuration,
so removing a prop restores its theme value or library default. All time-based
commands use seconds; `seekFraction()` uses
an explicit fraction from 0 to 1. Playback rate supports 0.25–4×.

## Regions, markers, and annotation editing

Use `createAnnotations` from `ravl/regions` for a library-owned store, or pass a
controlled document plus revision and commit callback. Both vanilla and React
support draggable regions, resize handles, markers, custom labels, locks,
keyboard editing, and temporary selections.

```ts
import { createAnnotations } from "ravl/regions";

const annotations = createAnnotations({
  document: {
    version: 1,
    sourceId: 'episode-1',
    regions: [{ id: 'intro', start: 0.5, end: 3, label: 'Introduction' }],
    markers: [{ id: 'cue', time: 8 }],
  },
})
view.update({ annotations, interaction: { drag: 'select' } })
```

Controlled React uses `annotations`, `annotationsRevision`, and
`onAnnotationsCommit`; uncontrolled React uses `defaultAnnotations` or a borrowed
`annotationStore`. A pointer drag produces one commit/proposal on release.
Rejected proposals restore committed geometry; external revisions cancel stale
gestures. Documents are bound to their audio source and remain intact on switches.

The interactive editor includes selection-to-region creation, label/time editing,
locking, markers, play/loop region, local browser save/load, and JSON import/export.
`player.playRange({ start, end, loop })` uses best-effort HTML media timing.

See the [annotation API guide](docs/ANNOTATIONS.md) for complete examples,
validation, ownership, keyboard controls, CSS hooks, and persistence semantics.

## Development and checks

```sh
npm run typecheck       # TypeScript library, demos, and tests
npm test                # Lifecycle, data, view, React, and SSR tests
npm run build           # ESM library entry points and declarations
npm run examples:build  # Production build of the interactive playground
npm run check           # All of the above
```

Build entry points: `ravl`, `ravl/core`, `ravl/dom`, `ravl/react`,
`ravl/regions`, and `ravl/styles.css`. The package remains private while its API is being developed.

## Optional modules

Import these independently; they are not registered globally or loaded by the core:

```ts
import { mountTimeline } from 'ravl/timeline'
import { mountMinimap } from 'ravl/minimap'
import { createSnapper } from 'ravl/snapping'
import { createHistory, recordHistory, undoHistory, redoHistory } from 'ravl/history'

const timeline = mountTimeline(timelineHost, { view })
const minimap = mountMinimap(minimapHost, { view, player })
view.update({ snapAnnotation: createSnapper({ grid: 0.1 }) })
// Dispose accessories before view/player teardown.
```

Views expose `getViewport()`, `subscribeViewport()`, and `scrollTo(seconds)`.
React's `onView` provides the committed view for accessory effects. History is
immutable and framework-independent: record accepted documents, then render/apply
`undoHistory(history).present`. Controlled React updates require a new revision.

See the [complete module API and ownership rules](docs/OPTIONAL-MODULES.md) and
[interactive editor](http://127.0.0.1:4173/#demos/modules/react). Recording and
spectrograms remain proposals, not shipped modules.

## Current limits and next phases

- HTML media playback only; no sample-accurate range scheduling or Web Audio
  playback backend. Full-recording and best-effort region looping are implemented.
- Finite recordings only. Live/infinite streams are not supported.
- URL waveform generation downloads and decodes the full recording. Prefer supplied
  peaks for long recordings. The scale lab measures a two-hour supplied-peaks
  fixture, not full-file decoding.
- Request headers apply to waveform fetching, not native media playback. Custom
  authenticated playback can use an application-fetched Blob. Remote decoding
  requires appropriate CORS responses.
- Loading phases are exposed; byte-level progress, worker processing, reusable
  decoder pools, and multi-resolution caches are future work.
- Annotation overlays are culled to the visible time range; the list is paginated.
  Fit-width views still mount all visible regions. Label collision avoidance and
  drag edge auto-scroll are not implemented. Undo/redo and magnetic snapping are
  available through optional imports.
- Browser measurements cover Chromium 156 on macOS. Safari, Firefox, mobile and
  comprehensive screen-reader certification remain unverified.

See the [product reference](PRODUCT.md#scale-limits-and-unimplemented-capabilities)
for current limits, measurements, and remaining validation work. The
[original API design](docs/design/api.md) contains historical proposals.
