import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type OutputHTMLAttributes,
  type SelectHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { Player, PlayerSnapshot, RaavlError } from "../core/types";
import { usePlayerState, usePlayerTime } from "./hooks";
import { usePlayerRoot } from "./player-root";

const classes = (base: string, extra?: string) =>
  extra ? `${base} ${extra}` : base;
const isReady = (state: PlayerSnapshot | null) => state?.source === "ready";
const playbackState = (state: PlayerSnapshot | null) => state?.playback;
const mutedState = (state: PlayerSnapshot | null) => state?.muted ?? false;
const loopState = (state: PlayerSnapshot | null) => state?.loop ?? false;
const durationState = (state: PlayerSnapshot | null) => state?.duration ?? 0;

export type PlayPauseState = {
  playing: boolean;
  pending: boolean;
  buffering: boolean;
  disabled: boolean;
};
export type PlayPauseButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children?: ReactNode | ((state: PlayPauseState) => ReactNode);
};
export const PlayPauseButton = forwardRef<
  HTMLButtonElement,
  PlayPauseButtonProps
>(function PlayPauseButton(
  { children, disabled, onClick, className, type = "button", ...props },
  ref,
) {
  const { player, run } = usePlayerRoot();
  const ready = usePlayerState(player, isReady);
  const playback = usePlayerState(player, playbackState);
  const state = {
    playing: playback === "playing" || playback === "buffering",
    pending: playback === "starting",
    buffering: playback === "buffering",
    disabled: Boolean(disabled || !ready || playback === "starting"),
  };
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes("raavl-button raavl-play-pause", className)}
      disabled={state.disabled}
      aria-label={
        props["aria-label"] ?? (state.playing ? "Pause audio" : "Play audio")
      }
      aria-busy={state.pending || state.buffering || undefined}
      data-playing={state.playing}
      data-buffering={state.buffering}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented)
          run((player) => (state.playing ? player.pause() : player.play()));
      }}
    >
      {typeof children === "function"
        ? children(state)
        : (children ??
          (state.pending ? "Starting…" : state.playing ? "Pause" : "Play"))}
    </button>
  );
});

type ToggleButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children?:
    | ReactNode
    | ((state: { pressed: boolean; disabled: boolean }) => ReactNode);
};
export type MuteButtonProps = ToggleButtonProps;
export const MuteButton = forwardRef<HTMLButtonElement, MuteButtonProps>(
  function MuteButton(
    { children, disabled, onClick, className, type = "button", ...props },
    ref,
  ) {
    const { player, run } = usePlayerRoot();
    const ready = usePlayerState(player, isReady),
      muted = usePlayerState(player, mutedState);
    const unavailable = Boolean(disabled || !ready);
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={classes("raavl-button raavl-mute", className)}
        disabled={unavailable}
        aria-label={
          props["aria-label"] ?? (muted ? "Unmute audio" : "Mute audio")
        }
        aria-pressed={muted}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) run((player) => player.setMuted(!muted));
        }}
      >
        {typeof children === "function"
          ? children({ pressed: muted, disabled: unavailable })
          : (children ?? (muted ? "Unmute" : "Mute"))}
      </button>
    );
  },
);
export type LoopButtonProps = ToggleButtonProps;
export const LoopButton = forwardRef<HTMLButtonElement, LoopButtonProps>(
  function LoopButton(
    { children, disabled, onClick, className, type = "button", ...props },
    ref,
  ) {
    const { player, run } = usePlayerRoot();
    const ready = usePlayerState(player, isReady),
      loop = usePlayerState(player, loopState);
    const unavailable = Boolean(disabled || !ready);
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={classes("raavl-button raavl-loop", className)}
        disabled={unavailable}
        aria-label={props["aria-label"] ?? "Loop audio"}
        aria-pressed={loop}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) run((player) => player.setLoop(!loop));
        }}
      >
        {typeof children === "function"
          ? children({ pressed: loop, disabled: unavailable })
          : (children ?? "Loop")}
      </button>
    );
  },
);

type SliderProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "min" | "max" | "value" | "defaultValue"
>;
export type VolumeSliderProps = SliderProps;
export const VolumeSlider = forwardRef<HTMLInputElement, VolumeSliderProps>(
  function VolumeSlider(
    { disabled, onChange, className, step = 0.01, ...props },
    ref,
  ) {
    const { player, run } = usePlayerRoot();
    const ready = usePlayerState(player, isReady);
    const volume = usePlayerState(player, (state) => state?.volume ?? 1);
    return (
      <input
        {...props}
        ref={ref}
        className={classes("raavl-volume", className)}
        type="range"
        min={0}
        max={1}
        step={step}
        aria-label={props["aria-label"] ?? "Volume"}
        aria-valuetext={
          props["aria-valuetext"] ?? `${Math.round(volume * 100)}%`
        }
        value={volume}
        disabled={disabled || !ready}
        onChange={(event) => {
          onChange?.(event);
          if (!event.defaultPrevented) {
            const value = Number(event.currentTarget.value);
            run((player) => player.setVolume(value));
          }
        }}
      />
    );
  },
);

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds)),
    hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60,
    rest = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}
export type TimeDisplayState = {
  elapsed: number;
  duration: number;
  remaining: number;
};
export type TimeDisplayProps = Omit<
  OutputHTMLAttributes<HTMLOutputElement>,
  "children"
> & {
  mode?: "elapsed" | "duration" | "remaining" | "elapsed-duration";
  formatTime?: (seconds: number) => string;
  children?: ReactNode | ((state: TimeDisplayState) => ReactNode);
};
export const TimeDisplay = forwardRef<HTMLOutputElement, TimeDisplayProps>(
  function TimeDisplay(
    {
      mode = "elapsed-duration",
      formatTime: format = formatTime,
      children,
      className,
      ...props
    },
    ref,
  ) {
    const { player } = usePlayerRoot();
    const elapsed = usePlayerTime(mode === "duration" ? null : player),
      duration = usePlayerState(player, durationState);
    const remaining = Math.max(0, duration - elapsed);
    const text =
      mode === "elapsed"
        ? format(elapsed)
        : mode === "duration"
          ? format(duration)
          : mode === "remaining"
            ? `−${format(remaining)}`
            : `${format(elapsed)} / ${format(duration)}`;
    return (
      <output
        {...props}
        ref={ref}
        className={classes("raavl-time", className)}
        aria-label={props["aria-label"] ?? "Playback time"}
        aria-live={props["aria-live"] ?? "off"}
      >
        {typeof children === "function"
          ? children({ elapsed, duration, remaining })
          : (children ?? text)}
      </output>
    );
  },
);

type Drag = {
  player: Player;
  media: HTMLMediaElement | null;
  sourceId: string | null;
  cancelled: boolean;
};
export type SeekSliderProps = SliderProps & {
  formatTime?: (seconds: number) => string;
};
export const SeekSlider = forwardRef<HTMLInputElement, SeekSliderProps>(
  function SeekSlider(
    {
      disabled,
      onChange,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onBlur,
      className,
      step = 0.1,
      formatTime: format = formatTime,
      ...props
    },
    ref,
  ) {
    const { player, run } = usePlayerRoot();
    const ready = usePlayerState(player, isReady),
      duration = usePlayerState(player, durationState);
    const sourceId = usePlayerState(player, (state) => state?.sourceId ?? null);
    const time = usePlayerTime(player);
    const drag = useRef<Drag | null>(null);
    const [draft, setDraft] = useState<number | null>(null);
    const current = (gesture: Drag) =>
      gesture.player === player &&
      !gesture.cancelled &&
      ready &&
      gesture.media === player?.getMediaElement() &&
      gesture.sourceId === sourceId;
    const value =
      draft !== null && drag.current && current(drag.current) ? draft : time;
    useEffect(() => {
      if (!player || player.getSnapshot().source === "disposed") return;
      return player.subscribe(() => {
        const gesture = drag.current,
          state = player.getSnapshot();
        if (
          gesture &&
          (state.source !== "ready" ||
            state.sourceId !== gesture.sourceId ||
            player.getMediaElement() !== gesture.media)
        ) {
          gesture.cancelled = true;
          setDraft(null);
        }
      });
    }, [player]);
    const finish = () => {
      drag.current = null;
      setDraft(null);
    };
    return (
      <input
        {...props}
        ref={ref}
        className={classes("raavl-seek", className)}
        type="range"
        min={0}
        max={duration || 1}
        step={step}
        value={Math.min(duration, Math.max(0, value))}
        disabled={disabled || !ready || duration <= 0}
        aria-label={props["aria-label"] ?? "Seek audio"}
        aria-valuetext={
          props["aria-valuetext"] ?? `${format(value)} of ${format(duration)}`
        }
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (
            event.defaultPrevented ||
            !player ||
            !ready ||
            disabled ||
            (event.button !== 0 && event.button !== -1)
          )
            return;
          drag.current = {
            player,
            media: player.getMediaElement(),
            sourceId,
            cancelled: false,
          };
          setDraft(Number(event.currentTarget.value));
          try {
            event.currentTarget.setPointerCapture?.(event.pointerId);
          } catch {
            /* Native inputs can finish a gesture before capture. */
          }
        }}
        onChange={(event) => {
          onChange?.(event);
          if (
            event.defaultPrevented ||
            (drag.current && !current(drag.current))
          )
            return;
          const next = Number(event.currentTarget.value);
          if (drag.current) setDraft(next);
          run((player) => player.seek(next));
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          finish();
        }}
        onPointerCancel={(event) => {
          onPointerCancel?.(event);
          finish();
        }}
        onLostPointerCapture={(event) => {
          onLostPointerCapture?.(event);
          finish();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          finish();
        }}
      />
    );
  },
);

