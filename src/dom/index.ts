import { mountWaveformGestures, maxZoom } from "./waveform-gestures.js";
import { mountAnnotations, type AnnotationViewOptions } from "./annotations.js";
import type { Selection } from "../regions/index.js";
export type {
  AnnotationViewOptions,
  AnnotationSnapper,
  LabelSlot,
} from "./annotations.js";
import { failure, finite, validateWaveform } from "../core/data.js";
import type { Player, WaveformData } from "../core/types.js";
import {
  colorTokens,
  defaultAppearance,
  parseTheme,
  validateAppearance,
  type Appearance,
  type WaveformTheme,
  type WaveformPaint,
} from "../themes/index.js";
export type { Appearance, WaveformTheme } from "../themes/index.js";

export type Viewport = {
  /** Auto fits wide views and uses 100 px/s for annotation editors below 600px. */
  zoom?: number | "fit" | "auto";
  follow?: "off" | "visible" | "center";
};
export type Interaction = {
  seek?: "click" | "off";
  drag?: "none" | "seek" | "select";
};
export type ViewOptions = AnnotationViewOptions & {
  theme?: WaveformTheme | null;
  appearance?: Appearance;
  viewport?: Viewport;
  interaction?: Interaction;
  label?: string;
  onDraw?: () => void;
} & ({ player: Player; data?: never } | { data: WaveformData; player?: never });
export type ViewUpdate = Pick<
  ViewOptions,
  "theme" | "appearance" | "viewport" | "interaction" | "label" | "onDraw"
> &
  AnnotationViewOptions & { data?: WaveformData };
export type ViewportSnapshot = Readonly<{
  sourceId: string | null;
  duration: number;
  start: number;
  end: number;
  width: number;
  pixelsPerSecond: number;
  disposed: boolean;
}>;
export type WaveformView = {
  getViewport(): ViewportSnapshot;
  subscribeViewport(callback: () => void): () => void;
  scrollTo(seconds: number): void;
  update(options: ViewUpdate): void;
  refreshTheme(): void;
  getSelection(): Selection;
  clearSelection(): void;
  /** Open a draft selection at time; the editor confirms creation. */
  createRegionAtTime(time: number): void;
  createRegionFromSelection(id: string, label?: string): void;
  dispose(): void;
};

const defaults = {
  appearance: defaultAppearance,
  viewport: { zoom: "auto", follow: "visible" } as Required<Viewport>,
  interaction: { seek: "click", drag: "none" } as Required<Interaction>,
};
function merge<T extends object>(
  base: T,
  patch: Partial<T> | undefined,
  fallback: T,
): T {
  const next = { ...base };
  for (const key of Object.keys(patch ?? {}) as Array<keyof T>)
    next[key] = patch![key] ?? fallback[key];
  return next;
}

function canvasPaint(
  context: CanvasRenderingContext2D,
  paint: WaveformPaint | undefined,
  fallback: string,
  width: number,
  height: number,
): string | CanvasGradient {
  if (!paint || typeof paint === "string") return fallback;
  const horizontal = paint.axis === "horizontal";
  const gradient = context.createLinearGradient(
    0,
    0,
    horizontal ? width : 0,
    horizontal ? 0 : height,
  );
  for (const stop of paint.stops)
    gradient.addColorStop(stop.offset, stop.color);
  return gradient;
}

