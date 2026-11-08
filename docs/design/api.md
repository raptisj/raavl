# Proposed architecture and API contract

Status: design for review, not a published or implemented API.

## Goals and boundaries

Build an ergonomic waveform player and annotation toolkit for vanilla JavaScript
and React. Keep application data serializable, DOM styling accessible, and browser
resources explicitly owned. Do not require classes, inheritance, a reactive
framework, or a global singleton in consumer code.

Initial playback uses HTMLMediaElement. Precise Web Audio range scheduling,
live infinite streams, audio export/editing, recording, and multitrack mixing
are future capabilities. A finite remote recording with supplied peaks is
supported; that does not imply support for an unbounded live stream.

## Modules and responsibilities

| Proposed import | Responsibility |
| --- | --- |
| `ravl` | Convenience exports for controller, HTML media adapter, and DOM view |
| `ravl/core` | DOM-free data, validation, commands, snapshots, subscriptions |
| `ravl/dom` | Canvas waveform, viewport, pointer interactions, DOM overlays |
| `ravl/react` | Components/hooks backed by the same controller and view logic |
| `ravl/regions` | Annotation store, editing rules, persistence helpers |
| `ravl/styles.css` | Optional visual theme; geometry remains functional without it |

These are entry points of one initial package. React is an optional peer;
vanilla imports must not pull it into the bundle. Module evaluation is safe on
the server. DOM and media resources are created only when mounted in a browser.

Pure functions handle coordinate conversion, constraints, and data validation.
Adapters own media, requests, canvas, and listeners. A controller exposes stable
commands and cached immutable snapshots. Large numeric buffers are held by
reference with documented read-only ownership, not copied per frame.

The core knows a small playback-adapter interface, never a fake HTMLMediaElement.
Adapters expose capabilities such as `canSeek`, `canSetVolume`, and
`preciseRangePlayback`. Unsupported operations report an explicit error.

## Controller and view

Proposed public names:

```ts
const player = createPlayer() // no source or network activity yet
const view = mountWaveform(container, {
  player,
  appearance: { style: 'bars', barWidth: 2, barGap: 1 },
  viewport: { zoom: 'fit', follow: 'visible' },
  interaction: { seek: 'click', drag: 'none' },
})

await player.setSource(source) // prepares metadata; waveform status is separate
await player.play()
player.pause()
player.seek(12) // seconds; seekFraction(0.5) is explicitly relative
view.update({ appearance: { style: 'line' } }) // no media reload
view.dispose()
player.dispose()
```

One player can drive several views. Disposing a view does not dispose the player.
The React convenience component owns its player; a component given a `player`
prop borrows it and must not destroy it. An owned player is created in the
committed mount lifecycle, never during a render that React can abandon.

`dispose()` is idempotent. Subsequent resource-creating or mutating commands
throw a `DisposedError`; reads return the final snapshot. Subscriptions terminate
on disposal. Async operations reject with a typed cancellation error when disposed.

## Source descriptors

Every source has a stable application-provided `id` identifying the audio asset.
React compares source identity/version and scalar fields, not large buffers.
Use `revision` when the data for the same asset changes; `id` alone is not a cache
key for authenticated or mutable resources. Files and arrays are read-only inputs.

```ts
type Source =
  | { kind: 'url'; id: string; revision?: string; url: string;
      request?: RequestInit; waveform?: WaveformInput }
  | { kind: 'file'; id: string; revision?: string; file: File | Blob;
      waveform?: WaveformInput }
  | { kind: 'media'; id: string; revision?: string; element: HTMLMediaElement;
      waveform: WaveformInput | { kind: 'none' } }

type WaveformInput =
  | { kind: 'decode' }
  | { kind: 'peaks'; data: WaveformData }
  | { kind: 'none' }
```

URL/File defaults to `decode`. For URL sources, playback streams from the URL;
waveform generation may require a separate full download. Document this cost,
especially for authenticated sources: fetch request headers cannot configure
the browser media element's requests. Applications needing custom-header playback
should fetch a Blob and use a file source. Do not promise request deduplication.

Media sources borrow the existing element and never set its `src`, remove it,
pause it on disposal, or revoke caller-owned URLs. Explicit user commands may
play, pause, and seek it. Replacing a borrowed source detaches subscriptions only.
Caller changes to its source require a new descriptor/revision and supplied
waveform data matching that source.

A standalone `mountWaveform(container, { data })` provides visualization without
a player. Player-driven and data-only view options are mutually exclusive.

