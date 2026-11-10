import { failure } from "../core/data.js";
import { mountWaveform, type WaveformView } from "../dom/index.js";
import type { Player, WaveformData } from "../core/types.js";
export type MinimapOptions = {
  view: WaveformView;
  height?: number;
  label?: string;
} & ({ player: Player; data?: never } | { data: WaveformData; player?: never });
/** An overview that changes viewport position without seeking audio. */
export function mountMinimap(container: HTMLElement, options: MinimapOptions) {
  if (options.view.getViewport().disposed)
    throw failure(
      "DISPOSED",
      "view",
      "Cannot attach a minimap to a disposed view",
    );
  const root = document.createElement("div"),
    visual = document.createElement("div");
  root.className = "raavl-minimap";
  root.style.position = "relative";
  visual.setAttribute("aria-hidden", "true");
  visual.inert = true;
  root.append(visual);
  container.append(root);
  let overview: WaveformView;
  try {
    overview = mountWaveform(visual, {
      ...(options.player
        ? { player: options.player }
        : { data: options.data! }),
      appearance: { height: options.height ?? 64 },
      viewport: { zoom: "fit", follow: "off" },
      interaction: { seek: "off", drag: "none" },
    });
  } catch (error) {
    root.remove();
    throw error;
  }
  const control = document.createElement("div"),
    window = document.createElement("span");
  control.className = "raavl-minimap-control";
  window.className = "raavl-minimap-window";
  Object.assign(control.style, {
    position: "absolute",
    inset: "0",
    touchAction: "none",
  });
  Object.assign(window.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    pointerEvents: "none",
  });
  control.tabIndex = 0;
  control.setAttribute("role", "slider");
  control.setAttribute("aria-label", options.label ?? "Waveform viewport");
  control.setAttribute("aria-orientation", "horizontal");
  control.setAttribute("aria-valuemin", "0");
  control.append(window);
  root.append(control);
  let disposed = false,
    pointer: number | null = null,
    anchor = 0,
    pointerSource: string | null = null;
  const state = () => options.view.getViewport();
  const available = () =>
    !state().disposed &&
    state().duration > 0 &&
    state().sourceId ===
      (options.player?.getSnapshot().sourceId ?? options.data?.sourceId);
  const span = () => state().end - state().start;
  function render() {
    if (disposed) return;
    const s = state(),
      enabled = available();
    control.setAttribute("aria-disabled", String(!enabled));
    control.tabIndex = enabled ? 0 : -1;
    control.setAttribute(
      "aria-valuemax",
      String(Math.max(0, s.duration - span())),
    );
    control.setAttribute("aria-valuenow", String(s.start));
    control.setAttribute(
      "aria-valuetext",
      `${s.start.toFixed(2)} to ${s.end.toFixed(2)} seconds visible`,
    );
    window.hidden = !enabled;
    window.style.left = `${s.duration ? (s.start / s.duration) * 100 : 0}%`;
    window.style.width = `${s.duration ? (span() / s.duration) * 100 : 100}%`;
  }
  const timeAt = (x: number) =>
    ((x - control.getBoundingClientRect().left) /
      Math.max(1, control.clientWidth)) *
    state().duration;
  const move = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    if (!available() || state().sourceId !== pointerSource) {
      release();
      return;
    }
    options.view.scrollTo(Math.max(0, timeAt(event.clientX) - anchor));
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !available() || pointer !== null) return;
    event.preventDefault();
    control.focus({ preventScroll: true });
    const time = timeAt(event.clientX);
    anchor =
      time >= state().start && time <= state().end
        ? time - state().start
        : span() / 2;
    pointer = event.pointerId;
    pointerSource = state().sourceId;
    control.setPointerCapture(pointer);
    move(event);
  };
  const release = () => {
    if (pointer !== null && control.hasPointerCapture(pointer))
      control.releasePointerCapture(pointer);
    pointer = null;
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === pointer) release();
  };
  const key = (event: KeyboardEvent) => {
    if (!available()) return;
    const step = span() * (event.shiftKey ? 1 : 0.1);
    const positions: Record<string, number> = {
      ArrowLeft: state().start - step,
      ArrowRight: state().start + step,
      Home: 0,
      End: state().duration,
    };
    if (!(event.key in positions)) return;
    event.preventDefault();
    options.view.scrollTo(Math.max(0, positions[event.key]));
  };
  control.addEventListener("pointerdown", down);
  control.addEventListener("pointermove", move);
  control.addEventListener("pointerup", up);
  control.addEventListener("pointercancel", up);
  control.addEventListener("lostpointercapture", up);
  control.addEventListener("keydown", key);
  const off = options.view.subscribeViewport(render),
    offPlayer = options.player?.subscribe(render);
  render();
  return {
    refreshTheme: () => overview.refreshTheme(),
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      off();
      offPlayer?.();
      overview.dispose();
      control.removeEventListener("pointerdown", down);
      control.removeEventListener("pointermove", move);
      control.removeEventListener("pointerup", up);
      control.removeEventListener("pointercancel", up);
      control.removeEventListener("lostpointercapture", up);
      control.removeEventListener("keydown", key);
      root.remove();
    },
  };
}