/** Mount a light-DOM waveform. View disposal never disposes a borrowed player. */
export function mountWaveform(
  container: HTMLElement,
  options: ViewOptions,
): WaveformView {
  if (!container || Boolean(options.player) === Boolean(options.data))
    throw failure(
      "INVALID_DATA",
      "view",
      "Provide exactly one player or waveform data",
    );
  let appearance = { ...defaults.appearance },
    viewport = { ...defaults.viewport },
    interaction = { ...defaults.interaction };
  let theme: WaveformTheme | null = null;
  let appearanceOverrides: Appearance = {};
  let data = options.data
    ? validateWaveform(options.data)
    : (options.player?.getSnapshot().data ?? null);
  let label = options.label ?? "Audio waveform";
  let onDraw = options.onDraw;
  let disposed = false,
    frame = 0,
    width = 1,
    totalWidth = 0,
    duration = 0,
    normalization = 1;
  let lastData: WaveformData | null = null;
  let dirty = true;
  let annotationOptions: AnnotationViewOptions = {};
  const player = options.player;
  const getDuration = () =>
    player?.getSnapshot().duration || data?.duration || 0;
  let viewportState: ViewportSnapshot = Object.freeze({
    sourceId: null,
    duration: 0,
    start: 0,
    end: 0,
    width: 0,
    pixelsPerSecond: 0,
    disposed: false,
  });
  const viewportListeners = new Set<() => void>();
  function contentWidth(width: number, duration: number) {
    const setting = gestures.zoom ?? viewport.zoom;
    const zoom = setting === "auto"
      ? annotationOptions.annotationEditor && width < 600 ? 100 : "fit"
      : setting;
    return zoom === "fit" ? width : Math.max(width, duration * zoom);
  }
  const publishViewport = () => {
    const currentDuration = getDuration();
    const currentWidth = Math.max(1, root.clientWidth);
    const total = contentWidth(currentWidth, currentDuration);
    const pps = currentDuration ? total / currentDuration : 0;
    const start = pps
      ? Math.min(
          Math.max(0, currentDuration - currentWidth / pps),
          root.scrollLeft / pps,
        )
      : 0;
    const next = {
      sourceId: player?.getSnapshot().sourceId ?? data?.sourceId ?? null,
      duration: currentDuration,
      start,
      end: pps ? Math.min(currentDuration, start + currentWidth / pps) : 0,
      width: currentWidth,
      pixelsPerSecond: pps,
      disposed,
    };
    if (
      Object.keys(next).every((key) =>
        Object.is(
          next[key as keyof typeof next],
          viewportState[key as keyof ViewportSnapshot],
        ),
      )
    )
      return;
    viewportState = Object.freeze(next);
    viewportListeners.forEach((fn) => fn());
  };
  const root = document.createElement("div");
  root.className = "raavl-waveform";
  root.dataset.raavlView = "";
  Object.assign(root.style, {
    position: "relative",
    overflowX: "auto",
    overflowY: "hidden",
    width: "100%",
  });
  const surface = document.createElement("div");
  surface.className = "raavl-surface";
  Object.assign(surface.style, {
    position: "relative",
    height: "100%",
    // The surface width defines the scroll range even when a canvas still has
    // its old offset during a zoom change.
    overflow: "clip",
  });
  const wave = document.createElement("canvas"),
    progress = document.createElement("canvas");
  wave.className = "raavl-wave";
  progress.className = "raavl-progress";
  wave.style.color = "var(--raavl-wave-color, #acbfa5)";
  progress.style.color = "var(--raavl-progress-color, #285d50)";
  for (const canvas of [wave, progress]) {
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      pointerEvents: "none",
    });
    surface.append(canvas);
  }
  const cursor = document.createElement("div");
  cursor.className = "raavl-cursor";
  Object.assign(cursor.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "2px",
    background:
      "var(--raavl-cursor-color, var(--raavl-default-cursor-color, #bd722e))",
    pointerEvents: "none",
  });
  surface.append(cursor);
  root.append(surface);
  container.append(root);
  root.setAttribute("role", player ? "slider" : "img");
  if (player) {
    root.tabIndex = 0;
    root.setAttribute("aria-valuemin", "0");
    root.setAttribute("aria-orientation", "horizontal");
  }
  const context = wave.getContext("2d"),
    progressContext = progress.getContext("2d");
  if (!context || !progressContext) {
    root.remove();
    throw failure("INVALID_DATA", "view", "Canvas 2D is unavailable");
  }
  const ctx = context,
    playedCtx = progressContext;
  const request = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(tick);
  };
  const invalidate = () => {
    dirty = true;
    request();
  };
  function draw() {
    width = Math.max(1, root.clientWidth);
    duration = getDuration();
    gestures.prepareDraw(width, duration);
    totalWidth = contentWidth(width, duration);
    surface.style.width = `${totalWidth}px`;
    gestures.finishLayout();
    root.style.height = `${appearance.height}px`;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    for (const canvas of [wave, progress]) {
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(appearance.height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${appearance.height}px`;
      canvas.style.left = `${root.scrollLeft}px`;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Resolve CSS colors against the canvas elements' current color scheme.
    ctx.fillStyle = canvasPaint(
      ctx,
      theme?.colors?.wave,
      getComputedStyle(wave).color,
      width,
      appearance.height,
    );
    if (data) {
      if (lastData !== data) {
        normalization = 0;
        for (const channel of data.channels)
          for (let i = 0; i < channel.min.length; i++)
            normalization = Math.max(
              normalization,
              Math.abs(channel.min[i]),
              Math.abs(channel.max[i]),
            );
        lastData = data;
      }
      const scale = appearance.normalize ? 1 / (normalization || 1) : 1;
      const rows = appearance.splitChannels
        ? data.channels
        : data.channels.slice(0, 1);
      const bottomChannel =
        !appearance.splitChannels && data.channels.length > 1
          ? data.channels[1]
          : null;
      const height = appearance.height / rows.length;
      const step =
        appearance.style === "bars"
          ? appearance.barWidth + appearance.barGap
          : 1;
      rows.forEach((channel, channelIndex) => {
        const center = height * (channelIndex + 0.5);
        const line = appearance.style === "line";
        if (line) {
          ctx.beginPath();
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = appearance.lineWidth;
          ctx.lineCap = "round";
        } else if (appearance.barRadius > 0) ctx.beginPath();
        // Draw only the viewport. Aggregate all buckets covered by a pixel/bar.
        for (let x = 0; x < width; x += step) {
          const start = Math.floor(
            ((root.scrollLeft + x) / totalWidth) * channel.min.length,
          );
          const end = Math.min(
            channel.min.length,
            Math.max(
              start + 1,
              Math.ceil(
                ((root.scrollLeft + x + step) / totalWidth) *
                  channel.min.length,
              ),
            ),
          );
          let lo = 0,
            hi = 0;
          for (let j = start; j < end; j++) {
            if (bottomChannel) {
              // Keep stereo channels distinct around one center line; do not
              // average samples, which could cancel opposite-phase signals.
              hi = Math.max(
                hi,
                Math.abs(channel.min[j]),
                Math.abs(channel.max[j]),
              );
              lo = Math.min(
                lo,
                -Math.abs(bottomChannel.min[j]),
                -Math.abs(bottomChannel.max[j]),
              );
            } else {
              lo = Math.min(lo, channel.min[j]);
              hi = Math.max(hi, channel.max[j]);
            }
          }
          const top =
            center - ((hi * height * appearance.amplitude) / 2) * scale;
          const bottom =
            center - ((lo * height * appearance.amplitude) / 2) * scale;
          const barHeight = Math.max(1, bottom - top);
          if (line) {
            ctx.moveTo(x + 0.5, top);
            ctx.lineTo(x + 0.5, top + barHeight);
          } else if (appearance.barRadius > 0) {
            ctx.roundRect(
              x,
              top,
              appearance.barWidth,
              barHeight,
              Math.min(
                appearance.barRadius,
                appearance.barWidth / 2,
                barHeight / 2,
              ),
            );
          } else ctx.fillRect(x, top, appearance.barWidth, barHeight);
        }
        if (line) ctx.stroke();
        else if (appearance.barRadius > 0) ctx.fill();
      });
    } else {
      ctx.globalAlpha = 0.35;
      const thickness = appearance.style === "line" ? appearance.lineWidth : 1;
      ctx.fillRect(0, (appearance.height - thickness) / 2, width, thickness);
      ctx.globalAlpha = 1;
    }
    playedCtx.drawImage(wave, 0, 0);
    playedCtx.globalCompositeOperation = "source-in";
    // Progress is composited in device pixels; its gradient must use that same space.
    playedCtx.fillStyle = canvasPaint(
      playedCtx,
      theme?.colors?.progress,
      getComputedStyle(progress).color,
      progress.width,
      progress.height,
    );
    playedCtx.fillRect(0, 0, progress.width, progress.height);
    playedCtx.globalCompositeOperation = "source-over";
    root.setAttribute("aria-label", label);
    annotationLayer.sync();
    publishViewport();
    onDraw?.();
  }
  function tick() {
    frame = 0;
    if (disposed) return;
    if (dirty) {
      dirty = false;
      draw();
    }
    const state = player?.getSnapshot();
    const time = player?.getMediaElement()?.currentTime ?? 0;
    const x = duration ? (time / duration) * totalWidth : 0;
    progress.style.clipPath = `inset(0 ${Math.max(0, width - (x - root.scrollLeft))}px 0 0)`;
    const cursorLeft = Math.min(
      x,
      Math.max(0, totalWidth - appearance.cursorWidth),
    );
    cursor.style.left = `${cursorLeft}px`;
    cursor.hidden = !player || !duration || appearance.cursorWidth === 0;
    if (player && !annotationOptions.annotations) {
      // Readiness can change without invalidating already supplied peak pixels.
      root.setAttribute("aria-valuemax", String(duration));
      root.setAttribute(
        "aria-disabled",
        String(state?.source !== "ready" || interaction.seek === "off"),
      );
      root.setAttribute("aria-valuenow", String(time));
      root.setAttribute(
        "aria-valuetext",
        `${time.toFixed(1)} of ${duration.toFixed(1)} seconds`,
      );
    }
    if (
      state?.playback === "playing" &&
      !gestures.isActive() &&
      !annotationLayer.isEditing()
    ) {
      if (viewport.follow === "center") root.scrollLeft = x - width / 2;
      else if (
        viewport.follow === "visible" &&
        (x < root.scrollLeft || x > root.scrollLeft + width - 10)
      )
        root.scrollLeft = Math.max(0, x - width * 0.15);
    }
    if (state?.playback === "playing" || state?.playback === "buffering")
      request();
  }
  const playRegion = (region: NonNullable<Selection>) => {
    if (player?.getSnapshot().source !== "ready") return;
    void player
      .playRange({ start: region.start, end: region.end })
      .catch(() => {});
  };
  const gestures = mountWaveformGestures({
    root,
    player,
    interaction: () => interaction,
    annotations: () => annotationLayer,
    geometry: () => ({ totalWidth, duration }),
    getDuration,
    contentWidth,
    playRegion,
    request,
    invalidate,
  });
  root.addEventListener("scroll", invalidate, { passive: true });
  const annotationLayer = mountAnnotations(
    container,
    root,
    surface,
    () => ({
      sourceId: player?.getSnapshot().sourceId ?? data?.sourceId ?? null,
      duration: getDuration(),
      width: totalWidth,
      channels: data?.channels.length ?? 0,
      splitChannels: appearance.splitChannels,
      selectMode: interaction.drag === "select",
    }),
    player ? playRegion : undefined,
  );
  const observer = new ResizeObserver(invalidate);
  observer.observe(root);
  let sourceId = player?.getSnapshot().sourceId;
  const unsubscribe = player?.subscribe(() => {
    const state = player.getSnapshot();
    if (state.sourceId !== sourceId || state.source !== "ready") {
      gestures.resetSource();
      sourceId = state.sourceId;
    }
    const next = state.data;
    if (next !== data || duration !== state.duration) {
      data = next;
      dirty = true;
    }
    if (state.source === "disposed") gestures.stopSeeking();
    annotationLayer.sync();
    request();
  });
  const unsubscribeTime = player?.subscribeTime(request);
  const view: WaveformView = {
    getViewport: () => viewportState,
    subscribeViewport(callback) {
      if (disposed) throw failure("DISPOSED", "view", "View has been disposed");
      viewportListeners.add(callback);
      return () => {
        viewportListeners.delete(callback);
      };
    },
    scrollTo(seconds) {
      if (disposed) throw failure("DISPOSED", "view", "View has been disposed");
      finite(seconds, "Viewport start");
      publishViewport();
      const span = viewportState.end - viewportState.start;
      root.scrollLeft =
        Math.min(seconds, Math.max(0, viewportState.duration - span)) *
        viewportState.pixelsPerSecond;
      publishViewport();
      invalidate();
    },
    update(patch) {
      if (disposed) throw failure("DISPOSED", "view", "View has been disposed");
      const nextTheme =
        "theme" in patch
          ? patch.theme == null
            ? null
            : parseTheme(patch.theme)
          : theme;
      const overrides = { ...appearanceOverrides };
      if (patch.appearance !== undefined) {
        validateAppearance(patch.appearance);
        for (const key of Object.keys(patch.appearance) as Array<
          keyof Appearance
        >) {
          if (patch.appearance[key] === undefined) delete overrides[key];
          else Object.assign(overrides, { [key]: patch.appearance[key] });
        }
      }
      const a = {
        ...defaults.appearance,
        ...nextTheme?.appearance,
        ...overrides,
      };
      const v = merge(viewport, patch.viewport, defaults.viewport);
      const i = merge(interaction, patch.interaction, defaults.interaction);
      validateAppearance(a);
      if (v.zoom !== "fit" && v.zoom !== "auto")
        finite(v.zoom, "Zoom", 0.01, maxZoom);
      if (
        !["line", "bars"].includes(a.style) ||
        !["off", "visible", "center"].includes(v.follow) ||
        !["click", "off"].includes(i.seek) ||
        !["none", "seek", "select"].includes(i.drag)
      )
        throw failure("INVALID_DATA", "view", "Unsupported view option");
      if (patch.data) {
        if (player)
          throw failure(
            "INVALID_DATA",
            "view",
            "Player views receive data from the player",
          );
        validateWaveform(patch.data);
      }
      const nextAnnotations = { ...annotationOptions };
      for (const key of [
        "annotations",
        "annotationEditor",
        "annotationRules",
        "snapAnnotation",
        "renderRegionLabel",
        "onSelectionChange",
        "onAnnotationSelect",
        "onAnnotationError",
      ] as const) {
        if (key in patch) Object.assign(nextAnnotations, { [key]: patch[key] });
      }
      annotationLayer.update(nextAnnotations);
      annotationOptions = nextAnnotations;
      root.setAttribute(
        "role",
        annotationOptions.annotations ? "group" : player ? "slider" : "img",
      );
      if (annotationOptions.annotations)
        for (const name of [
          "aria-valuemin",
          "aria-valuemax",
          "aria-valuenow",
          "aria-valuetext",
          "aria-orientation",
          "aria-disabled",
        ])
          root.removeAttribute(name);
      else if (player) {
        root.setAttribute("aria-valuemin", "0");
        root.setAttribute("aria-orientation", "horizontal");
      }
      appearance = a;
      appearanceOverrides = overrides;
      if ("theme" in patch)
        for (const [key, token] of Object.entries(colorTokens)) {
          const color = nextTheme?.colors?.[key as keyof typeof colorTokens];
          if (typeof color === "string") root.style.setProperty(token, color);
          else if (
            theme?.colors?.[key as keyof typeof colorTokens] !== undefined
          )
            root.style.removeProperty(token);
        }
      theme = nextTheme;
      root.style.setProperty(
        "--raavl-border-radius",
        `${appearance.borderRadius}px`,
      );
      cursor.style.width = `${appearance.cursorWidth}px`;
      if (
        (patch.viewport && "zoom" in patch.viewport) ||
        (patch.data && patch.data.sourceId !== data?.sourceId)
      )
        gestures.resetZoom();
      viewport = v;
      interaction = i;
      if (patch.data) data = patch.data;
      if (patch.label !== undefined) label = patch.label;
      if ("onDraw" in patch) onDraw = patch.onDraw;
      root.style.touchAction =
        interaction.drag === "seek" ? "pan-y" : "pan-x pan-y";
      invalidate();
    },
    refreshTheme: invalidate,
    getSelection: annotationLayer.getSelection,
    clearSelection: annotationLayer.clearSelection,
    createRegionFromSelection: annotationLayer.createRegionFromSelection,
    createRegionAtTime: annotationLayer.createRegionAtTime,
    dispose() {
      if (disposed) return;
      disposed = true;
      publishViewport();
      viewportListeners.clear();
      cancelAnimationFrame(frame);
      observer.disconnect();
      annotationLayer.dispose();
      unsubscribe?.();
      unsubscribeTime?.();
      gestures.dispose();
      root.removeEventListener("scroll", invalidate);
      root.remove();
    },
  };
  try {
    view.update(options);
  } catch (error) {
    view.dispose();
    throw error;
  }
  return view;
}

export { mountActionsToolbar, type ActionsToolbarOptions } from "./actions-toolbar.js";
export { mountMuteButton, mountLoopButton, type PlaybackToggleOptions } from "./playback-toggle.js";
