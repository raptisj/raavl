import type { Player } from "../core/types.js";
import type { Selection } from "../regions/index.js";
import { playbackState } from "../core/playback-state.js";
import { playbackIcons } from "./playback-icons.js";

export type ActionsToolbarOptions = {
  player: Player | null;
  /** Selected region or temporary selection. */
  range?: Selection;
  /** Source owning the range; mismatched audio disables range playback. */
  sourceId?: string | null;
  variant?: "icons" | "text" | "icons-text";
  disabled?: boolean;
  /** Create a region starting at the current playhead. */
  onCreateRegion?: (time: number) => void | Promise<void>;
  onError?: (error: Error) => void;
};

/** Mount the same playback actions used by the React ActionsToolbar. */
export function mountActionsToolbar(
  container: HTMLElement,
  initial: ActionsToolbarOptions,
) {
  return mountPlaybackActions(container, initial);
}

export function mountPlaybackActions(
  container: HTMLElement,
  initial: ActionsToolbarOptions,
  regionOnly = false,
) {
  let options = initial;
  let disposed = false;
  const document = container.ownerDocument;
  const element = document.createElement("div");
  element.className = regionOnly
    ? "raavl-region-actions"
    : "raavl-toolbar raavl-actions-toolbar";
  if (!regionOnly) {
    element.setAttribute("role", "group");
    element.setAttribute("aria-label", "Playback actions");
  }
  const paths = {
    ...playbackIcons,
    create: "M4 5v14M20 5v14M8 12h8M12 8v8",
    region: "M4 5v14M20 5v14M9 8l7 4-7 4Z",
    loop: "M4 10a6 6 0 0 1 6-6h9m-3-3 3 3-3 3M20 14a6 6 0 0 1-6 6H5m3-3-3 3 3 3",
  };
  function button() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "raavl-button";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    svg.append(path);
    const text = document.createElement("span");
    button.append(svg, text);
    element.append(button);
    return { button, svg, path, text };
  }
  const play = regionOnly ? null : button(),
    region = button(),
    loop = button(),
    create = button();
  play?.svg.classList.add("raavl-play-pause-icon");
  const time = regionOnly ? null : document.createElement("output");
  if (time) {
    time.className = "raavl-time";
    time.setAttribute("aria-label", "Playback time");
    time.setAttribute("aria-live", "off");
    element.append(time);
  }
  container.append(element);
  function paint(
    control: ReturnType<typeof button>,
    label: string,
    icon: keyof typeof paths,
  ) {
    control.button.setAttribute("aria-label", label);
    control.button.title = label;
    control.path.setAttribute("d", paths[icon]);
    control.svg.style.display = options.variant === "text" ? "none" : "";
    control.text.hidden = !options.variant || options.variant === "icons";
    control.text.textContent = label;
  }
  function renderTime() {
    const current = options.player?.getCurrentTime() ?? 0;
    const state = options.player?.getSnapshot();
    if (time) time.textContent = `${current.toFixed(2)}s`;
    create.button.disabled =
      !!options.disabled ||
      !options.onCreateRegion ||
      state?.source !== "ready" ||
      current >= state.duration ||
      (options.sourceId !== undefined && options.sourceId !== state.sourceId);
  }
  function render() {
    const state = options.player?.getSnapshot();
    const transport = playbackState(
      state?.playback,
      state?.source === "ready",
      options.disabled,
    );
    if (play) {
      const { playing } = transport;
      paint(play, playing ? "Pause" : "Play", playing ? "pause" : "play");
      play.button.classList.toggle(
        "raavl-play-pause-icon-button",
        !options.variant || options.variant === "icons",
      );
      play.button.disabled = transport.disabled;
    }
    paint(region, "Play region", "region");
    paint(loop, "Loop region", "loop");
    paint(create, "Create region at playhead", "create");
    const range = options.range;
    region.button.disabled = loop.button.disabled =
      transport.disabled ||
      !range ||
      !Number.isFinite(range.start) ||
      !Number.isFinite(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      range.end > (state?.duration ?? 0) ||
      (options.sourceId !== undefined && options.sourceId !== state?.sourceId);
    renderTime();
  }
  function run(command: (player: Player) => void | Promise<void>) {
    const player = options.player;
    if (!player || player.getSnapshot().source !== "ready" || options.disabled)
      return;
    const report = options.onError;
    try {
      Promise.resolve(command(player)).catch((error) => {
        if (!disposed) report?.(error);
      });
    } catch (error) {
      report?.(error as Error);
    }
  }
  if (play) {
    play.button.onclick = () =>
      run((player) => {
        const { playing } = playbackState(player.getSnapshot().playback, true);
        return playing ? player.pause() : player.play();
      });
  }
  region.button.onclick = () =>
    run((player) => {
      if (options.range) return player.playRange(options.range);
    });
  loop.button.onclick = () =>
    run((player) => {
      if (options.range)
        return player.playRange({ ...options.range, loop: true });
    });
  create.button.onclick = () =>
    run((player) => options.onCreateRegion?.(player.getCurrentTime()));
  let off: (() => void) | undefined, offTime: (() => void) | undefined;
  function subscribe() {
    off?.();
    offTime?.();
    const player = options.player;
    if (player && player.getSnapshot().source !== "disposed") {
      off = player.subscribe(render);
      offTime = player.subscribeTime(renderTime);
    }
    render();
  }
  subscribe();
  return {
    element,
    update(next: Partial<ActionsToolbarOptions>) {
      if (disposed) return;
      const previous = options.player;
      options = { ...options, ...next };
      if (previous !== options.player) subscribe();
      else render();
    },
    dispose() {
      disposed = true;
      off?.();
      offTime?.();
      element.remove();
    },
  };
}
