import type { Player } from "../core/types.js";
import { playbackToggleIcons } from "./playback-icons.js";

export type PlaybackToggleOptions = {
  player: Player;
  label?: string;
  children?: string | Node;
  onError?: (error: Error) => void;
};

export function mountMuteButton(
  container: HTMLElement,
  options: PlaybackToggleOptions,
) {
  return mountPlaybackToggle(container, options, "mute");
}

export function mountLoopButton(
  container: HTMLElement,
  options: PlaybackToggleOptions,
) {
  return mountPlaybackToggle(container, options, "loop");
}

function mountPlaybackToggle(
  container: HTMLElement,
  { player, label, children, onError }: PlaybackToggleOptions,
  kind: keyof typeof playbackToggleIcons,
) {
  const document = container.ownerDocument;
  const element = document.createElement("button");
  element.type = "button";
  element.className = `raavl-button raavl-${kind}`;

  let path: SVGPathElement | undefined;
  if (children === undefined) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.classList.add("raavl-toggle-icon");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    path = document.createElementNS(namespace, "path");
    svg.append(path);
    element.append(svg);
  } else {
    element.append(children);
  }

  function render() {
    const state = player.getSnapshot();
    const pressed = kind === "mute" ? state.muted : state.loop;
    const defaultLabel =
      kind === "loop" ? "Loop audio" : pressed ? "Unmute audio" : "Mute audio";
    element.disabled = state.source !== "ready";
    element.setAttribute("aria-label", label ?? defaultLabel);
    element.setAttribute("aria-pressed", String(pressed));
    path?.setAttribute("d", playbackToggleIcons[kind][pressed ? "on" : "off"]);
  }

  function toggle(event: MouseEvent) {
    const state = player.getSnapshot();
    if (event.defaultPrevented || element.disabled || state.source !== "ready") return;
    try {
      if (kind === "mute") player.setMuted(!state.muted);
      else player.setLoop(!state.loop);
    } catch (error) {
      onError?.(error as Error);
    }
  }
  element.addEventListener("click", toggle);
  const off =
    player.getSnapshot().source === "disposed" ? undefined : player.subscribe(render);
  render();
  container.append(element);
  return {
    element,
    dispose() {
      off?.();
      element.removeEventListener("click", toggle);
      element.remove();
    },
  };
}
