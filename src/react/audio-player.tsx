import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import type { Appearance, WaveformTheme } from "../dom";
import { PlayerRoot, type PlayerRootProps } from "./player-root";
import { Waveform, type WaveformProps } from "./waveform";
import {
  PlayPauseButton,
  SeekSlider,
  TimeDisplay,
  MuteButton,
  VolumeSlider,
  PlaybackRateSelect,
  LoopButton,
  PlayerStatus,
  type PlayPauseButtonProps,
  type SeekSliderProps,
  type TimeDisplayProps,
  type MuteButtonProps,
  type VolumeSliderProps,
  type PlaybackRateSelectProps,
  type LoopButtonProps,
  type PlayerStatusProps,
} from "./controls";

type PartOption<Props> = boolean | Props;
export type AudioPlayerControls = {
  playPause?: PartOption<PlayPauseButtonProps>;
  seek?: PartOption<SeekSliderProps>;
  time?: PartOption<TimeDisplayProps>;
  mute?: PartOption<MuteButtonProps>;
  volume?: PartOption<VolumeSliderProps>;
  playbackRate?: PartOption<PlaybackRateSelectProps>;
  loop?: PartOption<LoopButtonProps>;
};
export type AudioPlayerWaveformOptions = Omit<
  WaveformProps,
  "source" | "player" | "onPlayer" | "onError"
>;
type Slot = ReactNode | ((defaultPart: ReactNode) => ReactNode);
export type AudioPlayerSlots = Partial<
  Record<keyof AudioPlayerControls | "waveform" | "controls" | "status", Slot>
>;
export type AudioPlayerProps = Omit<PlayerRootProps, "children"> &
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError"> & {
    waveform?: boolean | AudioPlayerWaveformOptions;
    controls?: boolean | AudioPlayerControls;
    status?: boolean | PlayerStatusProps;
    slots?: AudioPlayerSlots;
    /** Shortcut for waveform.appearance; nested options take precedence. */
    appearance?: Appearance;
    /** Shortcut for waveform.theme; nested options take precedence. */
    theme?: WaveformTheme | null;
  };
function options<T extends object>(
  value: boolean | T | undefined,
): T | Record<string, never> {
  return typeof value === "object" ? value : {};
}

/** A complete player composed from the same public parts available for custom layouts. */
export const AudioPlayer = forwardRef<HTMLDivElement, AudioPlayerProps>(
  function AudioPlayer(
    {
      source,
      player,
      onError,
      onPlayer,
      waveform = true,
      controls = true,
      status = true,
      slots,
      appearance,
      theme,
      className,
      ...html
    },
    ref,
  ) {
    const config = options(controls);
    const part = (
      name: keyof AudioPlayerSlots,
      defaultPart: ReactNode,
      enabled = true,
    ) => {
      if (!enabled) return null;
      const slot = slots?.[name];
      return slot === undefined
        ? defaultPart
        : typeof slot === "function"
          ? slot(defaultPart)
          : slot;
    };
    const transport = (
      <div
        className="raavl-controls"
        role="group"
        aria-label="Playback controls"
      >
        {part(
          "seek",
          <SeekSlider {...options(config.seek)} />,
          config.seek !== false,
        )}
        <div className="raavl-toolbar">
          {part(
            "playPause",
            <PlayPauseButton {...options(config.playPause)} />,
            config.playPause !== false,
          )}
          {part(
            "time",
            <TimeDisplay {...options(config.time)} />,
            config.time !== false,
          )}
          {part(
            "mute",
            <MuteButton {...options(config.mute)} />,
            config.mute !== false,
          )}
          {part(
            "volume",
            <VolumeSlider {...options(config.volume)} />,
            config.volume !== false,
          )}
          {part(
            "playbackRate",
            <PlaybackRateSelect {...options(config.playbackRate)} />,
            config.playbackRate !== undefined && config.playbackRate !== false,
          )}
          {part(
            "loop",
            <LoopButton {...options(config.loop)} />,
            config.loop !== undefined && config.loop !== false,
          )}
        </div>
      </div>
    );
    const ownership = player !== undefined ? { player } : { source };
    return (
      <PlayerRoot {...ownership} onError={onError} onPlayer={onPlayer}>
        <div
          {...html}
          ref={ref}
          className={className ? `raavl-player ${className}` : "raavl-player"}
          aria-label={html["aria-label"] ?? "Audio player"}
        >
          {part(
            "waveform",
            <Waveform
              appearance={appearance}
              theme={theme}
              {...options(waveform)}
            />,
            waveform !== false,
          )}
          {part("controls", transport, controls !== false)}
          {part(
            "status",
            <PlayerStatus {...options(status)} />,
            status !== false,
          )}
        </div>
      </PlayerRoot>
    );
  },
);
