# 🌊 raavl

**Raavl** is an ergonomic TypeScript audio waveform player and annotation toolkit
for JavaScript and React, with reliable playback and customizable waveforms.
The name is inspired by Maurice **Ravel**.

[![npm version](https://img.shields.io/npm/v/raavl.svg)](https://www.npmjs.com/package/raavl)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.22.0-brightgreen.svg)](https://nodejs.org/)

## Install

```sh
npm install raavl
```

Use the [quickstart](https://raavl.dev/docs/quickstart) to build your first player
with JavaScript or React. React and React DOM are optional peers for the
`raavl/react` adapter. Import `raavl/styles.css` once for the default waveform
styles, or supply your own CSS tokens.

## Quickstart

In an app with ESM and CSS imports, add a waveform container and a play button:

```html
<div id="waveform"></div>
<button id="play" disabled>Play</button>
```

```js
import { createPlayer, mountWaveform } from "raavl";
import "raavl/styles.css";

const player = createPlayer();
const view = mountWaveform(document.querySelector("#waveform"), {
  player,
  interaction: { drag: "seek" },
});
const button = document.querySelector("#play");

const unsubscribe = player.subscribe(() => {
  const state = player.getSnapshot();
  button.disabled = state.source !== "ready";
  button.textContent = state.playback === "playing" ? "Pause" : "Play";
});

button.onclick = () => {
  if (player.getSnapshot().playback === "playing") player.pause();
  else void player.play().catch(console.error);
};

void player
  .setSource({
    kind: "url",
    id: "my-audio",
    url: "/audio.mp3",
  })
  .catch(console.error);

// Call when removing this player from your app.
function cleanup() {
  button.onclick = null;
  unsubscribe();
  view.dispose();
  player.dispose();
}
```

Replace `/audio.mp3` with an audio file served by your app. For a React example
and more options, see the [full quickstart](https://raavl.dev/docs/quickstart).

## React player and components

Use the complete player with configurable controls:

```tsx
import { AudioPlayer } from "raavl/react";
import "raavl/styles.css";

export function EpisodePlayer() {
  return (
    <AudioPlayer
      source={{ kind: "url", id: "episode", url: "/episode.mp3" }}
      waveform={{ appearance: { style: "bars", height: 120 } }}
      controls={{ playbackRate: true, loop: true }}
    />
  );
}
```

For custom layouts, compose `PlayerRoot`, `Waveform`, `PlayPauseButton`,
`TimeDisplay`, `SeekSlider`, `MuteButton`, `VolumeSlider`, and the other connected
parts. See the [React API](https://raavl.dev/docs/react) for configuration, slots,
individual components, and headless hooks.

## Headless React

Inside a React component, use `usePlayer` to own playback without a waveform:

```tsx
import { usePlayer, usePlayerState } from "raavl/react";

const player = usePlayer({
  source: {
    kind: "url",
    id: "episode",
    url: "/episode.mp3",
    waveform: { kind: "none" },
  },
});
const playing = usePlayerState(
  player,
  (state) => state?.playback === "playing",
);
```

The hook returns null until commit and manages source changes and disposal.
Combine it with your own controls, or pass its player to `Waveform` for an
optional visualization. See the [React API](https://raavl.dev/docs/react) for
imports, error handling, and complete examples.

## Documentation

- [Introduction](https://raavl.dev/docs)
- [Quickstart](https://raavl.dev/docs/quickstart)
- [Styling and themes](https://raavl.dev/docs/styling)
- [Annotations](https://raavl.dev/docs/annotations)
- [Skills for coding agents](https://raavl.dev/docs/skills)

## Package entry points

Install once; all entries share the same version.

| Import | Purpose |
| --- | --- |
| `raavl` | Vanilla player, renderer, annotations, and common types |
| `raavl/core` | Waveform data utilities and types |
| `raavl/dom` | DOM waveform renderer |
| `raavl/react` | Complete player, components, and hooks (React 18 or 19) |
| `raavl/themes` | Theme presets, parsing, and types |
| `raavl/themes.json` | Raw theme preset catalog |
| `raavl/styles.css` | Optional default CSS |
| `raavl/regions` | Annotation store and serialization |
| `raavl/timeline`, `raavl/minimap` | Optional views |
| `raavl/history`, `raavl/snapping` | Optional editing utilities |

ESM only, with TypeScript declarations. Vanilla imports do not require React.
Imports are SSR-safe; playback and rendering require browser media, Canvas,
ResizeObserver, and Web Audio APIs. Cross-origin decoding requires CORS.
For long recordings, supply precomputed peaks to avoid decoding the whole file
in the browser. TypeScript consumers need DOM types; CSS imports require a
bundler. Library output targets ES2022 and includes no browser polyfills.

## Develop

Use a current Node.js 24 LTS.

The site builds the library first. After editing library source or CSS while
the site is running, run `npm run build` to refresh its output.

```sh
npm ci
npm --prefix docs ci
npm run docs:dev
```

## Checks

Run all commands from the repository root. Install the docs dependencies with
`npm --prefix docs ci` for site commands, and the root dependencies with `npm ci`
for library commands.

| Command                             | Purpose                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `npm run docs:dev`                  | Start the complete site on port 3000                                |
| `npm run examples`                  | Alias for the same site; no separate examples server                |
| `npm run docs:typecheck`            | Typecheck the site and shared example components                    |
| `npm --prefix docs run test:skills` | Run skill publication, command, URL, and alias tests                |
| `npm run docs:build`                | Build the static site with Turbopack and verify the export          |
| `npm run examples:build`            | Alias for `npm run docs:build`                                      |
| `npm run check:docs`                | Run the site typecheck, skill tests, build, and export verification |
| `npm run check`                     | Run typecheck, tests, build, and packed-package checks                         |
| `npm run test:release`              | Test release verification offline with simulated registry responses |

Stop the dev server before running production build checks. Skill downloads are
prepared automatically before site development, typechecking, and building.
To check that generated skill files match their source without updating them:

```sh
node docs/scripts/prepare-skills.mjs --check
```

## Manual releases

Run `npx playwright install chromium` once, then `npm run release:prepare` from
a clean release commit. It validates a tarball and prints the manual publish
command. Nothing publishes automatically. See [RELEASING.md](https://github.com/raptisj/raavl/blob/main/RELEASING.md)
for versioning, first publication, prereleases, and recovery.

After publishing, run `npm run release:verify`. It downloads the exact published
version, checks its distribution tag and checksum against the release receipt,
and runs isolated consumer checks with a fresh cache. It never publishes or
modifies npm. Complete the Git tag and GitHub release after verification passes.

`npm run check:browser` tests the packed package in Chromium. Both package
checks write their tarball under `artifacts/`, which is ignored by Git.

## License

MIT.
