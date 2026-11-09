export { createPlayer } from './player'
export { mountWaveform } from './dom'
export { parseTheme, waveformThemes } from './themes'
export type { WaveformTheme, WaveformGradient, WaveformPaint, WaveformColors } from './themes'
export type { Appearance, Viewport, Interaction, ViewOptions, ViewUpdate, WaveformView, ViewportSnapshot, AnnotationSnapper } from './dom'
export { validateWaveform, createPeaks } from './core/data'
export type * from './core/types'

export { createAnnotations, validateAnnotations, parseAnnotations, stringifyAnnotations } from "./regions";
export type * from "./regions";
