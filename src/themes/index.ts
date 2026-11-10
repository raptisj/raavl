import { failure } from "../core/data.js";
import presets from "./presets.json" with { type: "json" };

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
  /** Draw each channel in its own row instead of a combined waveform. */
  splitChannels?: boolean;
};

export const defaultAppearance: Readonly<Required<Appearance>> = Object.freeze({
  style: "line",
  height: 160,
  lineWidth: 1,
  barWidth: 2,
  barGap: 1,
  barRadius: 0,
  amplitude: 0.9,
  cursorWidth: 2,
  borderRadius: 8,
  normalize: false,
  splitChannels: false,
});

export const colorTokens = {
  wave: "--raavl-wave-color",
  progress: "--raavl-progress-color",
  cursor: "--raavl-cursor-color",
  background: "--raavl-background",
  focus: "--raavl-focus-color",
  region: "--raavl-region-color",
  marker: "--raavl-marker-color",
  handle: "--raavl-handle-color",
  selection: "--raavl-selection-color",
  label: "--raavl-label-color",
} as const;

export type WaveformGradient = Readonly<{
  type: "linear-gradient";
  axis?: "vertical" | "horizontal";
  stops: readonly Readonly<{ offset: number; color: string }>[];
}>;
export type WaveformPaint = string | WaveformGradient;
export type WaveformColors = Readonly<
  Partial<
    Record<Exclude<keyof typeof colorTokens, "wave" | "progress">, string>
  > & {
    wave?: WaveformPaint;
    progress?: WaveformPaint;
  }
>;

export type WaveformTheme = Readonly<{
  version: 1;
  name: string;
  appearance?: Readonly<Appearance>;
  colors?: WaveformColors;
}>;

const invalid = (message: string): never => {
  throw failure("INVALID_DATA", "view", message);
};
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function knownKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) invalid(`Unknown ${label} field: ${key}`);
}

function parsePaint(value: unknown, key: string): WaveformPaint {
  if (typeof value === "string" && value.trim()) return value;
  if (key !== "wave" && key !== "progress")
    return invalid(`Theme color ${key} must be a non-empty CSS color string`);
  const gradient = object(value, `Theme color ${key}`);
  knownKeys(gradient, ["type", "axis", "stops"], "gradient");
  if (gradient.type !== "linear-gradient")
    return invalid("Unsupported gradient type");
  if (
    gradient.axis !== undefined &&
    gradient.axis !== "vertical" &&
    gradient.axis !== "horizontal"
  )
    return invalid("Gradient axis must be vertical or horizontal");
  if (!Array.isArray(gradient.stops) || gradient.stops.length < 2)
    return invalid("Gradients need at least two color stops");
  let previous = -1;
  const stops = gradient.stops.map((value) => {
    const stop = object(value, "Gradient stop");
    knownKeys(stop, ["offset", "color"], "gradient stop");
    if (
      typeof stop.offset !== "number" ||
      !Number.isFinite(stop.offset) ||
      stop.offset < 0 ||
      stop.offset > 1 ||
      stop.offset < previous
    )
      return invalid(
        "Gradient offsets must be ordered numbers between 0 and 1",
      );
    if (typeof stop.color !== "string" || !stop.color.trim())
      return invalid("Gradient stops need non-empty CSS color strings");
    previous = stop.offset;
    return Object.freeze({ offset: stop.offset, color: stop.color });
  });
  return Object.freeze({
    type: "linear-gradient",
    axis: gradient.axis ?? "vertical",
    stops: Object.freeze(stops),
  });
}

export function validateAppearance(value: Appearance): void {
  const input = object(value, "Appearance");
  knownKeys(input, Object.keys(defaultAppearance), "appearance");
  const ranges = {
    height: [24, 2000],
    lineWidth: [0.5, 20],
    barWidth: [0.5, 100],
    barGap: [0, 100],
    barRadius: [0, 100],
    amplitude: [0.1, 1],
    cursorWidth: [0, 20],
    borderRadius: [0, 100],
  } as const;
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const number = input[key];
    if (
      number !== undefined &&
      (typeof number !== "number" ||
        !Number.isFinite(number) ||
        number < min ||
        number > max)
    ) {
      invalid(`${key} must be finite and between ${min} and ${max}`);
    }
  }
  if (
    input.style !== undefined &&
    input.style !== "line" &&
    input.style !== "bars"
  )
    invalid("Unsupported waveform style");
  if (input.normalize !== undefined && typeof input.normalize !== "boolean")
    invalid("normalize must be a boolean");
  if (
    input.splitChannels !== undefined &&
    typeof input.splitChannels !== "boolean"
  )
    invalid("splitChannels must be a boolean");
}

/** Parse JSON text or validate an imported/fetched object. Safe without DOM globals. */
export function parseTheme(input: unknown): WaveformTheme {
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return invalid("Theme must contain valid JSON");
    }
  }
  const value = object(input, "Theme");
  knownKeys(value, ["version", "name", "appearance", "colors"], "theme");
  if (value.version !== 1)
    return invalid("Unsupported theme version; expected 1");
  if (typeof value.name !== "string" || !value.name.trim())
    return invalid("Theme name must be a non-empty string");
  let appearance: Appearance | undefined;
  if (value.appearance !== undefined) {
    const entries = object(value.appearance, "Theme appearance");
    validateAppearance(entries as Appearance);
    appearance = Object.fromEntries(
      Object.entries(entries).filter(([, entry]) => entry !== undefined),
    );
    Object.freeze(appearance);
  }
  let colors: WaveformTheme["colors"];
  if (value.colors !== undefined) {
    const entries = object(value.colors, "Theme colors");
    knownKeys(entries, Object.keys(colorTokens), "color");
    colors = Object.freeze(
      Object.fromEntries(
        Object.entries(entries)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, color]) => [key, parsePaint(color, key)]),
      ),
    ) as WaveformColors;
  }
  return Object.freeze({ version: 1, name: value.name, appearance, colors });
}

function parseCatalog<T extends Record<string, unknown>>(
  catalog: T,
): { readonly [Key in keyof T]: WaveformTheme } {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(catalog).map(([id, theme]) => [id, parseTheme(theme)]),
    ),
  ) as { readonly [Key in keyof T]: WaveformTheme };
}

/** All presets are authored in the single, editable presets.json file. */
export const waveformThemes = parseCatalog(presets);
