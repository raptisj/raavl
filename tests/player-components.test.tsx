import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  AudioPlayer,
  PlayerRoot,
  Waveform,
  PlayPauseButton,
  SeekSlider,
  TimeDisplay,
  VolumeSlider,
  MuteButton,
  PlaybackRateSelect,
  LoopButton,
  PlayerStatus,
  usePlayerContext,
  type AudioPlayerProps,
} from "../src/react";
import * as playerModule from "../src/player";
import { Examples } from "../examples/live/Examples";
import type { Player, Source } from "../src/core/types";
import { mockMedia } from "./media";

let host: HTMLDivElement,
  root: Root | undefined,
  mock: ReturnType<typeof mockMedia>;
let player: Player | null,
  frames: Map<number, FrameRequestCallback>,
  next: number;
const source: Source = {
  kind: "url",
  id: "episode",
  url: "/episode.mp3",
  waveform: { kind: "none" },
};
const onPlayer = (value: Player | null) => {
  player = value;
};
beforeEach(() => {
  mock = mockMedia();
  player = null;
  host = document.createElement("div");
  document.body.append(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  frames = new Map();
  next = 1;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    const id = next++;
    frames.set(id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform() {},
    fillRect() {},
    drawImage() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    roundRect() {},
    fill() {},
  } as unknown as CanvasRenderingContext2D);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  host.remove();
  vi.unstubAllGlobals();
});
async function render(props: Partial<AudioPlayerProps> = {}) {
  root ??= createRoot(host);
  await act(async () =>
    root!.render(
      <StrictMode>
        <AudioPlayer source={source} onPlayer={onPlayer} {...props} />
      </StrictMode>,
    ),
  );
  return player!;
}
const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const input = (label: string) =>
  host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
    element,
    value,
  );
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
function pointer(element: Element, name: string) {
  const event = new MouseEvent(name, { bubbles: true, button: 0 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  element.dispatchEvent(event);
}
async function ready(active: Player) {
  await act(async () => mock.ready(active.getMediaElement()!, 100));
}

it("creates one active controller for the complete player and waveform through Strict Mode", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  const active = await render();
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.results[0].value.getSnapshot().source).toBe("disposed");
  expect(host.querySelectorAll(".raavl-waveform")).toHaveLength(1);
  expect(button("Play audio").disabled).toBe(true);
  expect(host.textContent).toContain("Loading audio");
  await ready(active);
  expect(button("Play audio").disabled).toBe(false);
  await act(async () => button("Play audio").click());
  expect(active.getSnapshot().playback).toBe("playing");
  expect(button("Pause audio").textContent).toBe("Pause");
  await act(async () => button("Pause audio").click());
  expect(active.getSnapshot().playback).toBe("paused");
  await act(async () => root!.unmount());
  root = undefined;
  expect(active.getSnapshot().source).toBe("disposed");
  expect(frames.size).toBe(0);
});

it("reconfigures visibility, control behavior and slots without replacing the player or media", async () => {
  const active = await render();
  await ready(active);
  const media = active.getMediaElement(),
    loads = mock.load.mock.calls.length;
  await act(async () => active.play());
  await render({
    waveform: false,
    controls: {
      seek: false,
      volume: false,
      time: { mode: "remaining" },
      playbackRate: { options: [1, 2] },
      loop: true,
    },
    slots: { mute: <MuteButton>Custom mute</MuteButton> },
  });
  expect(player).toBe(active);
  expect(active.getMediaElement()).toBe(media);
  expect(mock.load).toHaveBeenCalledTimes(loads);
  expect(active.getSnapshot().playback).toBe("playing");
  expect(host.querySelector("canvas")).toBeNull();
  expect(input("Volume")).toBeNull();
  expect(input("Seek audio")).toBeNull();
  expect(host.querySelector("output")!.textContent).toBe("−1:40");
  expect(button("Mute audio").textContent).toBe("Custom mute");
  expect(button("Loop audio")).toBeTruthy();
  await render({ controls: false, status: false });
  expect(host.querySelector(".raavl-controls")).toBeNull();
  expect(host.querySelector(".raavl-status")).toBeNull();
  expect(host.querySelector(".raavl-waveform")).toBeTruthy();
  expect(active.getMediaElement()).toBe(media);
});

it("supports volume, mute, loop and speed using the shared media state", async () => {
  const active = await render({ controls: { loop: true, playbackRate: true } });
  await ready(active);
  await act(async () => change(input("Volume"), ".35"));
  expect(active.getSnapshot().volume).toBe(0.35);
  await act(async () => button("Mute audio").click());
  expect(active.getSnapshot().muted).toBe(true);
  expect(button("Unmute audio").getAttribute("aria-pressed")).toBe("true");
  await act(async () => button("Loop audio").click());
  expect(active.getSnapshot().loop).toBe(true);
  await act(async () => change(host.querySelector("select")!, "1.5"));
  expect(active.getSnapshot().playbackRate).toBe(1.5);
  await act(async () => active.setVolume(0.6));
  expect(input("Volume").value).toBe("0.6");
});

