# 🌊 raavl

raavl is an ergonomic TypeScript audio waveform player and annotation toolkit
for JavaScript and React, with reliable playback and customizable waveforms.
The name is inspired by Maurice **Ravel**.

## Install

```sh
npm install raavl
```

Use the [quickstart](docs/content/docs/quickstart.mdx) to build your first player
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
import { createPlayer, mountWaveform } from 'raavl';
import 'raavl/styles.css';

const player = createPlayer();
const view = mountWaveform(document.querySelector('#waveform'), {
  player,
  interaction: { drag: 'seek' },
});
const button = document.querySelector('#play');

const unsubscribe = player.subscribe(() => {
  const state = player.getSnapshot();
  button.disabled = state.source !== 'ready';
  button.textContent = state.playback === 'playing' ? 'Pause' : 'Play';
});

button.onclick = () => {
  if (player.getSnapshot().playback === 'playing') player.pause();
  else void player.play().catch(console.error);
};

void player.setSource({
  kind: 'url',
  id: 'my-audio',
  url: '/audio.mp3',
}).catch(console.error);

// Call when removing this player from your app.
function cleanup() {
  button.onclick = null;
  unsubscribe();
  view.dispose();
  player.dispose();
}
```

Replace `/audio.mp3` with an audio file served by your app. For a React example
and more options, see the [full quickstart](docs/content/docs/quickstart.mdx).


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
parts. See the [React API](docs/content/docs/react.mdx) for configuration, slots,
individual components, and headless hooks.

## Headless React

Inside a React component, use `usePlayer` to own playback without a waveform:

```tsx
import { usePlayer, usePlayerState } from 'raavl/react';

const player = usePlayer({
  source: {
    kind: 'url', id: 'episode', url: '/episode.mp3',
    waveform: { kind: 'none' },
  },
});
const playing = usePlayerState(player, state => state?.playback === 'playing');
```

The hook returns null until commit and manages source changes and disposal.
Combine it with your own controls, or pass its player to `Waveform` for an
optional visualization. See the [React API](docs/content/docs/react.mdx) for
imports, error handling, and complete examples.

## Documentation

- [Introduction](docs/content/docs/index.mdx)
- [Quickstart](docs/content/docs/quickstart.mdx)
- [Styling and themes](docs/content/docs/styling.mdx)
- [Annotations](docs/content/docs/annotations.mdx)
- [Skills for coding agents](docs/content/docs/skills.mdx)

## Develop

[![Node.js](https://img.shields.io/badge/node-%3E%3D22.22.0-brightgreen.svg)](https://nodejs.org/)

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
| `npm run check`                     | Run the library typecheck, tests, and build                         |

Stop the dev server before running production build checks. Skill downloads are
prepared automatically before site development, typechecking, and building.
To check that generated skill files match their source without updating them:

```sh
node docs/scripts/prepare-skills.mjs --check
```
