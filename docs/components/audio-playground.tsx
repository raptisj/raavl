"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AudioLines,
  RotateCcw,
  Upload,
  Volume2,
} from "lucide-react";
import {
  ActionsToolbar,
  PlayPauseButton,
  PlayerRoot,
  Waveform,
  usePlayerState,
  usePlayerTime,
} from "raavl/react";
import { mountTimeline } from "raavl/timeline";
import { defaultAppearance } from "raavl/themes";
import {
  waveformThemes,
  type Player,
  type Source,
  type PlayerSnapshot,
  type AnnotationDocument,
  type WaveformView,
} from "raavl";
import { usePageTheme } from "../../examples/live/usePageTheme";
import {
  playgroundModes as modes,
  usePlaygroundMode,
  type PlaygroundMode,
} from "./playground-mode";

const demoSounds = [
  {
    id: "bach-classical",
    file: "bach_classical.mp3",
    label: "Bach · classical",
  },
  {
    id: "classical-guitar",
    file: "classical_guitar.mp3",
    label: "Classical guitar",
  },
  { id: "beat", file: "beat.mp3", label: "Beat" },
  { id: "outfoxing", file: "outfoxing.mp3", label: "Outfoxing" },
];
type DemoSound = (typeof demoSounds)[number];
const demoSource = (demo: DemoSound): Source => ({
  kind: "url",
  id: demo.id,
  url: `/${demo.file}`,
});
const selectState = (state: PlayerSnapshot | null) => state;
type RegionState = { value: AnnotationDocument; revision: number };
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;

