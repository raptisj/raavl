import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { OwnershipPreview } from "../examples/live/OwnershipPreview";
import * as playerModule from "../src/player";
import type { Player } from "../src";
import { mockMedia } from "./media";

let host: HTMLDivElement, root: Root | undefined;
let mock: ReturnType<typeof mockMedia>;
let frames: Map<number, FrameRequestCallback>, next: number;
beforeEach(() => {
  mock = mockMedia();
  host = document.createElement("div");
  document.body.append(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  frames = new Map(); next = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = next++; frames.set(id, callback); return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform() {}, fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, roundRect() {}, fill() {},
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) })));
  vi.stubGlobal("AudioContext", class {
    async decodeAudioData() {
      return { duration: 12, numberOfChannels: 1, length: 2, getChannelData: () => new Float32Array([-.5, .5]) };
    }
    async close() {}
  });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; host.remove(); vi.unstubAllGlobals();
});
function button(text: string) {
  return [...host.querySelectorAll("button")].find(button => button.textContent === text)!;
}

it("stops an owned episode when removed and restores it as a fresh player", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  root = createRoot(host);
  await act(async () => root!.render(<StrictMode><OwnershipPreview kind="source" /></StrictMode>));
  const active = create.mock.results.at(-1)!.value as Player;
  const media = active.getMediaElement()!;
  await act(async () => mock.ready(media, 12));
  await act(async () => button("Play").click());
  expect(active.getSnapshot().playback).toBe("playing");
  await act(async () => button("Remove episode card").click());
  expect(active.getSnapshot().source).toBe("disposed");
  expect(media.paused).toBe(true);
  expect(host.querySelector("canvas")).toBeNull();
  expect(host.textContent).toContain("Episode card removed");
  await act(async () => button("Restore episode card").click());
  const restored = create.mock.results.at(-1)!.value as Player;
  expect(restored).not.toBe(active);
  expect(restored.getCurrentTime()).toBe(0);
  expect(host.querySelector("canvas")).not.toBeNull();
  await act(async () => root!.unmount()); root = undefined;
  expect(create.mock.results.every(result => result.value.getSnapshot().source === "disposed")).toBe(true);
  expect(frames.size).toBe(0);
});

it("keeps the shared player and clock alive when its waveform is hidden", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  root = createRoot(host);
  await act(async () => root!.render(<StrictMode><OwnershipPreview kind="player" /></StrictMode>));
  const active = create.mock.results.at(-1)!.value as Player;
  const media = active.getMediaElement()!;
  await act(async () => mock.ready(media, 12));
  await act(async () => button("Play").click());
  const instances = create.mock.calls.length;
  mock.pause.mockClear();
  await act(async () => button("Hide waveform").click());
  expect(host.querySelector("canvas")).toBeNull();
  expect(active.getSnapshot().playback).toBe("playing");
  expect(mock.pause).not.toHaveBeenCalled();
  expect(button("Show waveform").getAttribute("aria-expanded")).toBe("false");
  await act(async () => active.seek(4));
  expect(host.querySelector("output")?.textContent).toBe("4.0 s");
  await act(async () => button("Show waveform").click());
  expect(host.querySelector("canvas")).not.toBeNull();
  expect(active.getMediaElement()).toBe(media);
  expect(create).toHaveBeenCalledTimes(instances);
  expect(active.getCurrentTime()).toBe(4);
  await act(async () => root!.unmount()); root = undefined;
  expect(active.getSnapshot().source).toBe("disposed");
  expect(frames.size).toBe(0);
});
