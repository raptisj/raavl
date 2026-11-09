import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  Player,
  PlayerSnapshot,
  RavlError,
  Source,
  WaveformData,
} from "../../src";
import { Waveform, usePlayerState, usePlayerTime } from "../../src/react";
import { ModulesEditor } from './ModulesEditor'
import { ScaleLab } from './ScaleLab'
import { AnnotationEditor } from './AnnotationEditor'
import { VanillaWaveform } from "./VanillaWaveform";
import "../../src/styles.css";
import "./style.css";
import { exampleCode } from "./snippets";
import { CopyButton } from "./CopyButton";

import { scenes, parseRoute, type Scene, type Mode } from './routes';
import { Documentation } from './Documentation';

const sourceA: Source = { kind: "url", id: "demo-a", url: "/demo-a.wav" };
const sourceB: Source = { kind: "url", id: "demo-b", url: "/demo-b.wav" };
const selectState = (state: PlayerSnapshot | null) => state;
const timeLabel = (time: number) =>
  `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, "0")}`;
function Clock({
  player,
  duration,
}: {
  player: Player | null;
  duration: number;
}) {
  const time = usePlayerTime(player);
  return (
    <span className="clock" aria-label="Playback time">
      {timeLabel(time)} <span>/ {timeLabel(duration)}</span>
    </span>
  );
}
function Transport({
  player,
  report,
}: {
  player: Player | null;
  report: (error: RavlError) => void;
}) {
  const state = usePlayerState(player, selectState),
    ready = state?.source === "ready";
  const playing =
    state?.playback === "playing" || state?.playback === "buffering";
  const command = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      report(error as RavlError);
    }
  };
  return (
    <>
      <div className="transport">
        <button
          className="play primary"
          disabled={!ready}
          onClick={() => {
            if (playing) command(() => player!.pause());
            else void player!.play().catch(report);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            command(() => {
              player!.pause();
              player!.seek(0);
            })
          }
        >
          Reset
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            command(() =>
              player!.seek(Math.max(0, player!.getCurrentTime() - 2)),
            )
          }
        >
          −2s
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            command(() => player!.seek(player!.getCurrentTime() + 2))
          }
        >
          +2s
        </button>
        <Clock player={player} duration={state?.duration ?? 0} />
      </div>
      <div className="audio-settings">
        <label>
          Volume{" "}
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state?.volume ?? 1}
            disabled={!ready}
            onChange={(e) =>
              command(() => player!.setVolume(Number(e.target.value)))
            }
          />
        </label>
        <label>
          Speed{" "}
          <select
            aria-label="Playback speed"
            value={state?.playbackRate ?? 1}
            disabled={!ready}
            onChange={(e) =>
              command(() => player!.setPlaybackRate(Number(e.target.value)))
            }
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={state?.loop ?? false}
            disabled={!ready}
            onChange={(e) => command(() => player!.setLoop(e.target.checked))}
          />
          Loop
        </label>
      </div>
      <div className="status">
        <span>
          Audio <b>{state?.source ?? "idle"}</b>
        </span>
        <span>
          Waveform <b>{state?.waveform ?? "idle"}</b>
        </span>
        <span>
          Playback <b>{state?.playback ?? "paused"}</b>
        </span>
      </div>
    </>
  );
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
  const [player, setPlayer] = useState<Player | null>(null),
    [error, setError] = useState<RavlError | null>(null);
  const [style, setStyle] = useState<"line" | "bars">("bars"),
    [zoom, setZoom] = useState("fit");
  const [follow, setFollow] = useState<"off" | "visible" | "center">("visible");
  const [color, setColor] = useState("#277e67"),
    [height, setHeight] = useState(160);
  useEffect(() => {
    setError(null);
  }, [source]);
  const appearance = useMemo(
    () => ({ style, height, barWidth: 2, barGap: 1 }),
    [style, height],
  );
  const viewport = useMemo(
    () => ({ zoom: zoom === "fit" ? ("fit" as const) : Number(zoom), follow }),
    [zoom, follow],
  );
  const colors = {
    "--ravl-progress-color": color,
    "--ravl-wave-color": `${color}70`,
  } as CSSProperties;
  return (
    <article className="player-card" style={colors}>
      <div className="card-heading">
        <h3>{title}</h3>
        <span className="badge">
          LIVE PREVIEW
        </span>
      </div>
      <p className="helper">
        Click, tap, or drag to seek · Double-click or double-tap to play · Tab to focus · ← → seek 1s · Shift seeks 10s
      </p>
      {detached ? (
        <div className="empty-wave">
          Waveform detached. Native audio remains yours.
        </div>
      ) : mode === "react" ? (
        <Waveform
          source={source}
          appearance={appearance}
          viewport={viewport}
          interaction={{ drag: "seek" }}
          onPlayer={setPlayer}
          onError={setError}
          themeVersion={color}
          aria-label={`${title} waveform`}
        />
      ) : (
        <VanillaWaveform
          source={source}
          appearance={appearance}
          viewport={viewport}
          onPlayer={setPlayer}
          onError={setError}
          themeVersion={color}
        />
      )}
      <Transport player={player} report={setError} />
      <details className="customize" open>
        <summary>Customize this waveform</summary>
        <div className="view-settings">
          <label>
            Drawing
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as typeof style)}
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
              min="80"
              max="260"
              step="20"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>
          <label>
            Color
            <input
              aria-label="Waveform color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
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
  if (scene === 'modules') return <ModulesEditor mode={mode} />
  if (scene === 'scale') return <ScaleLab />
  return scene === 'annotations' ? <AnnotationEditor mode={mode} /> : <PlaybackExample scene={scene} mode={mode} />
}
function CodeExample({ scene, mode }: { scene: Scene; mode: Mode }) {
  const code = exampleCode(scene, mode);
  return (
    <section className="code-example" aria-label="Example code">
      <div className="code-heading">
        <h3>Code</h3>
        <div className="frameworks" role="group" aria-label="Code framework">
          {(["vanilla", "react"] as const).map((framework) => (
            <a key={framework} href={`#demos/${scene}/${framework}`}
              aria-current={mode === framework ? "true" : undefined}
              aria-controls="example-code">
              {framework === "vanilla" ? "Vanilla JS" : "React"}
            </a>
          ))}
        </div>
        <CopyButton code={code} />
      </div>
      <pre id="example-code" tabIndex={0} aria-label={`${mode === "vanilla" ? "Vanilla JavaScript" : "React"} example`}><code>{code}</code></pre>
    </section>
  );
}
function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const change = () => setRoute(parseRoute(location.hash));
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  const scene = route.page === 'demos' ? scenes.find(([id]) => id === route.scene) : undefined;
  const pageTitle = route.page === 'docs' ? route.topic : route.scene;
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = route.page === 'docs' ? 'ravl — documentation' : 'ravl — examples';
  }, [route.page, pageTitle]);
  return (
    <>
      <header>
        <a className="brand" href="#demos">ravl <span>audio, made composable</span></a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#demos" aria-current={route.page === 'demos' ? 'page' : undefined}>Examples</a>
          <a href="#docs/start" aria-current={route.page === 'docs' ? 'page' : undefined}>Documentation</a>
        </nav>
      </header>
      <main>
        {route.page === 'docs' ? <Documentation topic={route.topic} /> : <>
          <section className="intro">
            <p className="eyebrow">Real components. Real audio.</p>
            <h1>{scene ? scene[2] : 'Make some waves.'}</h1>
            <p>{scene ? scene[3] : 'Explore nine interactive playgrounds. Each demo includes Vanilla JavaScript and React code to copy.'}</p>
          </section>
          {!scene ? <>
            <div className="demo-grid">
              {scenes.map(([id, number, title, description]) => <a className="demo-tile" key={id} href={`#demos/${id}/vanilla`}>
                <span className="eyebrow">EXAMPLE {number}</span><h2>{title}</h2><p>{description}</p><span className="tile-link">Open playground →</span>
              </a>)}
            </div>
            <aside className="docs-callout"><div><h2>Build your own waveform</h2><p>Start with usage examples, then explore every option in the API reference.</p></div><a href="#docs/start">Read the documentation →</a></aside>
          </> : <div className="workspace">
            <nav className="section-nav" aria-label="Examples">
              <a href="#demos">← All examples</a>
              {scenes.map(([id, number, title]) => <a key={id} href={`#demos/${id}/${route.mode}`} aria-current={route.scene === id ? 'page' : undefined}><span>{number}</span>{title}</a>)}
            </nav>
            <section className="demo" aria-label={scene[2]}>
              <Example key={scene[0] === 'modules' ? `preview/${scene[0]}/${route.mode}` : scene[0]} scene={scene[0]} mode={scene[0] === 'modules' ? route.mode : 'vanilla'} />
              <CodeExample key={`${scene[0]}/${route.mode}`} scene={scene[0]} mode={route.mode} />
            </section>
          </div>}
        </>}
        <footer><span>ravl · Audio, made composable</span><a href={route.page === 'docs' ? '#demos' : '#docs/start'}>{route.page === 'docs' ? 'Explore the playgrounds →' : 'Usage & API reference →'}</a></footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
