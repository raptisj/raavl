import { failure } from "../core/data";
import presets from "./presets.json";

export type Appearance = {
  style?: "line" | "bars";
  height?: number;
  lineWidth?: number;
  barWidth?: number;
  barGap?: number;
  barRadius?: number;
  /** Fraction of each channel's height available to the waveform. */
  amplitude?: number;
  cursorWidth?: number;
  borderRadius?: number;
  normalize?: boolean;
};

export const defaultAppearance: Readonly<Required<Appearance>> = Object.freeze({
  style: "line", height: 160, lineWidth: 1, barWidth: 2, barGap: 1,
  barRadius: 0, amplitude: 0.9, cursorWidth: 2, borderRadius: 8, normalize: false,
});

export const colorTokens = {
  wave: "--ravl-wave-color", progress: "--ravl-progress-color",
  cursor: "--ravl-cursor-color", background: "--ravl-background",
  focus: "--ravl-focus-color", region: "--ravl-region-color",
  marker: "--ravl-marker-color", handle: "--ravl-handle-color",
  selection: "--ravl-selection-color", label: "--ravl-label-color",
} as const;

export type WaveformTheme = Readonly<{
  version: 1;
  name: string;
  appearance?: Readonly<Appearance>;
  colors?: Readonly<Partial<Record<keyof typeof colorTokens, string>>>;
}>;

const invalid = (message: string): never => { throw failure("INVALID_DATA", "view", message); };
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function knownKeys(value: Record<string, unknown>, keys: readonly string[], label: string) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`Unknown ${label} field: ${key}`);
}

export function validateAppearance(value: Appearance): void {
  const input = object(value, "Appearance");
  knownKeys(input, Object.keys(defaultAppearance), "appearance");
  const ranges = {
    height: [24, 2000], lineWidth: [0.5, 20], barWidth: [0.5, 100], barGap: [0, 100],
    barRadius: [0, 100], amplitude: [0.1, 1], cursorWidth: [0, 20], borderRadius: [0, 100],
  } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = input[key];
    if (number !== undefined && (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max)) {
      invalid(`${key} must be finite and between ${min} and ${max}`);
    }
  }
  if (input.style !== undefined && input.style !== "line" && input.style !== "bars") invalid("Unsupported waveform style");
  if (input.normalize !== undefined && typeof input.normalize !== "boolean") invalid("normalize must be a boolean");
}

/** Parse JSON text or validate an imported/fetched object. Safe without DOM globals. */
export function parseTheme(input: unknown): WaveformTheme {
  if (typeof input === "string") {
    try { input = JSON.parse(input); }
    catch { return invalid("Theme must contain valid JSON"); }
  }
  const value = object(input, "Theme");
  knownKeys(value, ["version", "name", "appearance", "colors"], "theme");
  if (value.version !== 1) return invalid("Unsupported theme version; expected 1");
  if (typeof value.name !== "string" || !value.name.trim()) return invalid("Theme name must be a non-empty string");
  let appearance: Appearance | undefined;
  if (value.appearance !== undefined) {
    const entries = object(value.appearance, "Theme appearance");
    validateAppearance(entries as Appearance);
    appearance = Object.fromEntries(Object.entries(entries).filter(([, entry]) => entry !== undefined));
    Object.freeze(appearance);
  }
  let colors: WaveformTheme["colors"];
  if (value.colors !== undefined) {
    const entries = object(value.colors, "Theme colors");
    knownKeys(entries, Object.keys(colorTokens), "color");
    for (const [key, color] of Object.entries(entries)) {
      if (color === undefined) continue;
      if (typeof color !== "string" || !color.trim()) invalid(`Theme color ${key} must be a non-empty CSS color string`);
    }
    colors = Object.freeze(Object.fromEntries(Object.entries(entries).filter(([, entry]) => entry !== undefined))) as WaveformTheme["colors"];
  }
  return Object.freeze({ version: 1, name: value.name, appearance, colors });
}

function parseCatalog<T extends Record<string, unknown>>(catalog: T): { readonly [Key in keyof T]: WaveformTheme } {
  return Object.freeze(Object.fromEntries(Object.entries(catalog).map(([id, theme]) => [id, parseTheme(theme)]))) as { readonly [Key in keyof T]: WaveformTheme };
}

/** All presets are authored in the single, editable presets.json file. */
export const waveformThemes = parseCatalog(presets);
