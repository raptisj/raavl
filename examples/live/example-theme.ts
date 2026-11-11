export function examplePalette(dark: boolean) {
  return dark ? {
    background: "#17271f", text: "#e1eadf", muted: "#a4b9aa",
    border: "#344e3d", control: "#1b2d23", hover: "#283f30",
    primary: "#a0d3ae", primaryText: "#12251a", wave: "#567963",
    focus: "#e5b574", region: "#b197db33", marker: "#e5b574",
    handle: "#c3a5eb", selection: "#8cb6e944", label: "#ddc8f7",
  } : {
    background: "#fffefa", text: "#183d34", muted: "#5c7362",
    border: "#d6dfd2", control: "#fffefa", hover: "#e4eddd",
    primary: "#245e49", primaryText: "#ffffff", wave: "#9aafa7",
    focus: "#bd722e", region: "#a67ce333", marker: "#b65d29",
    handle: "#8055ba", selection: "#538ce644", label: "#493165",
  };
}

export function exampleThemeCss(dark = false) {
  const p = examplePalette(dark);
  return `
.example-app { background: ${p.background}; }
.example-app, .example-app .annotation-app, .example-app .playback-app { color: ${p.text}; color-scheme: ${dark ? "dark" : "light"}; }
.example-app, .example-app * { box-sizing: border-box; }
.example-app .raavl-waveform {
  --raavl-background: ${p.background}; --raavl-wave-color: ${p.wave};
  --raavl-progress-color: ${p.primary}; --raavl-cursor-color: ${p.focus};
  --raavl-focus-color: ${p.focus}; --raavl-region-color: ${p.region};
  --raavl-marker-color: ${p.marker}; --raavl-handle-color: ${p.handle};
  --raavl-selection-color: ${p.selection}; --raavl-label-color: ${p.label};
}

.example-app .raavl-player { --raavl-background: ${p.background}; --raavl-progress-color: ${p.primary}; --raavl-control-background: ${p.control}; --raavl-control-color: ${p.text}; --raavl-control-border: ${p.border}; --raavl-control-active-color: ${p.primaryText}; }
.example-app button, .example-app select, .example-app input:not([type="range"]):not([type="file"]) { color: ${p.text}; background: ${p.control}; border-color: ${p.border}; }
.example-app button:hover:not(:disabled) { background: ${p.hover}; }
.example-app button.primary { background: ${p.primary}; color: ${p.primaryText}; border-color: ${p.primary}; }
.example-app button.primary:hover:not(:disabled) { background: ${p.primary}; }
.example-app .raavl-play-pause[data-playing="true"], .example-app .raavl-button[aria-pressed="true"] { background: ${p.primary}; color: ${p.primaryText}; }
.example-app .raavl-timeline { --raavl-timeline-color: ${p.muted}; }
.example-app .raavl-minimap-control { --raavl-focus-color: ${p.focus}; }
.example-app .helper, .example-app label, .example-app .source-form p, .example-app .file-drop span { color: ${p.muted}; }
.example-app .annotation-fields, .example-app .file-drop { border-color: ${p.border}; }
.example-app .file-drop { background: ${p.control}; }
.example-app :focus-visible { outline: 3px solid ${p.focus}; outline-offset: 3px; }
`;
}

export function stylesheetCode(css: string) {
  return "const css = `\n" + css.trim() + "\n`";
}
