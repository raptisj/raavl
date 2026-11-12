import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  ActionsToolbar,
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
function change(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(element);
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
  expect(button("Play audio").classList.contains("raavl-play-pause-icon-button")).toBe(true);
  const playIcon = button("Play audio").querySelector("path")?.getAttribute("d");
  expect(playIcon).toBeTruthy();
  expect(host.textContent).toContain("Loading audio");
  await ready(active);
  expect(button("Play audio").disabled).toBe(false);
  await act(async () => button("Play audio").click());
  expect(active.getSnapshot().playback).toBe("playing");
  expect(button("Pause audio").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(button("Pause audio").querySelector("path")?.getAttribute("d")).not.toBe(playIcon);
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
      loop: { children: ({ pressed }) => pressed ? "Looping" : "Loop recording" },
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
  expect(button("Loop audio").textContent).toBe("Loop recording");
  await act(async () => button("Loop audio").click());
  expect(button("Loop audio").textContent).toBe("Looping");
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

it("keeps the demo theme JSON editor and download in sync with customization", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
  window.history.replaceState({}, "", "#demos/file/react");
  try {
    root = createRoot(host);
    await act(async () => root!.render(<Examples />));
    const editor = host.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Theme JSON"]',
    )!;
    const download = host.querySelector<HTMLAnchorElement>(
      'a[download="waveform-theme.json"]',
    )!;
    const height = input("Waveform height");
    const apply = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply JSON",
    )!;

    await act(async () => change(height, "250"));
    const customized = JSON.parse(editor.value);
    expect(customized.appearance.height).toBe(250);
    expect(host.querySelector("#example-code")?.textContent).toContain('"height": 250');
    expect(decodeURIComponent(download.href.split(",")[1])).toBe(editor.value);
    expect(host.textContent).not.toContain("Use current settings");

    customized.appearance.height = 300;
    await act(async () => change(editor, JSON.stringify(customized)));
    expect(height.value).toBe("250");
    await act(async () => apply.click());
    expect(height.value).toBe("300");
    expect(JSON.parse(editor.value).appearance.height).toBe(300);
  } finally {
    window.history.replaceState({}, "", "/");
  }
});

it.each(["react", "vanilla"])("shows the annotation app actions in Preview and the %s code", async (mode) => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  window.history.replaceState({}, "", `#demos/annotations/${mode}`);
  try {
    root = createRoot(host);
    await act(async () => root!.render(<Examples />));
    const preview = host.querySelector<HTMLElement>('[aria-label="Preview"]')!;
    expect(preview.querySelector("h4")?.textContent).toBe("Preview");
    const settings = host.querySelector(".demo-settings")!;
    const code = host.querySelector("#example-code")?.textContent ?? "";
    const buttons = [...preview.querySelectorAll("button")].map(
      (button) => button.getAttribute("aria-label") ?? button.textContent,
    );
    expect(buttons).toEqual(expect.arrayContaining([
      "Play region", "Loop region", "Create region from selection",
      "Apply edit", "Delete annotation", "Cancel edit",
    ]));
    expect(buttons).not.toContain("Add marker at playhead");
    expect(code).toContain(mode === "react" ? "annotationEditor" : "annotationEditor: true");
    expect(code).not.toContain("Create region from selection");
    expect(settings.textContent).toContain("Simulate external edit");
    expect(code).not.toContain("Simulate external edit");

    await act(async () => {
      for (const media of new Set(mock.load.mock.contexts as HTMLMediaElement[]))
        mock.ready(media, 12);
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((frame) => frame(0));
    });
    const overlap = host.querySelector<HTMLElement>(
      'article[aria-labelledby="overlapping-regions-title"]',
    )!;
    const browse = overlap.querySelector<HTMLButtonElement>(".raavl-annotation-browse")!;
    const rows = () => overlap.querySelectorAll<HTMLButtonElement>(
      ".raavl-annotation-picker [data-row-id]",
    );
    expect(browse.textContent).toBe("Regions (30)");
    await act(async () => browse.click());
    expect(rows()).toHaveLength(30);
    const chips = [...overlap.querySelectorAll<HTMLButtonElement>(".raavl-region-overlap")];
    const groups = [
      ["opening", "melody", "accent"],
      ["motif", "doubling"],
      ["pickup", "transition"],
      ["bridge", "harmony", "bass", "lead"],
      ["outro", "echo"],
    ];
    expect(chips.map((chip) => chip.textContent)).toEqual(groups.map((group) => `${group.length} regions`));
    for (const [index, chip] of chips.entries()) {
      await act(async () => chip.click());
      expect([...rows()].map((row) => row.dataset.rowId)).toEqual(groups[index]);
    }
    await act(async () => chips[0].click());
    await act(async () => rows()[1].click());
    expect(overlap.querySelector<HTMLElement>(
      '.raavl-annotation-editor[aria-label="Edit Melody"]',
    )?.hidden).toBe(false);
  } finally {
    window.history.replaceState({}, "", "/");
  }
});

