import type { PlayerSnapshot } from "./types.js";

/** Shared transport decisions; rendering and error handling stay with each view. */
export function playbackState(
  playback: PlayerSnapshot["playback"] | undefined,
  ready: boolean,
  disabled = false,
) {
  return {
    playing: playback === "playing" || playback === "buffering",
    pending: playback === "starting",
    buffering: playback === "buffering",
    disabled: disabled || !ready || playback === "starting",
  };
}
