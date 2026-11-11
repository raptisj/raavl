import { waveformThemes } from "raavl";
import { defaultAppearance } from "raavl/themes";
import type { Appearance, Viewport, WaveformTheme } from "raavl";
import { examplePalette } from "./example-theme";

export type PlaybackCodeOptions = {
  appearance: Appearance;
  theme: WaveformTheme;
  viewport: Viewport;
};

export function previewTheme(theme: WaveformTheme, dark: boolean): WaveformTheme {
  if (theme !== waveformThemes.sage) return theme;
  const palette = examplePalette(dark);
  return {
    ...theme,
    colors: {
      background: palette.background, wave: palette.wave, progress: palette.primary,
      cursor: palette.focus, focus: palette.focus, region: palette.region,
      marker: palette.marker, handle: palette.handle, selection: palette.selection,
      label: palette.label,
    },
  };
}

export function defaultPlaybackOptions(dark: boolean): PlaybackCodeOptions {
  return {
    appearance: { ...defaultAppearance, ...waveformThemes.sage.appearance },
    theme: previewTheme(waveformThemes.sage, dark),
    viewport: { zoom: "fit", follow: "visible" },
  };
}

export const playbackStyles = `
.playback-app { color: #203b30; font: 14px/1.5 system-ui, sans-serif; }
.playback-app .source-form { margin-bottom: 22px; }
.playback-app .source-form label { color: #5c7362; font-size: 12px; }
.playback-app .source-form > div { display: flex; gap: 8px; margin-top: 8px; }
.playback-app .source-form input { min-width: 0; flex: 1; padding: 10px 12px; border: 1px solid #ced8ca; border-radius: 6px; font: 13px system-ui; background: #fff; color: #203b30; }
.playback-app .source-form button { padding: 9px 12px; border: 1px solid #245e49; border-radius: 6px; background: #245e49; color: #fff; font: 12px system-ui; cursor: pointer; }
.playback-app .source-form p { margin: 10px 0 0; color: #718370; font-size: 11px; }
.playback-app .file-drop { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; padding: 18px 20px; border: 1px dashed #90aa80; border-radius: 9px; background: #e7efdf; color: #5c7362; font-size: 13px; }
.playback-app .file-drop span { color: #5d755e; font-size: 11px; }
.playback-app audio { display: block; max-width: 100%; margin-bottom: 20px; }
.playback-app .raavl-player + .raavl-player { margin-top: 18px; }
`;