it("combines playback, extra controls, and selected-region actions in one annotation toolbar", async () => {
  const waveform = {
    annotationEditor: true,
    defaultAnnotations: {
      version: 1,
      sourceId: source.id!,
      regions: [{ id: 'intro', start: 2, end: 5, label: 'Intro' }],
      markers: [],
    },
  } satisfies AudioPlayerProps['waveform'];
  const active = await render({
    waveform,
    controls: {
      seek: false,
      time: { mode: 'elapsed' },
      playbackRate: true,
      loop: true,
    },
  });
  const toolbar = host.querySelector('.raavl-toolbar')!;
  const mainButton = (label: 'Play' | 'Pause') =>
    host.querySelectorAll(`button[aria-label="${label} audio"], button[aria-label="${label}"]`);
  expect(host.querySelectorAll('.raavl-toolbar')).toHaveLength(1);
  expect(mainButton('Play')).toHaveLength(1);
  expect(host.querySelectorAll('output[aria-label="Playback time"]')).toHaveLength(1);
  expect(toolbar.querySelector('output')?.textContent).toBe('0:00');
  expect(toolbar.contains(button('Play audio'))).toBe(true);
  expect(toolbar.contains(button('Play region'))).toBe(true);
  expect(toolbar.contains(button('Loop region'))).toBe(true);
  expect(toolbar.contains(button('Create region at playhead'))).toBe(true);
  expect(toolbar.contains(input('Volume'))).toBe(true);
  expect(toolbar.contains(host.querySelector('select[aria-label="Playback speed"]'))).toBe(true);
  expect(toolbar.contains(button('Loop audio'))).toBe(true);
  expect(input('Seek audio')).toBeNull();
  expect(button('Play audio').disabled).toBe(true);
  await ready(active);
  expect(button('Play audio').disabled).toBe(false);
  expect(button('Play region').disabled).toBe(true);
  expect(button('Loop region').disabled).toBe(true);
  const badge = host.querySelector<HTMLButtonElement>(
    '.raavl-annotation-list button[data-row-id="intro"]',
  )!;
  await act(async () => badge.click());
  expect(button('Play region').disabled).toBe(false);
  expect(button('Loop region').disabled).toBe(false);
  const media = active.getMediaElement()!;
  const reachRegionEnd = () => {
    media.currentTime = 5;
    media.dispatchEvent(new Event('timeupdate'));
  };
  await act(async () => button('Play region').click());
  expect(active.getCurrentTime()).toBe(2);
  expect(active.getSnapshot().playback).toBe('playing');
  await act(reachRegionEnd);
  expect(active.getCurrentTime()).toBe(5);
  expect(active.getSnapshot().playback).toBe('paused');
  await act(async () => button('Loop region').click());
  await act(reachRegionEnd);
  expect(active.getCurrentTime()).toBe(2);
  expect(active.getSnapshot().playback).toBe('playing');
  expect(mainButton('Pause')).toHaveLength(1);
  await act(async () => button('Pause audio').click());
  expect(active.getSnapshot().playback).toBe('paused');
});

