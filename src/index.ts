export { createPlayer } from "./player.js";
export { mountWaveform } from "./dom/index.js";
export { parseTheme, waveformThemes } from "./themes/index.js";
export type {
  WaveformTheme,
  WaveformGradient,
  WaveformPaint,
  WaveformColors,
} from "./themes/index.js";
export type {
  Appearance,
  Viewport,
  Interaction,
  ViewOptions,
  ViewUpdate,
  WaveformView,
  ViewportSnapshot,
  AnnotationSnapper,
} from "./dom/index.js";
export { validateWaveform, createPeaks } from "./core/data.js";
export type * from "./core/types.js";

export {
  createAnnotations,
  validateAnnotations,
  parseAnnotations,
  stringifyAnnotations,
} from "./regions/index.js";
export type * from "./regions/index.js";

export { mountActionsToolbar, type ActionsToolbarOptions } from "./dom/actions-toolbar.js";
export { mountMuteButton, mountLoopButton, type PlaybackToggleOptions } from "./dom/playback-toggle.js";