it("preserves owned player settings across source changes and resets time", async () => {
  const active = await render();
  await ready(active);
  await act(async () => {
    active.setVolume(0.3);
    active.setMuted(true);
    active.setPlaybackRate(1.5);
    active.setLoop(true);
    active.seek(12);
  });
  const old = active.getMediaElement();
  await render({ source: { ...source, id: "next", url: "/next.mp3" } });
  await ready(active);
  expect(active.getMediaElement()).not.toBe(old);
  expect(active.getSnapshot()).toMatchObject({
    sourceId: "next",
    volume: 0.3,
    muted: true,
    playbackRate: 1.5,
    loop: true,
  });
  expect(active.getCurrentTime()).toBe(0);
});

it("seeks with native range changes, holds the drag value during clock updates, and releases it on blur", async () => {
  const active = await render();
  await ready(active);
  const slider = input("Seek audio");
  await act(async () => change(slider, "20"));
  expect(active.getCurrentTime()).toBe(20);
  await act(async () => pointer(slider, "pointerdown"));
  await act(async () => change(slider, "40"));
  await act(async () => active.seek(45));
  expect(slider.value).toBe("40");
  expect(slider.getAttribute("aria-valuetext")).toBe("0:40 of 1:40");
  await act(async () => pointer(slider, "pointerup"));
  expect(slider.value).toBe("45");
  await act(async () => pointer(slider, "pointerdown"));
  await act(async () => {
    change(slider, "50");
    active.seek(55);
  });
  await act(async () =>
    slider.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
  );
  expect(slider.value).toBe("55");
});

it("cancels a seek gesture on source replacement and ignores stale input until release", async () => {
  const active = await render();
  await ready(active);
  const slider = input("Seek audio");
  await act(async () => pointer(slider, "pointerdown"));
  await act(async () => change(slider, "30"));
  await render({ source: { ...source, revision: "2" } });
  await ready(active);
  await act(async () => change(slider, "60"));
  expect(active.getCurrentTime()).toBe(0);
  await act(async () => pointer(slider, "pointerup"));
  await act(async () => change(slider, "60"));
  expect(active.getCurrentTime()).toBe(60);
});

it("handles rejected playback once, keeps a retry available, and treats waveform errors as nonfatal", async () => {
  const onError = vi.fn(),
    active = await render({ onError });
  await ready(active);
  mock.play.mockRejectedValueOnce(new Error("Blocked"));
  await act(async () => button("Play audio").click());
  expect(onError).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Playback failed",
  );
  expect(button("Play audio").disabled).toBe(false);
  await act(async () => active.play());
  expect(active.getSnapshot().playback).toBe("playing");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  const data = {
    version: 1 as const,
    sourceId: "wrong",
    duration: 100,
    channels: [{ min: [-1], max: [1] }],
  };
  await render({
    source: { ...source, waveform: { kind: "peaks", data } },
    onError,
  });
  await ready(active);
  expect(host.textContent).toContain("Waveform unavailable");
  expect(button("Play audio").disabled).toBe(false);
  expect(onError).toHaveBeenCalledTimes(2);
});

it("shows invalid source errors that do not appear in the player snapshot", async () => {
  const onError = vi.fn();
  await render({ source: { ...source, url: "" }, onError });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "URL cannot be empty",
  );
  expect(onError).toHaveBeenCalledOnce();
  await render({ source, onError });
  expect(host.textContent).not.toContain("URL cannot be empty");
});

it("keeps controls isolated between roots and borrows controllers without clearing or disposing them", async () => {
  const first = playerModule.createPlayer(),
    second = playerModule.createPlayer();
  try {
    for (const active of [first, second]) {
      const loaded = active.setSource(source);
      mock.ready(active.getMediaElement()!);
      await loaded;
    }
    root = createRoot(host);
    await act(async () =>
      root!.render(
        <>
          <AudioPlayer player={first} waveform={false} aria-label="First" />
          <AudioPlayer player={second} waveform={false} aria-label="Second" />
        </>,
      ),
    );
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="First"] button')!
        .click(),
    );
    expect(first.getSnapshot().playback).toBe("playing");
    expect(second.getSnapshot().playback).toBe("paused");
    await act(async () => root!.unmount());
    root = undefined;
    expect(first.getSnapshot().playback).toBe("playing");
    expect(first.getSnapshot().source).toBe("ready");
  } finally {
    first.dispose();
    second.dispose();
  }
});