it("honors control visibility and slots when region actions are enabled", async () => {
  const actions = {
    range: { start: 1, end: 3 },
    sourceId: source.id,
    variant: 'text',
  } satisfies AudioPlayerProps['actions'];
  const slots: AudioPlayerProps['slots'] = {
    controls: (part) => <section data-controls>{part}</section>,
    actions: (part) => <div data-actions>{part}</div>,
    playPause: <PlayPauseButton>Listen</PlayPauseButton>,
    time: (part) => <strong>{part}</strong>,
  };
  const active = await render({ waveform: false, actions, slots });
  await ready(active);
  expect(host.querySelector('[data-controls] [data-actions] button')).toBe(button('Play region'));
  expect(button('Play audio').textContent).toBe('Listen');
  expect(host.querySelector('strong output')?.textContent).toBe('0:00 / 1:40');
  expect(button('Play region').querySelector('span')!.hidden).toBe(false);
  expect(input('Seek audio')).not.toBeNull();
  await render({
    waveform: false,
    actions,
    slots,
    controls: { playPause: false, time: false },
  });
  expect(button('Play audio')).toBeNull();
  expect(host.querySelector('output[aria-label="Playback time"]')).toBeNull();
  expect(button('Play region').disabled).toBe(false);
  await render({ waveform: false, actions, slots, controls: false });
  expect(host.querySelector('[data-controls]')).toBeNull();
  expect(input('Seek audio')).toBeNull();
  expect(button('Play region').disabled).toBe(false);
});

it("keeps standalone React toolbar transport, variants, and range validation", async () => {
  root = createRoot(host);
  const renderToolbar = (sourceId: string | undefined, variant: 'icons' | 'text') =>
    act(async () =>
      root!.render(
        <PlayerRoot source={source} onPlayer={onPlayer}>
          <ActionsToolbar range={{ start: 1, end: 3 }} sourceId={sourceId} variant={variant} />
        </PlayerRoot>,
      ),
    );
  await renderToolbar(source.id, 'icons');
  await ready(player!);
  expect(host.querySelector('[aria-label="Playback time"]')?.textContent).toBe('0.00s');
  expect(button('Play').classList.contains('raavl-play-pause-icon-button')).toBe(true);
  expect(button('Play region').disabled).toBe(false);
  expect(button('Play region').querySelector('span')!.hidden).toBe(true);
  await renderToolbar('other', 'text');
  expect(button('Play region').disabled).toBe(true);
  expect(button('Loop region').disabled).toBe(true);
  expect(button('Play').disabled).toBe(false);
  expect(button('Play').classList.contains('raavl-play-pause-icon-button')).toBe(false);
  expect(button('Play').querySelector('svg')!.style.display).toBe('none');
});

it("reports standalone toolbar errors and removes its subscriptions on disposal", async () => {
  const { mountActionsToolbar } = await import('../src/dom/actions-toolbar');
  const active = await render({ waveform: false, controls: false });
  await ready(active);
  const error = new Error('Playback rejected');
  vi.spyOn(active, 'play').mockRejectedValue(error);
  const report = vi.fn();
  const subscribe = vi.spyOn(active, 'subscribe');
  const subscribeTime = vi.spyOn(active, 'subscribeTime');
  const toolbar = mountActionsToolbar(host, { player: active, onError: report });
  expect(subscribe).toHaveBeenCalledOnce();
  expect(subscribeTime).toHaveBeenCalledOnce();
  await act(async () => button('Play').click());
  expect(report).toHaveBeenCalledWith(error);
  toolbar.update({ player: null });
  expect(button('Play').disabled).toBe(true);
  toolbar.dispose();
  expect(host.querySelector('.raavl-actions-toolbar')).toBeNull();
});

