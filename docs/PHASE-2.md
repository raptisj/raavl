# Phase 2 checkpoint — foundation and interactive examples

## Delivered

- TypeScript controller for URL, File/Blob, and borrowed HTMLMediaElement sources.
- Independent source, playback, and waveform state; typed errors and cancellation.
- Min/max peak validation and browser decoding with released AudioContexts.
- Light-DOM Canvas view, visible-viewport drawing, zoom/follow modes, themes,
  click/drag seeking, and keyboard seeking.
- React component and narrow external-store hooks, separate clock subscription,
  owned/borrowed lifecycles, and server-safe imports/rendering.
- Six interactive scenarios in both vanilla API and React component modes,
  original local audio fixtures, and live playback/style controls.
- ESM package builds and generated TypeScript declarations.

## Validation

`npm run check` runs TypeScript checking, 14 automated tests, the library build,
and the production examples build. Tests cover cancellation before metadata,
late non-abortable decoding, invalid/mismatched peaks, borrowed media ownership,
Blob URL revocation, playback rejection, Strict Mode cleanup, appearance updates
without reloading audio, narrow React subscriptions, keyboard behavior, and SSR.
Media and Canvas APIs are mocked in unit tests; they do not prove actual browser
codec compatibility or playback precision.

Browser smoke checks in the available in-app browser confirmed:

- URL audio and waveform reach ready state and play in React mode.
- Canvas waveform, looping, drawing and zoom controls operate visibly.
- Borrowed native audio continues playing after React waveform detachment.
- Vanilla mode also plays the borrowed audio and renders its waveform.

No exhaustive cross-browser or performance claims are made. The 12-second
provided-peaks example demonstrates the loading path, not a long-file benchmark.

## Scope boundaries

The implemented API is described in the root README and TypeScript exports.
Phase 1 design documents describe the larger target and include APIs not yet
implemented. This phase uses HTML media directly; a replaceable playback-adapter
interface and capability negotiation remain future work. Load phase reporting is
implemented; byte progress is deferred. There is no sample-accurate range playback,
worker decoding, or annotation editor yet.

## Commits

- `b726632`: controller, view, React adapter, build setup, and initial lifecycle tests.
- `dc1731c`: interactive demos, original audio fixtures, and React/view/SSR tests.
- The documentation checkpoint commit adds this record and updates usage guidance.

Phase 2 stops here. Phase 3 requires explicit user instruction.
