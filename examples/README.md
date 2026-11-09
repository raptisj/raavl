# Interactive browser examples

These examples run the actual Phase 5 library. They are no longer API sketches.

```sh
npm ci
npm run examples
```

Use Node.js 22.12+ and open http://127.0.0.1:4173. Stop the server with Ctrl+C.
For another port: `npm run examples -- --port 4174`.

## Site structure

The home page is the Examples gallery with all eight playgrounds.
Documentation lives at `#docs/start`, with separate pages for getting started,
sources and peaks, the player, waveform options and defaults, React props and
hooks, annotations, CSS styling, touch and keyboard controls, and state/errors.
Documentation code blocks include a copy button.

Playgrounds use `#demos/<scene>/<framework>`; older `#<scene>/<framework>`
bookmarks remain supported. Framework choices only change the code panel.

## Explore

Choose a scenario in the navigation and try its shared live preview. Below the
preview, switch between Vanilla JS and React code and use Copy code to copy the
selected snippet. Switching code preserves playback, selected files, and controls:

- Optional modules: timeline, minimap pan, undo/redo and magnetic snapping.
  Its code framework switch remounts the corresponding real vanilla/React view.
- Scale lab: run repeatable redraw measurements on a synthetic two-hour stereo
  waveform with 10,000 editable regions; try zoom, pagination, and keyboard edits.
  This shared-engine benchmark uses the vanilla API.
- Annotation editor: create/resize/move regions, add markers, toggle controlled
  acceptance, lock annotations, play/loop regions, and save/load JSON.
- URL: the bundled audio works immediately; another URL can be entered.
- File: select audio locally. The file stays in your browser.
- Peaks: supplied JSON avoids waveform decoding; the invalid-data checkbox tests
  that audio still works when waveform data fails validation.
- Existing media: play, detach, and verify the native audio continues playing.
- Two players: change one player's time, volume, speed, or zoom independently.
- Styling: change drawing style, color, height, zoom, and follow mode while playing.

Click, tap, or drag the waveform to seek. Double-click or double-tap to start
playback. Touch gestures use Pointer Events; vertical scrolling and pinch zoom
remain available. Drags, long presses, and cancelled gestures do not count as taps. Keyboard: Left/Right = 1 second,
Shift+Left/Right = 10 seconds, Home/End = beginning/end.

The playground shell is React. The shared preview mounts the ordinary DOM API
through `live/VanillaWaveform.tsx`. `live/main.tsx` holds the controls and scenarios;
`live/snippets.ts` supplies copyable examples for both public APIs.

`public/demo-a.wav` and `demo-b.wav` are original 12-second synthetic recordings.
Their matching JSON files contain uniform min/max buckets. Regenerate them with
`node scripts/generate-fixtures.mjs`. No external media or network service is
needed after dependency installation.

`npm run examples:build` creates a production bundle in `dist/examples`.
Historical Phase 1 sketches remain in `workflows.js` and the design guide; they
include early API proposals and are not the implementation reference. Use
`docs/ANNOTATIONS.md` for the implemented annotation contract.

## Verification

Automated lifecycle, React, SSR, and keyboard tests run with `npm test`.
Browser smoke checks confirmed loaded waveforms, React and vanilla playback,
zoom/drawing controls, and native audio surviving waveform detachment.
The file picker, all formats, and all browser/mobile combinations have not been
exhaustively tested. The annotation demo also verifies selection creation, controlled rejection,
keyboard resizing, browser persistence, and source-bound visibility.

See [Phase 4 measurements](../docs/PHASE-4.md) for reproducible settings, memory
accounting, verified browser coverage, and known dense-overview limits.

Phase 5: open `#demos/modules/react` or `#demos/modules/vanilla`. Rename then
undo/redo; resize a region near the 8s cue; use the minimap with pointer or
keyboard; switch source to reset history. See [module API](../docs/OPTIONAL-MODULES.md)
and [checkpoint](../docs/PHASE-5.md). The full composition is in `live/ModulesEditor.tsx`.
