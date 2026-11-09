"use client";

import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AudioLines,
  Pause,
  Play,
  RotateCcw,
  Upload,
  Volume2,
  Plus,
  Trash2,
} from "lucide-react";
import { Waveform, usePlayerState, usePlayerTime } from "raavl/react";
import {
  waveformThemes,
  type Player,
  type Source,
  type PlayerSnapshot,
  type AnnotationDocument,
  type WaveformView,
} from "raavl";
import { usePageTheme } from "../../examples/live/usePageTheme";

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
const modes = ["playback", "regions"] as const;
type PlaygroundMode = (typeof modes)[number];
type RegionState = { value: AnnotationDocument; revision: number };
const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;

export function AudioPlayground() {
  const id = useId();
  const [mode, setMode] = useState<PlaygroundMode>("playback");
  const pageTheme = usePageTheme();
  const [themeId, setThemeId] = useState<"site" | keyof typeof waveformThemes>(
    "site",
  );
  const theme = themeId === "site" ? null : waveformThemes[themeId];
  const [player, setPlayer] = useState<Player | null>(null);
  const [demo, setDemo] = useState(demoSounds[0]);
  const [source, setSource] = useState<Source>(() => demoSource(demoSounds[0]));
  const [title, setTitle] = useState(demoSounds[0].file);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<Record<string, RegionState>>({});
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const view = useRef<WaveformView | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const state = usePlayerState(player, selectState);
  const time = usePlayerTime(player);
  const ready = state?.source === "ready";
  const playing =
    state?.playback === "playing" || state?.playback === "buffering";
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
                  label: "Region 1",
                },
                {
                  id: "region-2",
                  start: sourceDuration * 0.53,
                  end: sourceDuration * 0.72,
                  label: "Region 2",
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
    view.current?.clearSelection();
    setSelection(null);
    setSelectedId(null);
  }
  function switchMode(next: PlaygroundMode) {
    clearSelection();
    setMode(next);
  }
  function addRegion() {
    if (!canEditRegions || sourceDuration < 0.1) return;
    const length = Math.min(5, sourceDuration);
    const start = Math.min(
      player?.getCurrentTime() ?? 0,
      sourceDuration - length,
    );
    const range =
      selection && selection.end - selection.start >= 0.1
        ? selection
        : { start, end: start + length };
    const region = {
      id: crypto.randomUUID(),
      ...range,
      label: `Region ${regions.value.regions.length + 1}`,
    };
    acceptRegions(
      { ...regions.value, regions: [...regions.value.regions, region] },
      regions.revision,
    );
    view.current?.clearSelection();
    setSelectedId(region.id);
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
        <h2 className="stage-caption" id="playground-title">
          <span className="live-dot" aria-hidden="true" /> LIVE DEMO
        </h2>
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
                <option value="site">Match website</option>
                {Object.entries(waveformThemes).map(([id, preset]) => (
                  <option key={id} value={id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="playground-wave">
          <Waveform
            source={source}
            onPlayer={setPlayer}
            onView={(value) => {
              view.current = value;
            }}
            theme={theme}
            themeVersion={pageTheme}
            onError={(cause) => setError(cause.message)}
            appearance={{
              style: "bars",
              barWidth: 3,
              barGap: 3,
              barRadius: 2,
              borderRadius: 0,
              ...theme?.appearance,
              height: 150,
              normalize: true,
            }}
            interaction={{
              seek: "click",
              drag: mode === "regions" ? "select" : "seek",
            }}
            {...(mode === "regions" && sourceDuration > 0
              ? {
                  annotations: regions.value,
                  annotationsRevision: regions.revision,
                  onAnnotationsCommit: (
                    value: AnnotationDocument,
                    change: { baseRevision: number },
                  ) => acceptRegions(value, change.baseRevision),
                  annotationRules: { minLength: 0.1 },
                  onSelectionChange: setSelection,
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
        <div className="wave-ruler" aria-hidden="true">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <span key={fraction}>{timeLabel(duration * fraction)}</span>
          ))}
        </div>
        <div className="playback-controls">
          <button
            className="listen-play"
            type="button"
            disabled={!ready || state?.playback === "starting"}
            aria-label={playing ? "Pause audio" : "Play audio"}
            onClick={() => {
              setError("");
              if (playing) command(() => player!.pause());
              else
                void player?.play().catch((cause) => setError(cause.message));
            }}
          >
            {playing ? (
              <Pause size={19} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={19} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            className="icon-button"
            type="button"
            disabled={!ready}
            aria-label="Restart audio"
            onClick={() => command(() => player!.seek(0))}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
          <span
            className="playback-time"
            aria-label={`Playback time ${timeLabel(time)} of ${timeLabel(duration)}`}
          >
            {timeLabel(time)} <span>/ {timeLabel(duration)}</span>
          </span>
          <div className="listening-settings">
            <label className="speed-control">
              <span className="sr-only">Playback speed</span>
              <select
                aria-label="Playback speed"
                disabled={!ready}
                value={state?.playbackRate ?? 1}
                onChange={(event) =>
                  command(() =>
                    player!.setPlaybackRate(Number(event.target.value)),
                  )
                }
              >
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </label>
            <label className="volume-control">
              <Volume2 size={17} aria-hidden="true" />
              <span className="sr-only">Volume</span>
              <input
                type="range"
                aria-label="Volume"
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
        </div>
        {mode === "regions" && (
          <div className="region-tools">
            <p className="region-hint">
              Drag to select a range. Move regions or resize their edges.
            </p>
            <div className="region-actions">
              <button
                type="button"
                disabled={!canEditRegions || sourceDuration < 0.1}
                onClick={addRegion}
              >
                <Plus size={13} aria-hidden="true" />{" "}
                {selection ? "Save selection" : "Add region"}
              </button>
              <button
                type="button"
                disabled={!canEditRegions || !selectedRegion}
                onClick={() => {
                  if (selectedRegion)
                    void player
                      ?.playRange(selectedRegion)
                      .catch((cause) => setError(cause.message));
                }}
              >
                <Play size={12} aria-hidden="true" /> Play region
              </button>
              <button
                type="button"
                disabled={!canEditRegions || !selectedRegion}
                onClick={() => {
                  if (!selectedRegion) return;
                  acceptRegions(
                    {
                      ...regions.value,
                      regions: regions.value.regions.filter(
                        (region) => region.id !== selectedRegion.id,
                      ),
                    },
                    regions.revision,
                  );
                  setSelectedId(null);
                }}
              >
                <Trash2 size={13} aria-hidden="true" /> Delete region
              </button>
              {selectedRegion && (
                <label className="region-name">
                  Name
                  <input
                    aria-label="Region name"
                    value={selectedRegion.label ?? ""}
                    disabled={!canEditRegions}
                    onChange={(event) => {
                      acceptRegions(
                        {
                          ...regions.value,
                          regions: regions.value.regions.map((region) =>
                            region.id === selectedRegion.id
                              ? { ...region, label: event.target.value }
                              : region,
                          ),
                        },
                        regions.revision,
                      );
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}
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
