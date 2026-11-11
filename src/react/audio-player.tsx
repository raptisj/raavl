"use client";

import { forwardRef, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import type { Appearance, WaveformTheme, WaveformView } from "../dom/index.js";
import { PlayerRoot, type PlayerRootProps } from "./player-root.js";
import { Waveform, type WaveformProps } from "./waveform.js";
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
} from "./controls.js";

import { ActionsToolbar, type ActionsToolbarProps } from './actions-toolbar.js';
import { useAnnotations } from './hooks.js';
import type { AnnotationDocument } from '../regions/index.js';

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
  Record<keyof AudioPlayerControls | "waveform" | "controls" | "status" | "actions", Slot>
>;
export type AudioPlayerProps = Omit<PlayerRootProps, "children"> &
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError"> & {
    waveform?: boolean | AudioPlayerWaveformOptions;
    controls?: boolean | AudioPlayerControls;
    status?: boolean | PlayerStatusProps;
    /** Enabled by default for annotation editors. */
    actions?: boolean | ActionsToolbarProps;
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
      actions,
      slots,
      appearance,
      theme,
      className,
      ...html
    },
    ref,
  ) {
    const view = useRef<WaveformView | null>(null);
    const config = options(controls);
    const wave = options(waveform);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editedDocument, setEditedDocument] = useState<AnnotationDocument | null>(null);
    const annotationSnapshot = useAnnotations(wave.annotationStore ?? null);
    const document = annotationSnapshot?.document ?? wave.annotations ?? editedDocument ?? wave.defaultAnnotations;
    const selected = document?.regions.find(region => region.id === selectedId);
    const showActions = actions !== false && (actions !== undefined || !!wave.annotationEditor);
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
              {...wave}
              onView={instance => { view.current = instance; wave.onView?.(instance); }}
              onAnnotationSelect={(id) => {
                setSelectedId(id);
                wave.onAnnotationSelect?.(id);
              }}
              onAnnotationsCommit={wave.annotations && !wave.onAnnotationsCommit ? undefined : (next, change) => {
                setEditedDocument(next);
                wave.onAnnotationsCommit?.(next, change);
              }}
            />,
            waveform !== false,
          )}
          {part("actions", <ActionsToolbar onCreateRegion={document ? time => view.current?.createRegionAtTime(time) : undefined} range={selected ?? null} sourceId={document?.sourceId ?? null} {...options(actions)} />, showActions)}
          {part("controls", transport, controls !== false && (!showActions || controls !== true))}
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
