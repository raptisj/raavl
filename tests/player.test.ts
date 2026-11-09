import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createPlayer } from "../src/player";
import { validateWaveform } from "../src/core/data";
import type { WaveformData } from "../src/core/types";
import type { RaavlError } from "../src";
import { mockMedia } from "./media";

const peaks = (id = "a"): WaveformData => ({
  version: 1,
  sourceId: id,
  duration: 10,
  channels: [{ min: [-0.5, -0.3], max: [0.5, 0.4] }],
});
let mock: ReturnType<typeof mockMedia>;
beforeEach(() => {
  mock = mockMedia();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("source lifecycle", () => {
  it("generates per-channel peaks from a local file without a network request", async () => {
    const bytes = new ArrayBuffer(4);
    const file = Object.assign(new File([bytes], "stereo.mp3"), {
      arrayBuffer: vi.fn(async () => bytes),
    });
    const left = Float32Array.from({ length: 48_000 }, (_, i) => i % 2 ? .2 : -.8);
    const right = Float32Array.from({ length: 48_000 }, (_, i) => i % 2 ? .6 : -.1);
    const decode = vi.fn(async () => ({
      duration: 10,
      numberOfChannels: 2,
      length: left.length,
      getChannelData: (channel: number) => channel === 0 ? left : right,
    }));
    const close = vi.fn(async () => {});
    const fetch = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:stereo"), revokeObjectURL: revoke,
    }));
    vi.stubGlobal("AudioContext", class {
      decodeAudioData = decode;
      close = close;
    });
    const player = createPlayer();
    try {
      const pending = player.setSource({ kind: "file", id: "upload", file });
      mock.ready(player.getMediaElement()!);
      await pending;
      await vi.waitFor(() => expect(player.getSnapshot().waveform).toBe("ready"));
      const data = player.getSnapshot().data!;
      expect(file.arrayBuffer).toHaveBeenCalledOnce();
      expect(decode).toHaveBeenCalledExactlyOnceWith(bytes);
      expect(fetch).not.toHaveBeenCalled();
      expect(data.sourceId).toBe("upload");
      expect(data.channels).toHaveLength(2);
      expect(data.channels[0].min).toHaveLength(24_000);
      expect(data.channels[0].min[0]).toBeCloseTo(-.8);
      expect(data.channels[0].max[0]).toBeCloseTo(.2);
      expect(data.channels[1].min[0]).toBeCloseTo(-.1);
      expect(data.channels[1].max[0]).toBeCloseTo(.6);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      player.dispose();
    }
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:stereo");
  });

  it("rejects a superseded metadata request and ignores its late events", async () => {
    const player = createPlayer();
    const first = player.setSource({
      kind: "url",
      id: "a",
      url: "/a",
      waveform: { kind: "none" },
    });
    const cancelled = expect(first).rejects.toMatchObject({
      code: "CANCELLED",
      reason: "superseded",
    });
    const old = player.getMediaElement()!;
    const second = player.setSource({
      kind: "url",
      id: "b",
      url: "/b",
      waveform: { kind: "none" },
    });
    mock.ready(old, 99);
    expect(player.getSnapshot().sourceId).toBe("b");
    expect(player.getSnapshot().duration).toBe(0);
    mock.ready(player.getMediaElement()!, 12);
    await second;
    await cancelled;
    expect(player.getSnapshot().duration).toBe(12);
    player.dispose();
  });
  it("keeps valid audio playable when supplied peaks are invalid", async () => {
    const player = createPlayer();
    const ready = player.setSource({
      kind: "url",
      id: "a",
      url: "/a",
      waveform: { kind: "peaks", data: peaks("wrong") },
    });
    mock.ready(player.getMediaElement()!);
    await ready;
    await Promise.resolve();
    expect(player.getSnapshot()).toMatchObject({
      source: "ready",
      waveform: "error",
      data: null,
    });
    await player.play();
    expect(player.getSnapshot().playback).toBe("playing");
    player.dispose();
  });
  it("checks supplied duration once metadata arrives", async () => {
    const player = createPlayer();
    const ready = player.setSource({
      kind: "url",
      id: "a",
      url: "/a",
      waveform: { kind: "peaks", data: peaks() },
    });
    mock.ready(player.getMediaElement()!, 20);
    await ready;
    const error: RaavlError | null = player.getSnapshot().waveformError;
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "RaavlError",
      code: "DURATION_MISMATCH",
      stage: "waveform",
      sourceId: "a",
    });
    expect(player.getSnapshot().source).toBe("ready");
    player.dispose();
  });
  it("does not pause, reset, remove or revoke borrowed media", async () => {
    const player = createPlayer(),
      element = document.createElement("audio");
    element.src = "/external";
    document.body.append(element);
    mock.ready(element);
    await player.setSource({
      kind: "media",
      id: "a",
      element,
      waveform: { kind: "none" },
    });
    await player.play();
    mock.pause.mockClear();
    mock.load.mockClear();
    player.dispose();
    player.dispose();
    expect(mock.pause).not.toHaveBeenCalled();
    expect(mock.load).not.toHaveBeenCalled();
    expect(element.isConnected).toBe(true);
    expect(element.getAttribute("src")).toBe("/external");
    expect(element.paused).toBe(false);
    element.remove();
  });
  it("settles metadata wait on external cancellation and disposal", async () => {
    const player = createPlayer(),
      abort = new AbortController();
    const pending = player.setSource(
      { kind: "url", id: "a", url: "/a", waveform: { kind: "none" } },
      { signal: abort.signal },
    );
    const rejected = expect(pending).rejects.toMatchObject({
      code: "CANCELLED",
      reason: "aborted",
    });
    abort.abort();
    await rejected;
    expect(player.getMediaElement()).toBe(null);
    const next = player.setSource({
      kind: "url",
      id: "b",
      url: "/b",
      waveform: { kind: "none" },
    });
    const disposed = expect(next).rejects.toMatchObject({
      code: "CANCELLED",
      reason: "disposed",
    });
    player.dispose();
    await disposed;
    expect(() => player.seek(1)).toThrow("disposed");
  });
  it("ignores a stale non-abortable decode and closes its audio context", async () => {
    let decode!: (buffer: AudioBuffer) => void;
    const close = vi.fn(async () => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(4),
      })),
    );
    vi.stubGlobal(
      "AudioContext",
      class {
        decodeAudioData = () =>
          new Promise<AudioBuffer>((resolve) => {
            decode = resolve;
          });
        close = close;
      },
    );
    const player = createPlayer();
    const ready = player.setSource({ kind: "url", id: "a", url: "/a" });
    mock.ready(player.getMediaElement()!);
    await ready;
    await vi.waitFor(() => expect(decode).toBeTypeOf("function"));
    const next = player.setSource({
      kind: "url",
      id: "b",
      url: "/b",
      waveform: { kind: "peaks", data: peaks("b") },
    });
    mock.ready(player.getMediaElement()!);
    await next;
    decode({
      duration: 10,
      numberOfChannels: 1,
      length: 2,
      getChannelData: () => new Float32Array([0, 1]),
    } as unknown as AudioBuffer);
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(player.getSnapshot().data?.sourceId).toBe("b");
    player.dispose();
  });
  it("revokes only object URLs created for owned files", async () => {
    const revoke = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:owned"),
        revokeObjectURL: revoke,
      }),
    );
    const player = createPlayer();
    const ready = player.setSource({
      kind: "file",
      id: "a",
      file: new Blob(["audio"]),
      waveform: { kind: "none" },
    });
    mock.ready(player.getMediaElement()!);
    await ready;
    player.clearSource();
    player.dispose();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:owned");
  });
  it("reports playback rejection without corrupting source readiness", async () => {
    const player = createPlayer();
    const ready = player.setSource({
      kind: "url",
      id: "a",
      url: "/a",
      waveform: { kind: "none" },
    });
    mock.ready(player.getMediaElement()!);
    await ready;
    mock.play.mockRejectedValueOnce(
      new DOMException("Blocked", "NotAllowedError"),
    );
    await expect(player.play()).rejects.toMatchObject({
      code: "MEDIA",
      stage: "playback",
    });
    expect(player.getSnapshot()).toMatchObject({
      source: "ready",
      playback: "paused",
    });
    player.dispose();
  });
});

