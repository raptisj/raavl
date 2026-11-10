import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  usePlayer,
  usePlayerState,
  usePlayerTime,
  type UsePlayerOptions,
} from "../src/react";
import * as playerModule from "../src/player";
import type { Player, Source } from "../src/core/types";
import { mockMedia } from "./media";

let host: HTMLDivElement, root: Root | undefined;
let mock: ReturnType<typeof mockMedia>, player: Player | null;
const source: Source = {
  kind: "url",
  id: "episode",
  url: "/episode.mp3",
  waveform: { kind: "none" },
};

beforeEach(() => {
  mock = mockMedia();
  host = document.createElement("div");
  document.body.append(host);
  player = null;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host.remove();
  vi.unstubAllGlobals();
});

function Probe({ options }: { options?: UsePlayerOptions }) {
  player = usePlayer(options);
  const state = usePlayerState(
    player,
    (snapshot) => snapshot?.source ?? "unmounted",
  );
  const time = usePlayerTime(player);
  return (
    <output>
      {state}:{time}
    </output>
  );
}
async function render(options?: UsePlayerOptions) {
  root ??= createRoot(host);
  await act(async () =>
    root!.render(
      <StrictMode>
        <Probe options={options} />
      </StrictMode>,
    ),
  );
  expect(player).not.toBeNull();
  return player!;
}

it("owns a headless player through Strict Mode, playback, time subscriptions and cleanup", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  const active = await render({ source });
  expect(create).toHaveBeenCalledTimes(2);
  const instances = create.mock.results.map((result) => result.value as Player);
  expect(instances[0].getSnapshot().source).toBe("disposed");
  expect(instances[1]).toBe(active);
  expect(host.querySelector("canvas")).toBeNull();
  const element = active.getMediaElement()!;
  await act(async () => mock.ready(element));
  expect(host.textContent).toBe("ready:0");
  await act(async () => {
    await active.play();
    active.seek(3);
  });
  expect(active.getSnapshot().playback).toBe("playing");
  expect(host.textContent).toBe("ready:3");
  await act(async () => root!.unmount());
  root = undefined;
  expect(
    instances.every((instance) => instance.getSnapshot().source === "disposed"),
  ).toBe(true);
  expect(element.paused).toBe(true);
  expect(active.getMediaElement()).toBeNull();
});

it("supports an idle player with imperative loading", async () => {
  const active = await render();
  expect(active.getSnapshot().source).toBe("idle");
  expect(mock.load).not.toHaveBeenCalled();
  await act(async () => {
    const loading = active.setSource(source);
    mock.ready(active.getMediaElement()!);
    await loading;
  });
  await render();
  expect(player).toBe(active);
  expect(active.getSnapshot().source).toBe("ready");
});

it("preserves playback for equivalent inline descriptors and new error callbacks", async () => {
  const active = await render({ source: { ...source }, onError: () => {} });
  const element = active.getMediaElement()!;
  await act(async () => {
    mock.ready(element);
    await active.play();
    active.seek(4);
  });
  const loads = mock.load.mock.calls.length;
  const onError = vi.fn();
  await render({ source: { ...source }, onError });
  expect(player).toBe(active);
  expect(active.getMediaElement()).toBe(element);
  expect(active.getCurrentTime()).toBe(4);
  expect(active.getSnapshot().playback).toBe("playing");
  expect(mock.load).toHaveBeenCalledTimes(loads);
  mock.play.mockRejectedValueOnce(new Error("Blocked"));
  await act(async () => {
    await expect(active.play()).rejects.toMatchObject({ code: "MEDIA" });
  });
  expect(onError).toHaveBeenCalledExactlyOnceWith(active.getSnapshot().error);
});

it("replaces pending sources, ignores stale metadata and clears a source without replacing the player", async () => {
  const onError = vi.fn();
  const active = await render({ source, onError });
  const old = active.getMediaElement()!;
  await render({
    source: { ...source, id: "next", url: "/next.mp3" },
    onError,
  });
  expect(player).toBe(active);
  const next = active.getMediaElement()!;
  expect(next).not.toBe(old);
  await act(async () => mock.ready(old, 99));
  expect(active.getSnapshot()).toMatchObject({ sourceId: "next", duration: 0 });
  await act(async () => mock.ready(next, 20));
  expect(active.getSnapshot()).toMatchObject({ source: "ready", duration: 20 });
  await render({ source: null, onError });
  expect(player).toBe(active);
  expect(active.getSnapshot().source).toBe("idle");
  expect(active.getMediaElement()).toBeNull();
  expect(onError).not.toHaveBeenCalled();
});

