# Interactive browser examples

These examples run the actual Phase 2 library. They are no longer API sketches.

```sh
npm ci
npm run examples
```

Use Node.js 22.12+ and open http://127.0.0.1:4173. Stop the server with Ctrl+C.
For another port: `npm run examples -- --port 4174`.

## Explore

Choose a scenario in the navigation, then switch between Vanilla JS and React:

- URL: the bundled audio works immediately; another URL can be entered.
- File: select audio locally. The file stays in your browser.
- Peaks: supplied JSON avoids waveform decoding; the invalid-data checkbox tests
  that audio still works when waveform data fails validation.
- Existing media: play, detach, and verify the native audio continues playing.
- Two players: change one player's time, volume, speed, or zoom independently.
- Styling: change drawing style, color, height, zoom, and follow mode while playing.

Click or drag the waveform to seek. Keyboard: Left/Right = 1 second,
Shift+Left/Right = 10 seconds, Home/End = beginning/end.

The playground shell is React. Its Vanilla JS mode mounts the ordinary DOM API
through `live/VanillaWaveform.tsx`; React mode uses `src/react/Waveform` directly.
Both use the same public player. `live/main.tsx` holds the controls and scenarios.

`public/demo-a.wav` and `demo-b.wav` are original 12-second synthetic recordings.
Their matching JSON files contain uniform min/max buckets. Regenerate them with
`node scripts/generate-fixtures.mjs`. No external media or network service is
needed after dependency installation.

`npm run examples:build` creates a production bundle in `dist/examples`.
Historical Phase 1 sketches remain in `workflows.js` and the design guide; they
include future annotation APIs and are not the implementation reference.

## Verification

Automated lifecycle, React, SSR, and keyboard tests run with `npm test`.
Browser smoke checks confirmed loaded waveforms, React and vanilla playback,
zoom/drawing controls, and native audio surviving waveform detachment.
The file picker, all formats, and all browser/mobile combinations have not been
exhaustively tested. Region examples arrive with Phase 3.