## Waveform format

```ts
type WaveformData = {
  version: 1
  sourceId: string
  sourceRevision?: string
  duration: number // finite positive seconds
  channels: Array<{
    min: Float32Array | readonly number[]
    max: Float32Array | readonly number[]
  }>
}
```

Each channel uses equally spaced buckets across the duration. All channel arrays
have equal nonzero lengths. Values are finite normalized amplitudes in [-1, 1],
with min <= max for each bucket. Reject invalid input instead of silently
normalizing or mutating caller data. Normalization is a separate view setting.
Peak buffers represent amplitude ranges, never playable PCM or an AudioBuffer.

Validate source identity/revision. When media duration becomes known, compare
it with the supplied waveform duration using a documented tolerance. Default
proposal: max(0.1 seconds, 0.1% of media duration). Report a waveform mismatch
and keep playback usable; do not silently stretch annotations. The tolerance
is an API review decision, not a measured universal threshold.

Multi-resolution data and remote peak loaders may extend this format later;
do not bake a server protocol into version 1.

## Readiness, loading, and errors

Playback and waveform progress are independent:

| State domain | States |
| --- | --- |
| Source preparation | `idle`, `loading`, `ready`, `error`, `disposed` |
| Playback | `paused`, `starting`, `playing`, `buffering`, `ended` |
| Waveform | `idle`, `fetching`, `decoding`, `ready`, `error`, `cancelled` |

`setSource(source, { signal? })` resolves when finite metadata/duration is
available and the source is accepted. It does not mean audio is buffered or the
waveform is drawn. `play()` resolves when the media play request succeeds and
propagates autoplay restrictions. `canPlay` reflects media readiness separately.
Waveform readiness lives in its snapshot; `view` reports its own first draw.

Each source request receives a generation ID. New source requests abort old
fetches and invalidate every old async continuation, including non-abortable
decode work. Only the current generation can publish data, errors, or events.
A superseded request rejects with `CancelledError` and reason `superseded`;
this is not an operational failure. External abort/disposal use distinct reasons.
Callers must handle returned promises; examples demonstrate this.

On source replacement, pause and release owned media, reset position to zero,
clear the old waveform, and show pending state. Do not automatically resume
playback. Failed replacement does not restore the old source implicitly.
`clearSource()` returns to idle and releases owned resources.

Errors include `code`, `stage`, `sourceId`, `cause`, and `recoverable` where known.
Use explicit categories for network, decode, unsupported source, invalid data,
media playback, and duration mismatch. Waveform failure does not stop valid audio.
Progress reports bytes when known, plus an indeterminate processing stage;
do not present byte-download completion as overall completion.

Owned media, object URLs, listeners, observers, animation frames, and decoding
contexts have one owner and one cleanup path. Decoded PCM is released after
peak generation unless an explicitly opted-in feature requires it. No unbounded
global cache; future caching must be explicit and budgeted.

## Configuration updates

| Group | Owner | Update consequence |
| --- | --- | --- |
| Source | Player | Cancels/replaces the source pipeline |
| Playback volume/rate/loop | Player commands | Updates playback without reload |
| Appearance | View | Redraw only |
| Viewport | View | Relayout/visible range update |
| Interaction | View | Changes interaction behavior |
| Region data and rules | Annotation store | Validates/updates annotations |

Use named enums instead of overlapping flags: `follow: 'off' | 'visible' |
'center'`; `drag: 'none' | 'seek' | 'select'`. All public times use seconds;
zoom uses pixels per second or `'fit'`. `view.update` merges one group level:
omitted fields stay unchanged, and `undefined` resets an optional field to its
documented default. Arrays replace wholesale. Validate before applying changes.

## Annotation contract (Phase 3)

```ts
type Region = {
  id: string
  start: number
  end: number
  label?: string
  channel?: number // omitted means all channels
  locked?: boolean
  metadata?: JsonValue
}
type Marker = { id: string; time: number; label?: string; metadata?: JsonValue }
type AnnotationDocument = {
  version: 1
  sourceId: string
  regions: readonly Region[]
  markers: readonly Marker[]
}
```

Regions require 0 <= start < end and finite values. A zero-duration item is an
explicit marker. IDs must be unique. Annotation JSON contains no DOM elements,
React nodes, callbacks, or CSS. Unknown duration does not clamp coordinates to
zero: data remains pending until validation is possible.

