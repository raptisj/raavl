import { createPeaks, failure, finite, validateWaveform } from "./core/data";
import type {
  Player,
  PlayerSnapshot,
  RavlError,
  Source,
  WaveformData,
} from "./core/types";

const initial = (): PlayerSnapshot =>
  Object.freeze({
    source: "idle",
    sourceId: null,
    playback: "paused",
    waveform: "idle",
    duration: 0,
    canPlay: false,
    volume: 1,
    muted: false,
    playbackRate: 1,
    loop: false,
    data: null,
    error: null,
    waveformError: null,
  });

/** A browser controller. Construction itself allocates no media or network resources. */
export function createPlayer(): Player {
  let state = initial();
  let disposed = false;
  let media: HTMLMediaElement | null = null;
  let generation = 0;
  let cleanup: ((reason: RavlError["reason"]) => void) | undefined;
  let clock: ReturnType<typeof setInterval> | undefined;
  let clockValue = 0;
  let rangeTimer: ReturnType<typeof setInterval> | undefined;
  let range: { start: number; end: number; loop?: boolean } | null = null;
  let rangeSerial = 0;
  const clearRange = () => { rangeSerial++; clearInterval(rangeTimer); rangeTimer = undefined; range = null; };
  const listeners = new Set<() => void>(),
    timeListeners = new Set<() => void>();
  const guard = () => {
    if (disposed)
      throw failure("DISPOSED", "lifecycle", "Player has been disposed");
  };
  const emitTime = () => {
    if (range && media && media.currentTime >= range.end) {
      const target = range;
      if (target.loop) { media.currentTime = target.start; if (media.paused) void media.play().catch(() => clearRange()); }
      else { clearRange(); media.pause(); media.currentTime = target.end; }
    }
    clockValue = media?.currentTime ?? 0;
    timeListeners.forEach((fn) => fn());
  };
  const publish = (patch: Partial<PlayerSnapshot>) => {
    const next = { ...state, ...patch };
    if (
      Object.keys(patch).every((key) =>
        Object.is(
          state[key as keyof PlayerSnapshot],
          next[key as keyof PlayerSnapshot],
        ),
      )
    )
      return;
    state = Object.freeze(next);
    listeners.forEach((fn) => fn());
  };
  const stopClock = () => {
    clearInterval(clock);
    clock = undefined;
  };
  const sync = () => {
    if (!media) return;
    const playing = !media.paused && !media.ended;
    publish({
      canPlay: media.readyState >= 3,
      volume: media.volume,
      muted: media.muted,
      playbackRate: media.playbackRate,
      loop: media.loop,
    });
    if (playing && timeListeners.size && !clock)
      clock = setInterval(emitTime, 100);
    if (!playing) stopClock();
  };
  const reset = (reason: RavlError["reason"]) => {
    generation++;
    clearRange();
    cleanup?.(reason);
    cleanup = undefined;
    stopClock();
    media = null;
    clockValue = 0;
  };
  const needMedia = () => {
    guard();
    if (!media || state.source !== "ready")
      throw failure(
        "NOT_READY",
        "playback",
        "Wait for source metadata before playback",
        state.sourceId ?? undefined,
      );
    return media;
  };
  const player: Player = {
    getSnapshot: () => state,
    subscribe(fn) {
      guard();
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Cached value for external-store consumers; smooth views read the media clock directly.
    getCurrentTime: () => clockValue,
    subscribeTime(fn) {
      guard();
      timeListeners.add(fn);
      sync();
      return () => {
        timeListeners.delete(fn);
        if (!timeListeners.size) stopClock();
      };
    },
    getMediaElement: () => media,
    setSource(source, options = {}) {
      guard();
      if (!source?.id || !["url", "file", "media"].includes(source.kind))
        return Promise.reject(
          failure(
            "INVALID_DATA",
            "source",
            "Source requires a kind and stable id",
          ),
        );
      if (source.kind === "url" && !source.url)
        return Promise.reject(
          failure("INVALID_DATA", "source", "URL cannot be empty"),
        );
      if (source.kind === "file" && !(source.file instanceof Blob))
        return Promise.reject(
          failure(
            "INVALID_DATA",
            "source",
            "File source requires a Blob or File",
          ),
        );
      if (
        source.kind === "media" &&
        (!source.element ||
          !source.waveform ||
          source.waveform.kind === ("decode" as string))
      )
        return Promise.reject(
          failure(
            "INVALID_DATA",
            "source",
            "Borrowed media requires explicit peaks or waveform: none",
          ),
        );
      if (options.signal?.aborted)
        return Promise.reject(
          Object.assign(
            failure("CANCELLED", "source", "Source request aborted", source.id),
            { reason: "aborted" as const },
          ),
        );
      reset("superseded");
      const token = generation;
      const owned = source.kind !== "media";
      const element = owned ? document.createElement("audio") : source.element;
      media = element;
      const abort = new AbortController();
      const current = () =>
        token === generation && !disposed && !abort.signal.aborted;
      const off: Array<() => void> = [];
      let objectUrl: string | undefined;
      let settled = false;
      let resolve!: () => void, reject!: (error: RavlError) => void;
      const result = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const listen = (event: string, fn: () => void) => {
        element.addEventListener(event, fn);
        off.push(() => element.removeEventListener(event, fn));
      };
      const rejectPending = (error: RavlError) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };
      cleanup = (reason) => {
        abort.abort();
        off.forEach((fn) => fn());
        rejectPending(
          Object.assign(
            failure(
              "CANCELLED",
              "source",
              `Source request ${reason}`,
              source.id,
            ),
            { reason },
          ),
        );
        if (owned) {
          element.pause();
          element.removeAttribute("src");
          element.load();
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      publish({ ...initial(), source: "loading", sourceId: source.id });
      emitTime();
      const cancel = () => {
        if (!current()) return;
        reset("aborted");
        publish({ ...initial(), waveform: "cancelled" });
        emitTime();
      };
      options.signal?.addEventListener("abort", cancel, { once: true });
      off.push(() => options.signal?.removeEventListener("abort", cancel));
      const checkDuration = (data: WaveformData) => {
        if (
          state.duration &&
          Math.abs(data.duration - state.duration) >
            Math.max(0.1, state.duration * 0.001)
        ) {
          throw failure(
            "DURATION_MISMATCH",
            "waveform",
            "Waveform duration does not match audio metadata",
            source.id,
          );
        }
      };
      const waveformError = (cause: unknown) => {
        if (!current()) return;
        const error = (cause as RavlError)?.code
          ? (cause as RavlError)
          : failure(
              "DECODE",
              "waveform",
              "Unable to generate waveform",
              source.id,
              cause,
            );
        publish({ waveform: "error", waveformError: error, data: null });
      };
      const metadata = () => {
        if (!current()) return;
        if (!Number.isFinite(element.duration) || element.duration <= 0) {
          const error = failure(
            "INVALID_DATA",
            "source",
            "Only recordings with a finite positive duration are supported",
            source.id,
          );
          rejectPending(error);
          publish({ source: "error", error });
          return;
        }
        publish({ duration: element.duration, source: "ready" });
        if (state.data) {
          try {
            checkDuration(state.data);
          } catch (error) {
            waveformError(error);
          }
        }
        sync();
        emitTime();
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      listen("loadedmetadata", metadata);
      listen("durationchange", () => {
        if (element.readyState >= 1) metadata();
      });
      listen("error", () => {
        if (!current()) return;
        const error = failure(
          "MEDIA",
          "source",
          element.error?.message || "Audio could not be loaded",
          source.id,
          element.error,
        );
        rejectPending(error);
        stopClock();
        publish({ source: "error", playback: "paused", canPlay: false, error });
      });
      for (const event of ["canplay", "volumechange", "ratechange"])
        listen(event, () => {
          if (current()) sync();
        });
      for (const event of ["play", "playing", "pause", "waiting", "ended"])
        listen(event, () => {
          if (!current()) return;
          const playback =
            event === "waiting"
              ? "buffering"
              : event === "ended"
                ? "ended"
                : element.paused
                  ? "paused"
                  : "playing";
          if (event === "pause" && !element.ended) clearRange();
          publish({ playback });
          sync();
          emitTime();
        });
      for (const event of ["timeupdate", "seeked"])
        listen(event, () => {
          if (current()) emitTime();
        });
      try {
        if (owned) {
          element.preload = "metadata";
          if (source.kind === "file") {
            objectUrl = URL.createObjectURL(source.file);
            element.src = objectUrl;
          } else if (source.kind === "url") element.src = source.url;
          element.load();
        }
        if (element.readyState >= 1) metadata();
        sync();
        if (!element.paused)
          publish({ playback: element.ended ? "ended" : "playing" });
      } catch (cause) {
        const error = failure(
          "MEDIA",
          "source",
          "Unable to prepare audio",
          source.id,
          cause,
        );
        rejectPending(error);
        publish({ source: "error", error });
      }
      const input = source.waveform ?? { kind: "decode" as const };
      const prepareWaveform = async () => {
        if (!current()) return;
        if (input.kind === "none") return;
        if (input.kind === "peaks") {
          const data = validateWaveform(input.data);
          if (
            data.sourceId !== source.id ||
            data.sourceRevision !== source.revision
          )
            throw failure(
              "INVALID_DATA",
              "waveform",
              "Waveform belongs to a different source or revision",
              source.id,
            );
          checkDuration(data);
          publish({ data, waveform: "ready" });
          return;
        }
        let bytes: ArrayBuffer;
        if (source.kind === "url") {
          publish({ waveform: "fetching" });
          const signal = source.request?.signal
            ? AbortSignal.any([abort.signal, source.request.signal])
            : abort.signal;
          try {
            const response = await fetch(source.url, {
              ...source.request,
              signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            bytes = await response.arrayBuffer();
          } catch (cause) {
            throw failure(
              "NETWORK",
              "waveform",
              "Unable to fetch waveform audio",
              source.id,
              cause,
            );
          }
        } else if (source.kind === "file")
          bytes = await source.file.arrayBuffer();
        else return;
        if (!current()) return;
        publish({ waveform: "decoding" });
        const context = new AudioContext();
        try {
          const buffer = await context.decodeAudioData(bytes);
          if (!current()) return;
          const data = createPeaks(buffer, source.id, source.revision);
          checkDuration(data);
          if (current()) publish({ data, waveform: "ready" });
        } finally {
          await context.close().catch(() => {});
        }
      };
      void prepareWaveform().catch(waveformError);
      return result;
    },
    clearSource() {
      guard();
      reset("cleared");
      publish(initial());
      emitTime();
    },
    async play() {
      const element = needMedia(),
        token = generation;
      publish({ playback: "starting", error: null });
      try {
        await element.play();
        if (token !== generation || disposed)
          throw Object.assign(
            failure("CANCELLED", "playback", "Playback request superseded"),
            {
              reason: disposed
                ? ("disposed" as const)
                : ("superseded" as const),
            },
          );
        publish({ playback: element.paused ? "paused" : "playing" });
        sync();
      } catch (cause) {
        if (token !== generation || disposed)
          throw Object.assign(
            failure("CANCELLED", "playback", "Playback request cancelled"),
            {
              reason: disposed
                ? ("disposed" as const)
                : ("superseded" as const),
            },
          );
        const error = failure(
          "MEDIA",
          "playback",
          "Playback failed; a user gesture may be required",
          state.sourceId ?? undefined,
          cause,
        );
        publish({ playback: "paused", error });
        throw error;
      }
    },
    async playRange(target) {
      const element = needMedia();
      finite(target.start, "Range start", 0, state.duration);
      finite(target.end, "Range end", 0, state.duration);
      if (target.end <= target.start) throw failure("INVALID_DATA", "playback", "Range end must follow its start");
      player.seek(target.start);
      element.loop = false;
      const token = generation, request = rangeSerial;
      await player.play();
      if (token !== generation || disposed || request !== rangeSerial) throw failure("CANCELLED", "playback", "Range playback was cancelled");
      range = { ...target };
      rangeTimer = setInterval(emitTime, 25);
      emitTime();
    },
    pause() {
      const element = needMedia();
      clearRange();
      element.pause();
      publish({ playback: "paused" });
      stopClock();
      emitTime();
    },
    seek(seconds) {
      const element = needMedia();
      finite(seconds, "Time");
      clearRange();
      element.currentTime = Math.min(seconds, state.duration);
      emitTime();
    },
    seekFraction(fraction) {
      finite(fraction, "Fraction", 0, 1);
      player.seek(fraction * state.duration);
    },
    setVolume(volume) {
      const element = needMedia();
      element.volume = finite(volume, "Volume", 0, 1);
      sync();
    },
    setMuted(muted) {
      needMedia().muted = muted;
      sync();
    },
    setPlaybackRate(rate) {
      const element = needMedia();
      element.playbackRate = finite(rate, "Playback rate", 0.25, 4);
      sync();
    },
    setLoop(loop) {
      needMedia().loop = loop;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      reset("disposed");
      publish({ ...initial(), source: "disposed" });
      emitTime();
      listeners.clear();
      timeListeners.clear();
    },
  };
  return player;
}