it("opens a region draft at the playhead and commits only on confirmation", async () => {
  const commit = vi.fn();
  const active = await render({ waveform: {
    annotationEditor: true,
    defaultAnnotations: { version: 1, sourceId: source.id!, regions: [], markers: [] },
    onAnnotationsCommit: commit,
  } });
  expect(button('Create region at playhead').disabled).toBe(true);
  await ready(active);
  expect(button('Play audio').classList.contains('raavl-play-pause-icon-button')).toBe(true);
  expect(button('Create region at playhead').querySelector('span')!.hidden).toBe(true);
  await act(async () => active.seek(12));
  await act(async () => button('Create region at playhead').click());
  expect(commit).not.toHaveBeenCalled();
  const creation = host.querySelector<HTMLElement>('.raavl-annotation-create')!;
  expect(creation.hidden).toBe(false);
  expect(creation.contains(document.activeElement)).toBe(true);
  expect([...creation.querySelectorAll('input[type="number"]')].map(input => (input as HTMLInputElement).value)).toEqual(['12', '13']);
  await act(async () => button('Cancel selection').click());
  expect(commit).not.toHaveBeenCalled();
  expect(creation.hidden).toBe(true);
  await act(async () => button('Create region at playhead').click());
  await act(async () => button('Create region from selection').click());
  expect(commit.mock.calls[0][0].regions).toEqual([
    expect.objectContaining({ id: 'region-1', start: 12, end: 13 }),
  ]);
  expect(creation.hidden).toBe(true);
  await act(async () => active.seek(99.5));
  await act(async () => button('Create region at playhead').click());
  expect(commit).toHaveBeenCalledTimes(1);
  await act(async () => button('Create region from selection').click());
  expect(commit.mock.calls[1][0].regions).toHaveLength(2);
  expect(commit.mock.calls[1][0].regions[1]).toEqual(
    expect.objectContaining({ id: 'region-2', start: 99.5, end: 100 }),
  );
  await act(async () => active.seek(100));
  expect(button('Create region at playhead').disabled).toBe(true);
});

it.each(['Close', 'Escape'])("dismisses modal creation and editing with %s", async (action) => {
  const commit = vi.fn();
  const active = await render({ waveform: {
    annotationEditor: 'modal',
    defaultAnnotations: { version: 1, sourceId: source.id!, regions: [{ id: 'intro', start: 2, end: 5, label: 'Intro', locked: true }], markers: [] },
    onAnnotationsCommit: commit,
  } });
  await ready(active);
  await act(async () => {
    for (const [id, draw] of [...frames]) {
      frames.delete(id);
      draw(0);
    }
  });
  const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
  // jsdom has no native dialog methods; browser focus trapping is platform-owned.
  dialog.showModal = vi.fn(() => { dialog.open = true; });
  dialog.close = vi.fn(() => { dialog.open = false; });
  const dismiss = async () => {
    const close = button('Close');
    expect([...dialog.querySelectorAll('.raavl-annotation-action-cancel')]).toEqual([close]);
    expect(close.classList.contains('raavl-annotation-dialog-close')).toBe(true);
    expect(close.querySelector('svg')).not.toBeNull();
    await act(async () => {
      if (action === 'Escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      else close.click();
    });
  };
  expect(dialog.open).toBe(false);
  await act(async () => button('Create region at playhead').click());
  expect(dialog.open).toBe(true);
  expect(dialog.getAttribute('aria-label')).toBe('New region');
  expect(dialog.contains(document.activeElement)).toBe(true);
  const region = host.querySelector('.raavl-region[data-raavl-annotation="intro"]')!;
  expect(region.closest('[inert]')).not.toBeNull();
  expect(commit).not.toHaveBeenCalled();
  await dismiss();
  expect(dialog.open).toBe(false);
  expect(region.closest('[inert]')).toBeNull();
  expect(commit).not.toHaveBeenCalled();
  await act(async () => button('Create region at playhead').click());
  await act(async () => button('Create region from selection').click());
  expect(commit).toHaveBeenCalledTimes(1);
  expect(dialog.open).toBe(false);
  const badge = host.querySelector<HTMLButtonElement>('button[data-row-id="intro"]')!;
  await act(async () => { badge.focus(); badge.click(); });
  expect(dialog.open).toBe(true);
  expect(dialog.getAttribute('aria-label')).toBe('Edit Intro');
  const editForm = dialog.querySelector('.raavl-annotation-editor')!;
  const timeFields = editForm.querySelectorAll<HTMLInputElement>('input[type="number"]');
  expect([...timeFields].map(input => input.disabled)).toEqual([true, true]);
  expect(button('Delete annotation').disabled).toBe(true);
  expect([...editForm.querySelectorAll('button')].some(control => /^(Lock|Unlock)$/.test(control.textContent))).toBe(false);
  await act(async () => change(dialog.querySelector('.raavl-annotation-editor input')!, 'Draft'));
  await dismiss();
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(badge);
  expect(commit).toHaveBeenCalledTimes(1);
  await act(async () => badge.click());
  expect(dialog.querySelector<HTMLInputElement>('.raavl-annotation-editor input')!.value).toBe('Intro');
});
