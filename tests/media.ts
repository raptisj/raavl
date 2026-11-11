import { vi } from "vitest";

export function mockMedia() {
  const states = new WeakMap<
    HTMLMediaElement,
    { duration: number; readyState: number; paused: boolean }
  >();
  const state = (media: HTMLMediaElement) => {
    if (!states.has(media))
      states.set(media, { duration: NaN, readyState: 0, paused: true });
    return states.get(media)!;
  };
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockImplementation(
    function (this: HTMLMediaElement) {
      return state(this).duration;
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockImplementation(
    function (this: HTMLMediaElement) {
      return state(this).readyState;
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(
    function (this: HTMLMediaElement) {
      return state(this).paused;
    },
  );
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(function (this: HTMLMediaElement) {
      state(this).paused = true;
      this.dispatchEvent(new Event("pause"));
    });
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementation(async function (this: HTMLMediaElement) {
      state(this).paused = false;
      this.dispatchEvent(new Event("play"));
    });
  return {
    load,
    pause,
    play,
    ready(media: HTMLMediaElement, duration = 10) {
      Object.assign(state(media), { duration, readyState: 4 });
      media.dispatchEvent(new Event("loadedmetadata"));
      media.dispatchEvent(new Event("canplay"));
    },
    changeDuration(media: HTMLMediaElement, duration: number) {
      state(media).duration = duration;
      media.dispatchEvent(new Event("durationchange"));
    },
  };
}
