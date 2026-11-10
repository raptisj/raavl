"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import type {
  Player,
  RaavlError,
  Source,
  WaveformData,
  Appearance,
  WaveformTheme,
} from "../../src";
import { parseTheme, waveformThemes } from "../../src";
import { defaultAppearance } from "../../src/themes";
import { AudioPlayer, PlayerRoot, PlayPauseButton, TimeDisplay, VolumeSlider, PlaybackRateSelect, LoopButton, PlayerStatus } from "../../src/react";
import { ModulesEditor } from "./ModulesEditor";
import { ScaleLab } from "./ScaleLab";
import { AnnotationEditor } from "./AnnotationEditor";
import { SoundCloudPlayer } from "./SoundCloudPlayer";
import { VanillaWaveform } from "./VanillaWaveform";
import "./style.css";
import { exampleCode } from "./snippets";
import { CopyButton } from "./CopyButton";
import { PlainCodeSnippet, type CodeSnippetProps } from "./CodeSnippet";
import { usePageTheme } from "./usePageTheme";

import {
  scenes,
  parseRoute,
  legacyDocumentationPath,
  type Scene,
  type Mode,
} from "./routes";

const sourceA: Source = { kind: "url", id: "demo-a", url: "/demo-a.wav" };
const sourceB: Source = { kind: "url", id: "demo-b", url: "/demo-b.wav" };
function Transport({ player, report }: { player: Player | null; report: (error: RaavlError) => void }) {
  return <PlayerRoot player={player} onError={report}>
    <div className="transport">
      <PlayPauseButton />
      <TimeDisplay />
    </div>
    <div className="audio-settings">
      <label>Volume <VolumeSlider /></label>
      <label>Speed <PlaybackRateSelect /></label>
      <LoopButton />
    </div>
    <PlayerStatus />
  </PlayerRoot>;
}
function PlayerCard({
  source,
  mode,
  title,
  detached = false,
}: {
  source: Source | null;
  mode: Mode;
  title: string;
  detached?: boolean;
}) {
  const pageTheme = usePageTheme();
  const [player, setPlayer] = useState<Player | null>(null),
    [error, setError] = useState<RaavlError | null>(null);
  const [theme, setTheme] = useState<WaveformTheme>(waveformThemes.sage);
  const [themeText, setThemeText] = useState(
    JSON.stringify(waveformThemes.sage, null, 2),
  );
  const [themeError, setThemeError] = useState("");
  const [overrides, setOverrides] = useState<Appearance>({});
  const [zoom, setZoom] = useState("fit");
  const [follow, setFollow] = useState<"off" | "visible" | "center">("visible");
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
  }, [source]);
  // Send every field so Vanilla's patch API also clears removed overrides.
  const appearance = useMemo(
    () => ({ ...defaultAppearance, ...theme.appearance, ...overrides }),
    [theme, overrides],
  );
  const activeTheme = useMemo(
    () =>
      color
        ? { ...theme, colors: { ...theme.colors, progress: color } }
        : theme,
    [theme, color],
  );
  const applyTheme = (next: WaveformTheme) => {
    setTheme(next);
    setOverrides({});
    setColor(null);
    setThemeError("");
    setThemeText(JSON.stringify(next, null, 2));
  };
  const exportedTheme = useMemo(
    () => ({ ...activeTheme, appearance }),
    [activeTheme, appearance],
  );
  const viewport = useMemo(
    () => ({ zoom: zoom === "fit" ? ("fit" as const) : Number(zoom), follow }),
    [zoom, follow],
  );
  return (
    <article className="player-card">
      <div className="card-heading">
        <h3>{title}</h3>
        <span className="badge">LIVE PREVIEW</span>
      </div>
      <p className="helper">
        Click, tap, or drag to seek · Double-click or double-tap to play · Tab
        to focus · ← → seek 1s · Shift seeks 10s
      </p>
      {detached ? (
        <div className="empty-wave">
          Waveform detached. Native audio remains yours.
        </div>
      ) : mode === "react" ? (
        <AudioPlayer
          source={source}
          waveform={{ appearance, theme: activeTheme, themeVersion: pageTheme,
            viewport, interaction: { drag: "seek" }, "aria-label": `${title} waveform` }}
          controls={{ playbackRate: true, loop: true }}
          onPlayer={setPlayer}
          onError={setError}
          aria-label={title}
        />
      ) : (
        <VanillaWaveform
          source={source}
          appearance={appearance}
          theme={activeTheme}
          viewport={viewport}
          onPlayer={setPlayer}
          onError={setError}
        />
      )}
      {(mode === "vanilla" || detached) && <Transport player={player} report={setError} />}
      <details className="customize" open>
        <summary>Customize this waveform</summary>
        <div className="view-settings">
          <label>
            Theme
            <select
              aria-label="Waveform theme"
              value={
                Object.entries(waveformThemes).find(
                  ([, preset]) => preset === theme,
                )?.[0] ?? "custom"
              }
              onChange={(event) =>
                applyTheme(
                  waveformThemes[
                    event.target.value as keyof typeof waveformThemes
                  ],
                )
              }
            >
              {Object.entries(waveformThemes).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.name}
                </option>
              ))}
              {!Object.values(waveformThemes).includes(theme) && (
                <option value="custom">{theme.name} (custom)</option>
              )}
            </select>
          </label>
          <label>
            Drawing
            <select
              value={appearance.style}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  style: e.target.value as "line" | "bars",
                }))
              }
            >
              <option value="bars">Bars</option>
              <option value="line">Envelope</option>
            </select>
          </label>
          <label>
            Zoom
            <select value={zoom} onChange={(e) => setZoom(e.target.value)}>
              <option value="fit">Fit width</option>
              <option value="100">100 px / sec</option>
              <option value="300">300 px / sec</option>
              <option value="600">600 px / sec</option>
            </select>
          </label>
          <label>
            Follow
            <select
              value={follow}
              onChange={(e) => setFollow(e.target.value as typeof follow)}
            >
              <option value="visible">Keep visible</option>
              <option value="center">Center</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            Height
            <input
              aria-label="Waveform height"
              type="range"
              min="24"
              max="2000"
              step="1"
              value={appearance.height}
              onChange={(e) =>
                setOverrides((current) => ({
                  ...current,
                  height: Number(e.target.value),
                }))
              }
            />
          </label>
          <label>
            Color
            <input
              aria-label="Waveform color"
              type="color"
              value={color ?? (typeof theme.colors?.progress === "string" ? theme.colors.progress : "#285d50")}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          {(appearance.style === "line"
            ? ([["lineWidth", "Line thickness", 0.5, 20, 0.5]] as const)
            : ([
                ["barWidth", "Bar width", 0.5, 100, 0.5],
                ["barGap", "Bar gap", 0, 100, 0.5],
                ["barRadius", "Bar rounding", 0, 100, 0.5],
              ] as const)
          ).map(([key, label, min, max, step]) => (
            <label key={key}>
              {label} · {appearance[key]}px
              <input
                type="range"
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={appearance[key]}
                onChange={(event) =>
                  setOverrides((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
          <label>
            Amplitude · {Math.round(appearance.amplitude * 100)}%
            <input
              type="range"
              aria-label="Waveform amplitude"
              min="0.1"
              max="1"
              step="0.01"
              value={appearance.amplitude}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  amplitude: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Playhead · {appearance.cursorWidth}px
            <input
              type="range"
              aria-label="Playhead width"
              min="0"
              max="20"
              step="0.5"
              value={appearance.cursorWidth}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  cursorWidth: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <details className="theme-json">
          <summary>Edit or export theme JSON</summary>
          <p>
            Presets come from one JSON file. Apply your own values here; audio
            keeps playing. Export includes your control adjustments.
          </p>
          <label>
            Theme JSON
            <textarea
              aria-label="Theme JSON"
              rows={12}
              spellCheck={false}
              value={themeText}
              onChange={(event) => setThemeText(event.target.value)}
            />
          </label>
          <div className="editor-actions">
            <button
              onClick={() => {
                try {
                  applyTheme(parseTheme(themeText));
                } catch (error) {
                  setThemeError((error as Error).message);
                }
              }}
            >
              Apply JSON
            </button>
            <button
              onClick={() =>
                setThemeText(JSON.stringify(exportedTheme, null, 2))
              }
            >
              Use current settings
            </button>
            <CopyButton code={JSON.stringify(exportedTheme, null, 2)} />
            <a
              download="waveform-theme.json"
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportedTheme, null, 2))}`}
            >
              Download JSON
            </a>
          </div>
          {themeError && <p role="alert">{themeError}</p>}
        </details>
      </details>
      {error && (
        <div className="error" role="alert">
          <strong>
            {error.stage}: {error.code}
          </strong>
          <span>{error.message}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
    </article>
  );
}
function PlaybackExample({ scene, mode }: { scene: Scene; mode: Mode }) {
  const [source, setSource] = useState<Source | null>(
      scene === "file" ? null : sourceA,
    ),
    [url, setUrl] = useState("/demo-a.wav");
  const [media, setMedia] = useState<HTMLAudioElement | null>(null),
    [peaks, setPeaks] = useState<WaveformData | null>(null);
  const [badPeaks, setBadPeaks] = useState(false),
    [detached, setDetached] = useState(false),
    [assetError, setAssetError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/demo-a.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load demo peaks");
        return r.json();
      })
      .then(setPeaks)
      .catch((error) => {
        if (error.name !== "AbortError") setAssetError(error.message);
      });
    return () => abort.abort();
  }, []);
  const prepared = useMemo<Source | null>(() => {
    if (scene === "peaks")
      return peaks
        ? {
            ...sourceA,
            waveform: {
              kind: "peaks",
              data: badPeaks ? { ...peaks, sourceId: "wrong-asset" } : peaks,
            },
          }
        : null;
    if (scene === "external")
      return peaks && media
        ? {
            kind: "media",
            id: "demo-a",
            element: media,
            waveform: { kind: "peaks", data: peaks },
          }
        : null;
    return source;
  }, [scene, peaks, media, source, badPeaks]);
  return (
    <>
      {scene === "url" && (
        <form
          className="source-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSource({ kind: "url", id: url, url });
          }}
        >
          <label htmlFor="audio-url">Audio URL</label>
          <div>
            <input
              id="audio-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button className="primary">Load audio</button>
          </div>
          <p>
            Remote decoding requires CORS access. The included WAV is served
            locally.
          </p>
        </form>
      )}
      {scene === "file" && (
        <label className="file-drop">
          Choose a local audio file
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                setSource({ kind: "file", id: crypto.randomUUID(), file });
            }}
          />
          <span>
            {source?.kind === "file" && source.file instanceof File
              ? source.file.name
              : "MP3, WAV, OGG, or another format your browser supports"}
          </span>
        </label>
      )}
      {scene === "peaks" && (
        <div className="callout">
          <p>
            This 12-second demo uses the supplied-peaks path intended for long
            recordings. Its waveform comes from JSON.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={badPeaks}
              onChange={(e) => setBadPeaks(e.target.checked)}
            />
            Supply mismatched peaks to test error isolation
          </label>
        </div>
      )}
      {scene === "external" && (
        <div className="callout external">
          <div>
            <strong>Application-owned audio</strong>
            <p>Start playback, then detach. Audio should keep playing.</p>
          </div>
          <audio ref={setMedia} src="/demo-a.wav" controls loop />
          <button onClick={() => setDetached((v) => !v)}>
            {detached ? "Attach waveform" : "Detach waveform"}
          </button>
        </div>
      )}
      {assetError && <p role="alert">{assetError}</p>}
      <PlayerCard
        source={prepared}
        mode={mode}
        title={
          scene === "file" ? "Your recording" : "Sequence A · warm arpeggio"
        }
        detached={detached}
      />
      {scene === "dual" && (
        <PlayerCard
          source={sourceB}
          mode={mode}
          title="Sequence B · bright arpeggio"
        />
      )}
      {(scene === "styling" || scene === "url") && (
        <div className="test-actions">
          <button
            onClick={() => setSource(source === sourceA ? sourceB : sourceA)}
          >
            Switch demo source
          </button>
          <button onClick={() => setSource(null)}>Clear source</button>
          <button onClick={() => setSource(sourceA)}>Restore demo</button>
          <span>Try switching while audio is loading or playing.</span>
        </div>
      )}
    </>
  );
}
function Example({ scene, mode }: { scene: Scene; mode: Mode }) {
  if (scene === "soundcloud") return <SoundCloudPlayer mode={mode} />;
  if (scene === "modules") return <ModulesEditor mode={mode} />;
  if (scene === "scale") return <ScaleLab />;
  return scene === "annotations" ? (
    <AnnotationEditor mode={mode} />
  ) : (
    <PlaybackExample scene={scene} mode={mode} />
  );
}
function CodeExample({ scene, mode, Code }: { scene: Scene; mode: Mode; Code: ComponentType<CodeSnippetProps> }) {
  const code = exampleCode(scene, mode);
  return (
    <section className="code-example" aria-label="Example code">
      <div className="code-heading">
        <h3>Code</h3>
        <div className="frameworks" role="group" aria-label="Code framework">
          {(["vanilla", "react"] as const).map((framework) => (
            <a
              key={framework}
              href={`#demos/${scene}/${framework}`}
              aria-current={mode === framework ? "true" : undefined}
              aria-controls="example-code"
            >
              {framework === "vanilla" ? "Vanilla JS" : "React"}
            </a>
          ))}
        </div>
        <CopyButton code={code} />
      </div>
      <Code
        code={code}
        language={mode === "vanilla" ? "js" : "tsx"}
        id="example-code"
        tabIndex={0}
        aria-label={`${mode === "vanilla" ? "Vanilla JavaScript" : "React"} example`}
      />
    </section>
  );
}
export function Examples({ Code = PlainCodeSnippet }: { Code?: ComponentType<CodeSnippetProps> } = {}) {
  const [route, setRoute] = useState(() => parseRoute(""));
  useEffect(() => {
    const change = () => {
      const documentation = legacyDocumentationPath(location.hash);
      if (documentation) {
        location.replace(documentation);
        return;
      }
      setRoute(parseRoute(location.hash));
    };
    change();
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  const scene = scenes.find(([id]) => id === route.scene);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.scene]);
  return (
    <div className="examples-app">
      <main>
        <section className="intro">
          {/* <p className="eyebrow">Explore interactive examples</p> */}
          <h1>{scene ? scene[2] : "Make some waves"}</h1>
          <p>
            {scene
              ? scene[3]
              : "Explore our interactive examples and explore the potential."}
          </p>
        </section>
        {!scene ? (
          <>
            <div className="demo-grid">
              {scenes.map(([id, , title, description]) => (
                <a className="demo-tile" key={id} href={`#demos/${id}/vanilla`}>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <span className="tile-link">Open playground →</span>
                </a>
              ))}
            </div>
            <aside className="docs-callout">
              <div>
                <h2>Build your own waveform</h2>
                <p>
                  Start with usage examples, then explore every option in the
                  API reference.
                </p>
              </div>
              <a href="/docs">Read the documentation →</a>
            </aside>
          </>
        ) : (
          <div className="workspace">
            <nav className="section-nav" aria-label="Examples">
              <a href="#demos">← All examples</a>
              {scenes.map(([id, , title]) => (
                <a
                  key={id}
                  href={`#demos/${id}/${route.mode}`}
                  aria-current={route.scene === id ? "page" : undefined}
                >
                  {title}
                </a>
              ))}
            </nav>
            <section className="demo" aria-label={scene[2]}>
              <Example
                key={
                  scene[0] === "modules" || scene[0] === "soundcloud"
                    ? `preview/${scene[0]}/${route.mode}`
                    : scene[0]
                }
                scene={scene[0]}
                // Playback previews share AudioPlayer across code tabs so audio keeps playing.
                mode={scene[0] === "modules" || scene[0] === "soundcloud"
                  ? route.mode
                  : scene[0] === "annotations" || scene[0] === "scale" ? "vanilla" : "react"}
              />
              <CodeExample
                Code={Code}
                key={`${scene[0]}/${route.mode}`}
                scene={scene[0]}
                mode={route.mode}
              />
            </section>
          </div>
        )}
        <footer>
          <span>raavl</span>
          <a href="/docs">Usage & API reference →</a>
        </footer>
      </main>
    </div>
  );
}