it("shares context with custom components and supports custom content and cancelled handlers", async () => {
  let received: Player | null = null,
    renders = 0;
  function Custom() {
    received = usePlayerContext();
    renders++;
    return <span>Custom component</span>;
  }
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <PlayerRoot source={source} onPlayer={onPlayer}>
        <Custom />
        <Waveform />
        <PlayPauseButton onClick={(event) => event.preventDefault()}>
          {(state) => (state.playing ? "Stop listening" : "Listen")}
        </PlayPauseButton>
        <TimeDisplay formatTime={(time) => `${time.toFixed(1)}s`} />
        <SeekSlider />
        <MuteButton />
        <VolumeSlider />
        <PlaybackRateSelect />
        <LoopButton />
        <PlayerStatus />
      </PlayerRoot>,
    ),
  );
  const active = player!;
  await ready(active);
  expect(received).toBe(active);
  await act(async () => button("Play audio").click());
  expect(active.getSnapshot().playback).toBe("paused");
  expect(button("Play audio").textContent).toBe("Listen");
  const before = renders;
  await act(async () => active.seek(4));
  expect(renders).toBe(before);
  expect(host.querySelector("output")!.textContent).toBe("4.0s / 100.0s");
});

it("honors explicit source ownership for a standalone waveform nested under another root", async () => {
  let outer: Player | null = null,
    inner: Player | null = null;
  root = createRoot(host);
  await act(async () =>
    root!.render(
      <PlayerRoot
        source={source}
        onPlayer={(value) => {
          outer = value;
        }}
      >
        <Waveform
          source={{ ...source, id: "other" }}
          onPlayer={(value) => {
            inner = value;
          }}
        />
      </PlayerRoot>,
    ),
  );
  expect(inner).not.toBe(outer);
  expect((inner as Player | null)?.getSnapshot().sourceId).toBe("other");
  expect((outer as Player | null)?.getSnapshot().sourceId).toBe("episode");
});

it("disables a pending play and shows buffering as a pause action", async () => {
  const active = await render();
  await ready(active);
  let resolve!: () => void;
  mock.play.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        resolve = yes;
      }),
  );
  await act(async () => button("Play audio").click());
  expect(button("Play audio").disabled).toBe(true);
  expect(button("Play audio").getAttribute("aria-busy")).toBe("true");
  await act(async () => {
    resolve();
    await Promise.resolve();
  });
  await act(async () => active.play());
  await act(async () =>
    active.getMediaElement()!.dispatchEvent(new Event("waiting")),
  );
  expect(button("Pause audio").disabled).toBe(false);
  expect(host.textContent).toContain("Buffering audio");
  await act(async () => button("Pause audio").click());
  expect(active.getSnapshot().playback).toBe("paused");
});

it("does not report late command rejections after unmounting a borrowed root", async () => {
  const borrowed = playerModule.createPlayer(),
    onError = vi.fn();
  try {
    const loaded = borrowed.setSource(source);
    mock.ready(borrowed.getMediaElement()!);
    await loaded;
    let reject!: (error: Error) => void;
    mock.play.mockImplementationOnce(
      () =>
        new Promise<void>((_yes, no) => {
          reject = no;
        }),
    );
    root = createRoot(host);
    await act(async () =>
      root!.render(
        <AudioPlayer player={borrowed} waveform={false} onError={onError} />,
      ),
    );
    await act(async () => button("Play audio").click());
    await act(async () => root!.unmount());
    root = undefined;
    await act(async () => {
      reject(new Error("Late failure"));
      await Promise.resolve();
    });
    expect(onError).not.toHaveBeenCalled();
  } finally {
    borrowed.dispose();
  }
});

it("uses AudioPlayer in the gallery and preserves playback across code tab changes", async () => {
  const create = vi.spyOn(playerModule, "createPlayer");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );
  window.history.replaceState({}, "", "#demos/url/react");
  try {
    root = createRoot(host);
    await act(async () => root!.render(<Examples />));
    expect(host.querySelector(".raavl-player")).not.toBeNull();
    const active = create.mock.results.at(-1)!.value as Player;
    await ready(active);
    await act(async () => button("Play audio").click());
    const media = active.getMediaElement(),
      instances = create.mock.calls.length;
    await act(async () => {
      window.history.replaceState({}, "", "#demos/url/vanilla");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(create).toHaveBeenCalledTimes(instances);
    expect(active.getMediaElement()).toBe(media);
    expect(active.getSnapshot().playback).toBe("playing");
  } finally {
    window.history.replaceState({}, "", "/");
  }
});