export function AudioPlayground() {
  const id = useId();
  const { mode, setMode } = usePlaygroundMode();
  const pageTheme = usePageTheme();
  const [themeId, setThemeId] = useState<"default" | keyof typeof waveformThemes>(
    "default",
  );
  const theme = themeId === "default" ? undefined : waveformThemes[themeId];
  const [player, setPlayer] = useState<Player | null>(null);
  const [demo, setDemo] = useState(demoSounds[0]);
  const [source, setSource] = useState<Source>(() => demoSource(demoSounds[0]));
  const [title, setTitle] = useState(demoSounds[0].file);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<Record<string, RegionState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<WaveformView | null>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const state = usePlayerState(player, selectState);
  const time = usePlayerTime(mode === "playback" ? player : null);
  const ready = state?.source === "ready";
  const duration = state?.duration ?? 0;
  const sourceDuration = state?.sourceId === source.id ? duration : 0;
  const initialRegions = useMemo<RegionState>(
    () => ({
      value: {
        version: 1,
        sourceId: source.id,
        regions:
          sourceDuration >= 1
            ? [
                {
                  id: "region-1",
                  start: sourceDuration * 0.12,
                  end: sourceDuration * 0.3,
                  label: "Opening phrase",
                },
                {
                  id: "region-2",
                  start: sourceDuration * 0.53,
                  end: sourceDuration * 0.72,
                  label: "Main theme",
                },
              ]
            : [],
        markers: [],
      },
      revision: 0,
    }),
    [source.id, sourceDuration],
  );
  const regions = documents[source.id] ?? initialRegions;
  const selectedRegion = regions.value.regions.find(
    (region) => region.id === selectedId,
  );
  const canEditRegions = mode === "regions" && ready && sourceDuration > 0;
  useEffect(() => {
    if (!canEditRegions || !view || !timeline.current || view.getViewport().disposed) return;
    const ruler = mountTimeline(timeline.current, { view });
    return () => ruler.dispose();
  }, [canEditRegions, view]);

  function reportError(cause: Error) {
    setError(cause.message);
  }
  function acceptRegions(value: AnnotationDocument, baseRevision: number) {
    if (value.sourceId !== source.id) return;
    setDocuments((current) => {
      const previous = current[source.id] ?? initialRegions;
      if (previous.revision !== baseRevision) return current;
      return {
        ...current,
        [source.id]: { value, revision: previous.revision + 1 },
      };
    });
  }
  function clearSelection() {
    view?.clearSelection();
    setSelectedId(null);
  }
  function switchMode(next: PlaygroundMode) {
    if (next === mode) return;
    clearSelection();
    setMode(next);
  }
  function command(action: () => void) {
    try {
      action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update playback.",
      );
    }
  }
  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    clearSelection();
    setError("");
    setTitle(file.name);
    setSource({ kind: "file", id: `local-${Date.now()}`, file });
    event.target.value = "";
  }
  function loadDemo(sound: DemoSound) {
    clearSelection();
    setError("");
    setDemo(sound);
    setTitle(sound.file);
    setSource({
      ...demoSource(sound),
      revision: String(Date.now()),
    });
  }
  function resetDemo() {
    loadDemo(demo);
  }
  return (
    <>
      <div className="stage-header">
        <div
          className="playground-tabs"
          role="tablist"
          aria-label="Live demo"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "playback"
                : event.key === "End"
                  ? "regions"
                  : mode === "playback"
                    ? "regions"
                    : "playback";
            switchMode(next);
            document.getElementById(`${id}-${next}`)?.focus();
          }}
        >
          {modes.map((value) => (
            <button
              key={value}
              id={`${id}-${value}`}
              type="button"
              role="tab"
              aria-selected={mode === value}
              aria-controls={`${id}-panel`}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => switchMode(value)}
            >
              {value === "playback" ? "Playback" : "Regions"}
            </button>
          ))}
        </div>
      </div>
      <div
        className="listening-card"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}`}
        tabIndex={0}
      >
        <div className="recording-heading">
          <div className="recording-info">
            <div className="recording-art">
              <AudioLines size={27} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="recording-title">
              <h3>{title}</h3>
              <p>
                {source.kind === "file"
                  ? "Your audio · stays on your device"
                  : demo.label}
              </p>
            </div>
          </div>
          <div className="playground-toolbar">
            <label className="theme-control">
              Track
              <select
                aria-label="Track"
                value={source.kind === "file" ? "local" : demo.id}
                onChange={(event) => {
                  const sound = demoSounds.find(
                    (item) => item.id === event.target.value,
                  );
                  if (sound) loadDemo(sound);
                }}
              >
                {source.kind === "file" && (
                  <option value="local" disabled>
                    Your audio
                  </option>
                )}
                {demoSounds.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="theme-control">
              Theme
              <select
                aria-label="Waveform theme"
                value={themeId}
                onChange={(event) =>
                  setThemeId(event.target.value as typeof themeId)
                }
              >
                <option value="default">Default</option>
                {Object.entries(waveformThemes).map(([id, preset]) => (
                  <option key={id} value={id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {mode === "regions" && (
          <p className="region-hint">
            Drag to draft a region. Select a region or its badge to edit it.
          </p>
        )}
        <div className="playground-wave" style={{ minHeight: defaultAppearance.height }}>
          <Waveform
            source={source}
            onPlayer={setPlayer}
            onView={setView}
            themeVersion={pageTheme}
            onError={reportError}
            {...(theme && {
              theme,
              appearance: { height: defaultAppearance.height, normalize: defaultAppearance.normalize },
            })}
            interaction={{
              seek: "click",
              drag: mode === "regions" ? "select" : "seek",
            }}
            {...(canEditRegions
              ? {
                  annotations: regions.value,
                  annotationsRevision: regions.revision,
                  annotationEditor: "modal",
                  onAnnotationsCommit: (
                    value: AnnotationDocument,
                    change: { baseRevision: number },
                  ) => acceptRegions(value, change.baseRevision),
                  annotationRules: { minLength: 0.1 },
                  onAnnotationSelect: setSelectedId,
                }
              : {})}
            aria-label={
              mode === "regions"
                ? "Recording waveform; drag to select a range, move regions, or resize their edges"
                : "Recording waveform; use arrow keys to seek"
            }
          />
        </div>
        {mode === "regions" ? (
          <div ref={timeline} className="playground-timeline" />
        ) : (
          <div className="wave-ruler" aria-hidden="true">
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <span key={fraction}>{timeLabel(duration * fraction)}</span>
            ))}
          </div>
        )}
        <div className={mode === "regions" ? "playback-controls region-transport" : "playback-controls"}>
          <PlayerRoot player={player} onError={reportError}>
            {mode === "regions" ? (
              <ActionsToolbar
                range={selectedRegion ?? null}
                sourceId={regions.value.sourceId}
                onCreateRegion={
                  canEditRegions && view
                    ? (time) => view.createRegionAtTime(time)
                    : undefined
                }
              />
            ) : (
              <PlayPauseButton onClick={() => setError("")} />
            )}
          </PlayerRoot>
          <button
            className="icon-button"
            type="button"
            disabled={!ready}
            aria-label="Restart audio"
            onClick={() => command(() => player!.seek(0))}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
          {mode === "playback" && (
            <span
              className="playback-time"
              aria-label={`Playback time ${timeLabel(time)} of ${timeLabel(duration)}`}
            >
              {timeLabel(time)} <span>/ {timeLabel(duration)}</span>
            </span>
          )}
          <label className="volume-control">
            <Volume2 size={17} aria-hidden="true" />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              disabled={!ready}
              value={state?.volume ?? 1}
              onChange={(event) =>
                command(() => player!.setVolume(Number(event.target.value)))
              }
            />
          </label>
        </div>
        <div className="recording-footer">
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            onChange={loadFile}
          />
          <button type="button" onClick={() => fileInput.current?.click()}>
            <Upload size={13} aria-hidden="true" /> Open your audio
          </button>
        </div>
        {error && (
          <div className="playground-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={resetDemo}>
              Reload demo audio
            </button>
          </div>
        )}
        {source.kind === "file" && !error && (
          <button type="button" className="restore-demo" onClick={resetDemo}>
            Back to demo audio
          </button>
        )}
      </div>
    </>
  );
}
