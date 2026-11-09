# Waveform themes

A theme is a versioned JSON object containing drawing settings and CSS color
tokens. Vanilla and React use the same format and renderer. The four initial
presets are defined in one file: [`src/themes/presets.json`](../src/themes/presets.json).

| Preset | Shape | Character |
| --- | --- | --- |
| `sage` | 1px envelope, 160px tall | Soft green, light background |
| `studio` | 2px square bars, 1px gaps, 180px tall | Dark slate, blue progress, thin amber playhead |
| `neon` | 5px rounded bars, 3px gaps, 200px tall | Violet on dark plum, mint playhead, rounded surface |
| `paper` | 2.5px envelope, 120px tall | Warm ink, reduced amplitude, square surface |

## Use a preset

```ts
import { createPlayer, mountWaveform } from 'ravl'
import { waveformThemes } from 'ravl/themes'
import 'ravl/styles.css'

const player = createPlayer()
const view = mountWaveform(container, { player, theme: waveformThemes.neon })
view.update({ theme: waveformThemes.paper })
```

```tsx
import { Waveform } from 'ravl/react'
import { waveformThemes } from 'ravl/themes'
import 'ravl/styles.css'

<Waveform source={source} theme={waveformThemes.studio} />
```

## Load one JSON file

Save this as `waveform-theme.json`. No companion CSS configuration is required;
import the optional `ravl/styles.css` once for background, corners, focus and
annotation styling. Canvas colors, playhead color/width and drawing geometry
also work without the stylesheet.

```json
{
  "version": 1,
  "name": "My waveform",
  "appearance": {
    "style": "bars",
    "height": 180,
    "lineWidth": 2,
    "barWidth": 4,
    "barGap": 2,
    "barRadius": 2,
    "amplitude": 0.8,
    "cursorWidth": 1.5,
    "borderRadius": 12,
    "normalize": false
  },
  "colors": {
    "wave": "#52657b",
    "progress": "#74c7ec",
    "cursor": "#f5c97b",
    "background": "#111923",
    "focus": "#f5c97b"
  }
}
```

With a bundler that supports JSON imports:

```ts
import config from './waveform-theme.json'
import { parseTheme } from 'ravl/themes'

const theme = parseTheme(config)
view.update({ theme })
// React: <Waveform source={source} theme={theme} />
```

Or fetch it at runtime:

```ts
const response = await fetch('/waveform-theme.json')
if (!response.ok) throw new Error(`Theme request failed: ${response.status}`)
const theme = parseTheme(await response.json())
view.update({ theme })
```

`parseTheme` accepts JSON text or an object and returns an immutable copy. It
rejects unsupported versions, unknown keys, invalid numeric ranges, malformed
JSON and incorrect value types with a `RavlError` (`INVALID_DATA`, stage `view`).
Color values are non-empty CSS color strings; CSS/browser parsing determines
which color syntaxes are supported. Parsing and preset imports work during SSR.
Applications own file loading and request errors; the renderer does no fetching.

The complete preset catalog is also exported as `ravl/themes.json`:

```ts
import catalog from 'ravl/themes.json'
const theme = parseTheme(catalog.neon)
```

## Drawing settings

All settings are optional. Pixel values are CSS pixels, independent of display
pixel density. Multichannel audio applies the amplitude setting per channel.

| `appearance` field | Default | Allowed values / meaning |
| --- | --- | --- |
| `style` | `"line"` | `"line"` (dense envelope of vertical peak strokes) or `"bars"` |
| `height` | `160` | 24–2000px |
| `lineWidth` | `1` | 0.5–20px; thickness of envelope strokes, including the idle baseline |
| `barWidth` | `2` | 0.5–100px |
| `barGap` | `1` | 0–100px |
| `barRadius` | `0` | 0–100px; rounded bar corners, clamped to half each bar's width/height |
| `amplitude` | `0.9` | 0.1–1; fraction of channel height available to amplitudes of ±1 |
| `cursorWidth` | `2` | 0–20px; 0 hides the playhead |
| `borderRadius` | `8` | 0–100px; surface corners, using `ravl/styles.css` |
| `normalize` | `false` | Boolean; normalize against the largest absolute peak across all channels |

Line mode remains a min/max amplitude envelope, not a sample-by-sample signal
trace. Bar settings are preserved when switching drawing modes. Themes contain
visual settings; zoom, following, interactions, player state and audio sources
remain separate view/player options.

## Colors and ordinary CSS

The `colors` keys map to these existing or new tokens on `.ravl-waveform`:

| Key | CSS token |
| --- | --- |
| `wave` | `--ravl-wave-color` |
| `progress` | `--ravl-progress-color` |
| `cursor` | `--ravl-cursor-color` (falls back to progress) |
| `background` | `--ravl-background` |
| `focus` | `--ravl-focus-color` |
| `region` | `--ravl-region-color` |
| `marker` | `--ravl-marker-color` |
| `handle` | `--ravl-handle-color` |
| `selection` | `--ravl-selection-color` |
| `label` | `--ravl-label-color` |

Per-annotation colors still take precedence over shared annotation tokens.
Theme tokens apply to the waveform root and its descendants; sibling timeline,
minimap and annotation-list elements retain their own ordinary CSS styling.

## Overrides and switching

Resolution order is library defaults → theme appearance → explicit `appearance`.
Vanilla updates merge explicit overrides. An `undefined` field removes that
override and reveals the theme value (or the library default with no theme).

```ts
view.update({ theme: waveformThemes.neon, appearance: { height: 240 } })
view.update({ theme: waveformThemes.paper }) // Keeps explicit height: 240
view.update({ appearance: { height: undefined } }) // Uses Paper's height: 120
view.update({ theme: null }) // Clears theme; restores CSS and drawing defaults
```

React props describe the whole current configuration: removing an appearance
field clears its override; removing `theme` restores the unthemed view. A theme
switch replaces all theme fields, so a partial new theme never inherits missing
values from the previous one. Invalid updates leave the current configuration
unchanged. Switching does not replace the player/view or reload audio.

Theme/appearance changes redraw automatically. For external CSS color changes,
continue to call `view.refreshTheme()` or change React's `themeVersion`.

Try **Style & interaction** in either framework for presets, geometry controls,
JSON editing, copying and downloading. “Use current settings” puts all current
control adjustments into the JSON editor before you make further edits.