When duration becomes known, out-of-bounds data is reported and retained in the
document but excluded from interaction until resolved. Optional `bounds: 'clamp'`
may return a corrected document; it must report every correction. Initial default
is `bounds: 'reject'`. Invalid commands leave the last valid state unchanged.

Uncontrolled mode: an annotation store owns committed data. Controlled mode:
the application owns it and receives proposed changes; the library never mutates
the supplied document. Controlled and default values cannot be combined.

Dragging maintains transient preview geometry without a React update per pointer
event. One `onCommit(nextDocument, change)` fires at gesture end. `change` includes
origin, operation, affected IDs, and base revision. In controlled mode the host
accepts by publishing the next value. If it does not, the preview reverts; a new
external revision during a gesture cancels that gesture. Optional `onPreview`
is throttled and separate from persistence. Undo stores committed operations.

Selection is transient UI state. A drag selection does not become a saved region
until an explicit create command or configured create-on-release behavior.
Click defaults to selecting a region; seek/play/loop require explicit behavior.
`player.playRange({ start, end, loop })` is a player command, not a region method.
HTML media range playback is best-effort, not sample-accurate; precise scheduling
is a future adapter capability. Boundary notifications distinguish seek from
continuous playback and cannot promise delivery at exact audio sample times.

An annotation document belongs to one source. Switching source does not migrate
or erase documents: the application provides the matching document, or the view
shows no annotations. Returning to a source can restore its saved document.

## React contract

`<Waveform source={source} />` owns a player. `<Waveform player={player} />`
borrows one; these props are mutually exclusive. `Waveform` exposes its controller
through a ref for commands and supports appearance/viewport/interaction props.
Changing visual props never recreates the media or resets playback.

`usePlayerState(player, selector)` uses stable subscriptions and cached immutable
snapshots through `useSyncExternalStore`. Selected values use Object.is equality;
helpers select stable objects. No React render is needed to animate the playhead.
Time displays opt into a clock subscription with a default 10 Hz update rate;
semantic state changes publish immediately. No deep comparison of waveform arrays.

React owns label slot children; the view owns geometry wrappers and canvas.
Do not let both mutate the same subtree. Offscreen label virtualization must
document unmount behavior. Focused or actively edited annotations remain mounted.
Strict Mode mount/cleanup/remount must not reuse disposed controllers.

SSR produces a stable empty wrapper with an accessible label. Initial client
markup matches it; all media and view effects start after commit. Audio does not
play on the server and no DOM globals are accessed at import time.

## Styling and accessibility

Light DOM uses documented `.ravl-*` classes and `data-ravl-*` attributes.
Optional theme CSS has low specificity. Layout-critical inline geometry is
documented separately from user-owned appearance. Proposed tokens include
`--ravl-wave-color`, `--ravl-progress-color`, `--ravl-region-color`, and
`--ravl-focus-color`. Theme updates go through an explicit view invalidation
when computed canvas colors change; CSS alone cannot redraw canvas pixels.

Appearance options control drawing shape. DOM colors/borders/fonts use CSS.
Vanilla label slots return DOM nodes with a cleanup hook; React slots return
React nodes. Strings are text, not injected HTML. Stable slot boundaries cover
labels, resize handles, and controls.

Keyboard seeking and focus visibility are foundation requirements. Phase 3 adds
keyboard region movement/resizing, meaningful handle labels, and an accessible
annotation list. Decorative canvas does not pretend to expose every audio sample
to assistive technology. Pointer editing uses Pointer Events and explicit touch
gesture policies. Reduced-motion preferences affect scrolling/animations.

## Upstream lessons

Reviewed WaveSurfer main (package version 8.0.5) and its React wrapper on
2026-11-08. This was source inspection, not a runtime audit. Current upstream
already has reactive state, functional plugins, lifecycle cleanup, and chunked
rendering; these are baseline expectations, not claimed new inventions.

- [Core/loading](https://github.com/katspaugh/wavesurfer.js/blob/main/src/wavesurfer.ts)
- [Renderer](https://github.com/katspaugh/wavesurfer.js/blob/main/src/renderer.ts)
- [Regions](https://github.com/katspaugh/wavesurfer.js/blob/main/src/plugins/regions.ts)
- [React adapter](https://github.com/katspaugh/wavesurfer-react/blob/main/src/index.tsx)

This phase copies no upstream implementation. If later work reuses source,
retain the applicable upstream notices and document provenance.
