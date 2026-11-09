export type WaveformData = {
  version: 1;
  sourceId: string;
  sourceRevision?: string;
  duration: number;
  channels: ReadonlyArray<{
    min: Float32Array | readonly number[];
    max: Float32Array | readonly number[];
  }>;
};

export type WaveformInput =
  | { kind: "decode" }
  | { kind: "peaks"; data: WaveformData }
  | { kind: "none" };

type Identity = { id: string; revision?: string };

export type Source = Identity &
  (
    | {
        kind: "url";
        url: string;
        request?: RequestInit;
        waveform?: WaveformInput;
      }
    | { kind: "file"; file: Blob; waveform?: WaveformInput }
    | {
        kind: "media";
        element: HTMLMediaElement;
        waveform: Exclude<WaveformInput, { kind: "decode" }>;
      }
  );

export type ErrorCode =
  | "CANCELLED"
  | "DISPOSED"
  | "INVALID_DATA"
  | "NETWORK"
  | "DECODE"
  | "MEDIA"
  | "NOT_READY"
  | "DURATION_MISMATCH";

export type RaavlError = Error & {
  code: ErrorCode;
  stage: "source" | "waveform" | "playback" | "lifecycle" | "view";
  sourceId?: string;
  reason?: "superseded" | "aborted" | "disposed" | "cleared";
};

export type PlayerSnapshot = Readonly<{
  source: "idle" | "loading" | "ready" | "error" | "disposed";
  sourceId: string | null;
  playback: "paused" | "starting" | "playing" | "buffering" | "ended";
  waveform: "idle" | "fetching" | "decoding" | "ready" | "error" | "cancelled";
  duration: number;
  canPlay: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  loop: boolean;
  data: WaveformData | null;
  error: RaavlError | null;
  waveformError: RaavlError | null;
}>;

export type Player = {
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: () => void): () => void;
  getCurrentTime(): number;
  subscribeTime(listener: () => void): () => void;
  getMediaElement(): HTMLMediaElement | null;
  setSource(source: Source, options?: { signal?: AbortSignal }): Promise<void>;
  clearSource(): void;
  play(): Promise<void>;
  playRange(range: { start: number; end: number; loop?: boolean }): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  seekFraction(fraction: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  setLoop(loop: boolean): void;
  dispose(): void;
};