it("validates all channels without mutating caller peak buffers", () => {
  const data = peaks(),
    before = JSON.stringify(data);
  validateWaveform(data);
  expect(JSON.stringify(data)).toBe(before);
  expect(() =>
    validateWaveform({
      ...data,
      channels: [...data.channels, { min: [NaN, 0], max: [1, 1] }],
    }),
  ).toThrow();
});

it("plays and loops a bounded range and cancels range scheduling on pause", async () => {
  vi.useFakeTimers();
  const player = createPlayer();
  try {
    const ready = player.setSource({
      kind: "url",
      id: "a",
      url: "/a",
      waveform: { kind: "none" },
    });
    mock.ready(player.getMediaElement()!);
    await ready;
    await player.playRange({ start: 2, end: 4 });
    player.getMediaElement()!.currentTime = 4.2;
    await vi.advanceTimersByTimeAsync(30);
    expect(player.getMediaElement()!.paused).toBe(true);
    expect(player.getCurrentTime()).toBe(4);
    await player.playRange({ start: 1, end: 3, loop: true });
    player.getMediaElement()!.currentTime = 3.2;
    await vi.advanceTimersByTimeAsync(30);
    expect(player.getCurrentTime()).toBe(1);
    expect(player.getMediaElement()!.paused).toBe(false);
    player.pause();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    player.dispose();
    vi.useRealTimers();
  }
});

 it("ignores a late play rejection after pause", async () => {
  const player = createPlayer()
  const loading = player.setSource({ kind: 'url', id: 'a', url: '/a', waveform: { kind: 'none' } })
  mock.ready(player.getMediaElement()!); await loading
  let reject!: (error: Error) => void
  mock.play.mockImplementationOnce(() => new Promise((_, no) => { reject = no }))
  const playing = player.play()
  const cancelled = expect(playing).rejects.toMatchObject({ code: 'CANCELLED' })
  player.pause(); reject(new Error('Interrupted'))
  await cancelled
  expect(player.getSnapshot()).toMatchObject({ playback: 'paused', error: null })
  player.dispose()
 })
 it("stops source preparation when a loading subscriber disposes the player", async () => {
  const player = createPlayer()
  player.subscribe(() => { if (player.getSnapshot().source === 'loading') player.dispose() })
  await expect(player.setSource({ kind: 'file', id: 'a', file: new Blob(), waveform: { kind: 'none' } })).rejects.toMatchObject({ code: 'CANCELLED' })
  expect(player.getSnapshot().source).toBe('disposed')
  expect(player.getMediaElement()).toBeNull()
 })