export type PlaybackRateSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "children" | "multiple"
> & { options?: readonly number[] };
export const PlaybackRateSelect = forwardRef<
  HTMLSelectElement,
  PlaybackRateSelectProps
>(function PlaybackRateSelect(
  {
    options = [0.75, 1, 1.25, 1.5, 2],
    disabled,
    onChange,
    className,
    ...props
  },
  ref,
) {
  const { player, run } = usePlayerRoot();
  const ready = usePlayerState(player, isReady),
    rate = usePlayerState(player, (state) => state?.playbackRate ?? 1);
  if (
    options.some(
      (option) => !Number.isFinite(option) || option < 0.25 || option > 4,
    )
  )
    throw new Error("Playback rate options must be between 0.25 and 4");
  const rates = [...new Set([...options, rate])].sort((a, b) => a - b);
  return (
    <select
      {...props}
      ref={ref}
      className={classes("raavl-playback-rate", className)}
      value={rate}
      disabled={disabled || !ready}
      aria-label={props["aria-label"] ?? "Playback speed"}
      onChange={(event) => {
        onChange?.(event);
        if (!event.defaultPrevented) {
          const next = Number(event.currentTarget.value);
          run((player) => player.setPlaybackRate(next));
        }
      }}
    >
      {rates.map((option) => (
        <option key={option} value={option}>
          {option}×
        </option>
      ))}
    </select>
  );
});

export type PlayerStatusState = {
  source: PlayerSnapshot["source"];
  playback: PlayerSnapshot["playback"];
  waveform: PlayerSnapshot["waveform"];
  error: RaavlError | null;
  waveformError: RaavlError | null;
};
export type PlayerStatusProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & { children?: ReactNode | ((state: PlayerStatusState) => ReactNode) };
export const PlayerStatus = forwardRef<HTMLDivElement, PlayerStatusProps>(
  function PlayerStatus({ children, className, ...props }, ref) {
    const { player, error: reported } = usePlayerRoot();
    const source = usePlayerState(player, (state) => state?.source ?? "idle");
    const playback = usePlayerState(
      player,
      (state) => state?.playback ?? "paused",
    );
    const waveform = usePlayerState(
      player,
      (state) => state?.waveform ?? "idle",
    );
    const sourceError = usePlayerState(player, (state) => state?.error ?? null);
    const waveError = usePlayerState(
      player,
      (state) => state?.waveformError ?? null,
    );
    const error =
      sourceError ?? (reported?.stage !== "waveform" ? reported : null);
    const waveformError =
      waveError ?? (reported?.stage === "waveform" ? reported : null);
    const text = error
      ? `Audio error: ${error.message}`
      : waveformError
        ? `Waveform unavailable: ${waveformError.message}. Audio playback may still work.`
        : source === "loading"
          ? "Loading audio…"
          : playback === "buffering"
            ? "Buffering audio…"
            : playback === "starting"
              ? "Starting playback…"
              : waveform === "fetching" || waveform === "decoding"
                ? "Preparing waveform…"
                : source === "idle"
                  ? "No audio loaded."
                  : "";
    return (
      <div
        {...props}
        ref={ref}
        className={classes("raavl-status", className)}
        role={props.role ?? (error ? "alert" : "status")}
        data-source={source}
        data-playback={playback}
      >
        {typeof children === "function"
          ? children({ source, playback, waveform, error, waveformError })
          : (children ?? text)}
      </div>
    );
  },
);