it("reloads when a source revision or waveform input changes", async () => {
  const active = await render({ source });
  const first = active.getMediaElement();
  await render({ source: { ...source, revision: "2" } });
  const second = active.getMediaElement();
  expect(second).not.toBe(first);
  const data = {
    version: 1 as const,
    sourceId: "episode",
    sourceRevision: "2",
    duration: 10,
    channels: [{ min: [-0.5], max: [0.5] }],
  };
  await render({
    source: { ...source, revision: "2", waveform: { kind: "peaks", data } },
  });
  expect(active.getMediaElement()).not.toBe(second);
  expect(active.getSnapshot().waveform).toBe("ready");
  expect(active.getSnapshot().data?.sourceRevision).toBe("2");
});

it("reports source failures once across snapshots and promise rejection, and waveform failures without a view", async () => {
  const onError = vi.fn();
  const active = await render({ source, onError });
  await act(async () =>
    active.getMediaElement()!.dispatchEvent(new Event("error")),
  );
  expect(onError).toHaveBeenCalledExactlyOnceWith(active.getSnapshot().error);
  const data = {
    version: 1 as const,
    sourceId: "wrong",
    duration: 10,
    channels: [{ min: [-0.5], max: [0.5] }],
  };
  await render({
    source: { ...source, waveform: { kind: "peaks", data } },
    onError,
  });
  expect(onError).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenLastCalledWith(active.getSnapshot().waveformError);
  await act(async () => mock.ready(active.getMediaElement()!));
  expect(active.getSnapshot().source).toBe("ready");
  expect(onError).toHaveBeenCalledTimes(2);
});

it("handles rejected source validation and cancels pending loads silently on unmount", async () => {
  const onError = vi.fn();
  const active = await render({ source: { ...source, url: "" }, onError });
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0][0]).toMatchObject({ code: "INVALID_DATA" });
  await render({ source, onError });
  const element = active.getMediaElement()!;
  await act(async () => root!.unmount());
  root = undefined;
  mock.ready(element);
  await Promise.resolve();
  expect(active.getSnapshot().source).toBe("disposed");
  expect(onError).toHaveBeenCalledOnce();
});

it("borrows a playing player without loading, clearing or disposing it", async () => {
  const borrowed = playerModule.createPlayer();
  try {
    const loading = borrowed.setSource(source);
    mock.ready(borrowed.getMediaElement()!);
    await loading;
    await borrowed.play();
    borrowed.seek(5);
    const setSource = vi.spyOn(borrowed, "setSource");
    const clear = vi.spyOn(borrowed, "clearSource");
    const dispose = vi.spyOn(borrowed, "dispose");
    const onError = vi.fn();
    expect(await render({ player: borrowed, onError })).toBe(borrowed);
    await render({ player: borrowed, onError });
    mock.play.mockRejectedValueOnce(new Error("Blocked"));
    await act(async () => {
      await expect(borrowed.play()).rejects.toMatchObject({ code: "MEDIA" });
    });
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      borrowed.getSnapshot().error,
    );
    await act(async () => root!.unmount());
    root = undefined;
    expect(setSource).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
    expect(borrowed.getSnapshot().source).toBe("ready");
    expect(borrowed.getCurrentTime()).toBe(5);
  } finally {
    borrowed.dispose();
  }
});

it("switches ownership without disposing borrowed players or reusing a disposed owned player", async () => {
  const borrowed = playerModule.createPlayer();
  try {
    const first = await render({ source });
    expect(await render({ player: borrowed })).toBe(borrowed);
    expect(first.getSnapshot().source).toBe("disposed");
    const next = await render({ source });
    expect(next).not.toBe(first);
    expect(next.getSnapshot().source).toBe("loading");
    expect(borrowed.getSnapshot().source).toBe("idle");
  } finally {
    borrowed.dispose();
  }
});

it("does not create a player when explicitly borrowing a null controller", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <StrictMode>
        <Probe options={{ player: null }} />
      </StrictMode>,
    ),
  );
  expect(player).toBeNull();
  expect(create).not.toHaveBeenCalled();
  expect(mock.load).not.toHaveBeenCalled();
});
