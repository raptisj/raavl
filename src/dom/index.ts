import { mountAnnotations, type AnnotationViewOptions } from "./annotations.js";
import type { Region, Selection } from "../regions/index.js";
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
  zoom?: number | "fit";
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
  createRegionFromSelection(id: string, label?: string): void;
  dispose(): void;
};

const defaults = {
  appearance: defaultAppearance,
  viewport: { zoom: "fit", follow: "visible" } as Required<Viewport>,
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
  let pointer: number | null = null;
  let dirty = true;
  let annotationOptions: AnnotationViewOptions = {};
  const player = options.player;
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
  const publishViewport = () => {
    const currentDuration =
      player?.getSnapshot().duration || data?.duration || 0;
    const currentWidth = Math.max(1, root.clientWidth);
    const contentWidth =
      viewport.zoom === "fit"
        ? currentWidth
        : Math.max(currentWidth, currentDuration * viewport.zoom);
    const pps = currentDuration ? contentWidth / currentDuration : 0;
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
      "var(--raavl-cursor-color, var(--raavl-progress-color, #285d50))",
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
    duration = player?.getSnapshot().duration || data?.duration || 0;
    totalWidth =
      viewport.zoom === "fit"
        ? width
        : Math.max(width, duration * viewport.zoom);
    surface.style.width = `${totalWidth}px`;
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
    const style = getComputedStyle(root);
    ctx.fillStyle = canvasPaint(
      ctx,
      theme?.colors?.wave,
      style.getPropertyValue("--raavl-wave-color").trim() || "#9aafa7",
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
      style.getPropertyValue("--raavl-progress-color").trim() || "#285d50",
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
      pointer === null &&
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
  const seekAt = (clientX: number) => {
    if (!player || player.getSnapshot().source !== "ready" || totalWidth <= 0)
      return;
    const x = clientX - root.getBoundingClientRect().left + root.scrollLeft;
    player.seekFraction(Math.max(0, Math.min(1, x / totalWidth)));
    request();
  };
  // Track taps directly so a drag, scroll, or cancelled touch cannot activate playback.
  let touch: {
    id: number;
    x: number;
    y: number;
    time: number;
    moved: boolean;
    regionId: string | undefined;
  } | null = null;
  let lastRegionTap: { id: string; x: number; y: number; time: number } | null =
    null;
  let lastTouchTime = -Infinity;
  let lastClickRegionId: string | undefined;
  let doubleClickBlocked = false;
  const playRegion = (region: Region) => {
    if (player?.getSnapshot().source !== "ready") return;
    void player
      .playRange({ start: region.start, end: region.end })
      .catch(() => {});
  };
  const touchDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    lastTouchTime = performance.now();
    const region = annotationLayer.getPlaybackTarget(event.target);
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      region === undefined ||
      !player ||
      player.getSnapshot().source !== "ready"
    ) {
      touch = null;
      lastRegionTap = null;
      pointer = null;
      return;
    }
    touch = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: lastTouchTime,
      moved: false,
      regionId: region?.id,
    };
  };
  const touchMove = (event: PointerEvent) => {
    if (!touch || event.pointerId !== touch.id) return;
    const dx = Math.abs(event.clientX - touch.x),
      dy = Math.abs(event.clientY - touch.y);
    touch.moved ||= Math.hypot(dx, dy) > 10;
    // Leave vertical scrolling and pinch zoom to the browser.
    if (
      touch.regionId === undefined &&
      touch.moved &&
      dx > dy &&
      interaction.drag === "seek"
    ) {
      pointer = event.pointerId;
      seekAt(event.clientX);
    }
  };
  const touchUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    lastTouchTime = performance.now();
    if (!touch || event.pointerId !== touch.id) return;
    const gesture = touch;
    touch = null;
    const previousTap = lastRegionTap;
    lastRegionTap = null;
    const target = annotationLayer.getPlaybackTarget(event.target, true);
    if (
      target === undefined ||
      target?.id !== gesture.regionId ||
      gesture.moved ||
      lastTouchTime - gesture.time > 350 ||
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10
    )
      return;
    if (
      target &&
      previousTap?.id === target.id &&
      lastTouchTime - previousTap.time <= 350 &&
      Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= 24
    ) {
      playRegion(target);
      return;
    }
    if (target)
      lastRegionTap = {
        id: target.id,
        x: event.clientX,
        y: event.clientY,
        time: lastTouchTime,
      };
    if (interaction.seek === "click") seekAt(event.clientX);
  };
  const touchCancel = (event: PointerEvent) => {
    if (touch?.id !== event.pointerId) return;
    touch = null;
    lastRegionTap = null;
    lastTouchTime = performance.now();
  };
  const click = (event: MouseEvent) => {
    if (event.button !== 0 || performance.now() - lastTouchTime < 700) return;
    const target = annotationLayer.getPlaybackTarget(event.target, true);
    if (event.detail > 0) {
      // Pointer capture can give clicks on different targets the same DOM target.
      doubleClickBlocked = event.detail > 1 && lastClickRegionId !== target?.id;
      lastClickRegionId = target?.id;
    }
    // A keyboard activation selects the focused annotation without a pointer position.
    if (event.detail === 0 && target) return;
    if (target !== undefined && interaction.seek === "click")
      seekAt(event.clientX);
  };
  const doubleClick = (event: MouseEvent) => {
    if (event.button !== 0 || performance.now() - lastTouchTime < 700) return;
    if (event.detail > 1 && doubleClickBlocked) return;
    const target = annotationLayer.getPlaybackTarget(event.target, true);
    if (target) playRegion(target);
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (annotationLayer.isAnnotationTarget(event.target)) return;
    if (
      !player ||
      event.button !== 0 ||
      interaction.drag !== "seek" ||
      player.getSnapshot().source !== "ready"
    )
      return;
    pointer = event.pointerId;
    root.setPointerCapture(pointer);
    seekAt(event.clientX);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (event.pointerId === pointer) seekAt(event.clientX);
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    if (root.hasPointerCapture(pointer)) root.releasePointerCapture(pointer);
    pointer = null;
  };
  const key = (event: KeyboardEvent) => {
    if (annotationLayer.isAnnotationTarget(event.target)) return;
    if (
      !player ||
      interaction.seek === "off" ||
      player.getSnapshot().source !== "ready"
    )
      return;
    const now = player.getMediaElement()?.currentTime ?? 0;
    const step = event.shiftKey ? 10 : 1;
    const times: Record<string, number> = {
      ArrowRight: now + step,
      ArrowLeft: now - step,
      Home: 0,
      End: duration,
    };
    if (event.key in times) {
      event.preventDefault();
      player.seek(Math.max(0, Math.min(duration, times[event.key])));
      request();
    }
  };
  root.addEventListener("click", click);
  root.addEventListener("dblclick", doubleClick);
  root.addEventListener("keydown", key);
  root.addEventListener("pointerdown", touchDown);
  root.addEventListener("pointermove", touchMove);
  root.addEventListener("pointerup", touchUp);
  root.addEventListener("pointercancel", touchCancel);
  root.addEventListener("lostpointercapture", touchCancel);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("lostpointercapture", up);
  root.addEventListener("scroll", invalidate, { passive: true });
  const annotationLayer = mountAnnotations(
    container,
    root,
    surface,
    () => ({
      sourceId: player?.getSnapshot().sourceId ?? data?.sourceId ?? null,
      duration: player?.getSnapshot().duration || data?.duration || 0,
      width: totalWidth,
      channels: data?.channels.length ?? 0,
      splitChannels: appearance.splitChannels,
      selectMode: interaction.drag === "select",
    }),
    player?.getCurrentTime,
  );
  const observer = new ResizeObserver(invalidate);
  observer.observe(root);
  let tapSourceId = player?.getSnapshot().sourceId;
  const unsubscribe = player?.subscribe(() => {
    if (
      player.getSnapshot().sourceId !== tapSourceId ||
      player.getSnapshot().source !== "ready"
    ) {
      touch = null;
      lastRegionTap = null;
      lastClickRegionId = undefined;
      doubleClickBlocked = false;
      tapSourceId = player.getSnapshot().sourceId;
    }
    const next = player.getSnapshot().data;
    if (next !== data || duration !== player.getSnapshot().duration) {
      data = next;
      dirty = true;
    }
    if (player.getSnapshot().source === "disposed") pointer = null;
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
      if (v.zoom !== "fit") finite(v.zoom, "Zoom", 0.01, 10000);
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
      viewport = v;
      interaction = i;
      if (patch.data) data = patch.data;
      if (patch.label !== undefined) label = patch.label;
      if ("onDraw" in patch) onDraw = patch.onDraw;
      root.style.touchAction =
        interaction.drag !== "none" ? "pan-y pinch-zoom" : "manipulation";
      invalidate();
    },
    refreshTheme: invalidate,
    getSelection: annotationLayer.getSelection,
    clearSelection: annotationLayer.clearSelection,
    createRegionFromSelection: annotationLayer.createRegionFromSelection,
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
      root.removeEventListener("click", click);
      root.removeEventListener("dblclick", doubleClick);
      root.removeEventListener("keydown", key);
      touch = null;
      lastRegionTap = null;
      root.removeEventListener("pointerdown", touchDown);
      root.removeEventListener("pointermove", touchMove);
      root.removeEventListener("pointerup", touchUp);
      root.removeEventListener("pointercancel", touchCancel);
      root.removeEventListener("lostpointercapture", touchCancel);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("lostpointercapture", up);
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
