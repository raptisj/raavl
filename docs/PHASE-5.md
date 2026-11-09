# Phase 5 — Optional modules

Complete; stopped for review. No additional phase or publication started.

## Delivered

| Import | Feature |
| --- | --- |
| `ravl/timeline` | Visible ruler ticks synchronized with zoom, scrolling, resize, source duration and disposal; custom label formatting and spacing. |
| `ravl/minimap` | Shared-player waveform overview with visible-window indicator, pointer panning and keyboard navigation; no audio seeking or second load. |
| `ravl/history` | Pure immutable document history functions, bounded undo depth, redo branching and source reset. |
| `ravl/snapping` | Pixel-tolerance targets for markers, region boundaries, playhead, custom times and grid. |

Added a cached public viewport snapshot/subscription and `scrollTo` to DOM views,
plus React `onView` and `snapAnnotation`. Modules do not require DOM internals,
shadow DOM, subclasses, global registration, or a React dependency. The core
entry does not import the optional module implementations.

The new **Optional modules** playground has actual vanilla and React versions,
copyable examples, editable regions, undo/redo, source reset, timeline and minimap.
The existing gallery and documentation layout are retained. Also fixed hidden
pagination controls being overridden by flex styling and removed the minimap's
redundant accessible waveform slider.

See [Optional modules API](OPTIONAL-MODULES.md), the updated README and the live
`#docs/modules` reference for lifecycle, controlled-state integration and styling.

## Validation

`npm run check`: 49 tests pass, TypeScript passes, ESM/declaration build and
production examples build pass. Tests include bounded/immutable history,
branching and source reset, target exclusion and zoom tolerance, fractional ruler
labels, pointer snapping, minimap pointer/keyboard navigation without seeking,
viewport updates/disposal, React view identity, and the composed editor under
Strict Mode including edit/undo/unmount cleanup. Existing touch tests remain green.

Browser verification in the available Chromium runtime:

- Vanilla rename → undo → redo restores labels and counts.
- Actual React component rename → undo → redo, then minimap End navigation.
- Timeline ticks follow the visible window.
- React pointer resize snaps the phrase end to the 8.00-second marker and adds
  exactly one history step.
- Source switching resets history and updates source identity.

Other browser/device and comprehensive screen-reader certification remain open
release requirements from Phase 4; synthetic DOM tests are not substitutes.
No microphone permission or recording was requested during these checks.

## Recording assessment — separate future module

Decision: keep recording outside this phase's implementation. A future
`ravl/recording` factory should accept an application-owned MediaStream, expose
start/pause/resume/stop and chunk events, and return a Blob that can enter the
existing File source path. Device permission/selection should remain an explicit
application action. Stream ownership must be explicit so disposal never stops
borrowed tracks accidentally.

The MediaStream Recording API supplies encoded data through `dataavailable` and
supports checking candidate encodings. These are browser facilities, not a promise
of uniform codecs. See the [W3C recording specification](https://www.w3.org/TR/mediastream-recording/).
Before implementation, specify output format negotiation, maximum buffered bytes,
chunk streaming/backpressure, device loss, final-chunk delivery, stop/dispose races,
and cross-browser acceptance tests. No recorder API is exported yet.

## Spectrogram assessment — separate future module

Decision: design a distinct, versioned frequency-data format and a viewport-based
renderer first. Min/max waveform peaks cannot reconstruct frequency content;
frequency analysis needs PCM or precomputed spectral data. A proposed format
would identify source/revision, sample rate, FFT size, hop size, window function,
frequency scale, magnitude units and channel layout. These are design choices,
not implemented options.

For live frequency inspection, the Web Audio API defines an AnalyserNode and
frequency-domain data access; it does not provide this library's whole-recording
tiled cache or persistence contract. See the [Web Audio specification](https://www.w3.org/TR/webaudio/).
An offline spectrogram should have measured worker/tiling and byte budgets before
shipping, plus known-tone/sweep accuracy fixtures and color-scale accessibility.
At 100 frames/sec × 1,025 Float32 bins, two hours of mono magnitudes alone would
occupy about 2.95 GB. Precomputed tiled data and bounded caches are preferable to
unbounded full-recording allocations. No spectrogram API is exported yet.

## Boundaries

History uses full annotation snapshots, not patches or multi-user merge logic.
Magnetic snapping scans targets per pointer move; no spatial index, hysteresis,
zero-crossing or beat detection. The minimap adds viewport-sized canvas buffers
and shares existing waveform data; fit rendering cost still depends on bucket
count. Phase 4 dense-overview and long-file decoding limits still apply. Timeline
labels can overlap if custom formatting exceeds chosen spacing. Multitrack mixing,
destructive editing and WaveSurfer plugin compatibility remain outside the scope.
