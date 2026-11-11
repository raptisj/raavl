import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPlayer,
  mountWaveform,
  createAnnotations,
  parseAnnotations,
  stringifyAnnotations,
  type Player,
  type Source,
  type WaveformView,
  type AnnotationStore,
  type AnnotationDocument,
  type AnnotationChange,
  type ControlledAnnotations,
  type Region,
} from "raavl";
import { Waveform, usePlayerState, usePlayerTime } from "raavl/react";
import { usePageTheme } from './usePageTheme';
import { Preview } from "./Preview";
import { DemoSettings } from "./DemoSettings";
import { annotationDocument, annotationStyles } from "./annotation-example";
import type { ExampleCodeOptions } from "./snippets";

const initial = annotationDocument;
const first: Source = { kind: "url", id: "demo-a", url: "/demo-a.wav" };
const second: Source = { kind: "url", id: "demo-b", url: "/demo-b.wav" };
const labelSlot = (region: Region) => {
  const element = document.createElement("strong");
  element.textContent = `◆ ${region.label || region.id}`;
  return element;
};
type CanvasProps = {
  source: Source;
  annotations: AnnotationStore | ControlledAnnotations | null;
  zoom: number | "fit";
  snap: number;
  onPlayer: (player: Player | null) => void;
  onSelect: (id: string | null) => void;
  onError: (error: Error) => void;
};
function VanillaEditor(props: CanvasProps) {
  const pageTheme = usePageTheme();
  const container = useRef<HTMLDivElement>(null),
    view = useRef<WaveformView | null>(null),
    player = useRef<Player | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const instance = createPlayer();
    player.current = instance;
    view.current = mountWaveform(container.current!, {
      player: instance,
      interaction: { drag: "select" },
      appearance: { style: "bars", height: 200 },
    });
    latest.current.onPlayer(instance);
    return () => {
      view.current?.dispose();
      view.current = null;
      instance.dispose();
      latest.current.onPlayer(null);
      player.current = null;
    };
  }, []);
  useEffect(() => { view.current?.refreshTheme(); }, [pageTheme]);
  useEffect(() => {
    const abort = new AbortController();
    void player
      .current!.setSource(props.source, { signal: abort.signal })
      .catch((error) => {
        if (error.code !== "CANCELLED") latest.current.onError(error);
      });
    return () => abort.abort();
  }, [props.source]);
  useEffect(() => {
    view.current?.update({
      annotations: props.annotations,
      annotationEditor: true,
      annotationRules: { snap: props.snap, minLength: 0.1 },
      viewport: { zoom: props.zoom },
      renderRegionLabel: labelSlot,
      onAnnotationSelect: props.onSelect,
      onAnnotationError: props.onError,
    });
  }, [
    props.annotations,
    props.zoom,
    props.snap,
    props.onSelect,
    props.onError,
  ]);
  return <div ref={container} />;
}
function Time({ player }: { player: Player | null }) {
  return <span className="clock">{usePlayerTime(player).toFixed(2)}s</span>;
}

export function AnnotationEditor({ mode, onOptionsChange }: {
  mode: "vanilla" | "react";
  onOptionsChange?: (options: ExampleCodeOptions) => void;
}) {
  const pageTheme = usePageTheme();
  const [document, setDocument] = useState<AnnotationDocument>(initial),
    [revision, setRevision] = useState(0);
  const [ownership, setOwnership] = useState<"controlled" | "store">(
      "controlled",
    ),
    [accept, setAccept] = useState(true);
  const [store, setStore] = useState<AnnotationStore | null>(null),
    [player, setPlayer] = useState<Player | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [commits, setCommits] = useState(0);
  const [source, setSource] = useState(first),
    [zoom, setZoom] = useState<number | "fit">("fit"),
    [snap, setSnap] = useState(0.1);
  useEffect(() => { onOptionsChange?.({ annotations: { zoom, snap } }); }, [zoom, snap, onOptionsChange]);
  const [json, setJson] = useState(stringifyAnnotations(initial));
  const status = usePlayerState(player, (snapshot) => snapshot?.source);
  const playing = usePlayerState(
    player,
    (snapshot) => snapshot?.playback === "playing",
  );
  const selected = [...document.regions, ...document.markers].find(
    (item) => item.id === selectedId,
  );
  const report = useCallback((error: Error) => setError(error.message), []);
  const commit = useCallback(
    (next: AnnotationDocument, change: AnnotationChange) => {
      if (change.baseRevision !== revision) {
        setNotice("Edit cancelled: document changed.");
        return;
      }
      setCommits((count) => count + 1);
      if (!accept) {
        setNotice("Application rejected the proposed edit.");
        return;
      }
      setDocument(next);
      setRevision((value) => value + 1);
      setNotice(`${change.operation} committed (${change.origin}).`);
    },
    [revision, accept],
  );
  useEffect(() => {
    if (ownership !== "store") {
      setStore(null);
      return;
    }
    const instance = createAnnotations({ document });
    const off = instance.onCommit((next, change) => {
      setDocument(next);
      setRevision(instance.getSnapshot().revision);
      setCommits((count) => count + 1);
      setNotice(`${change.operation} committed (${change.origin}).`);
    });
    setStore(instance);
    return () => {
      off();
      instance.dispose();
    };
    // Ownership switches explicitly adopt the current document.
  }, [ownership]);
  const controlled = useMemo<ControlledAnnotations>(
    () => ({ value: document, revision, onCommit: commit }),
    [document, revision, commit],
  );
  useEffect(() => {
    setSelectedId(null);
  }, [source]);
  const attempt = (fn: () => void) => {
    try {
      setError("");
      fn();
    } catch (error) {
      report(error as Error);
    }
  };
  const edit = (fn: (target: AnnotationStore) => void) =>
    attempt(() => {
      if (ownership === "store") {
        if (!store) return;
        fn(store);
        return;
      }
      const temporary = createAnnotations({
        value: document,
        revision,
        onCommit: commit,
      });
      try {
        temporary.setDuration(player?.getSnapshot().duration || null);
        fn(temporary);
      } finally {
        temporary.dispose();
      }
    });
  const matching = source.id === document.sourceId;
  const enabled = status === "ready" && matching;
  const load = (text: string) =>
    edit((target) => target.replaceDocument(parseAnnotations(text, source.id)));
  const downloadable = () =>
    attempt(() => {
      const url = URL.createObjectURL(
        new Blob([stringifyAnnotations(document)], {
          type: "application/json",
        }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "annotations.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  return (
    <article className="player-card annotation-editor">
      <h3>Annotation studio</h3>
      <p className="helper">
        Click or tap the waveform to move the playhead. Double-click or
        double-tap a region to play it from start to end.
        Drag empty space to select, drag labels to move, and drag handles to
        resize. Choose a badge below the waveform to edit a region or marker.
      </p>
      <Preview>
        <style>{annotationStyles}</style>
        <div className="annotation-app">
          {mode === "react" ? (
            <Waveform
              source={source}
              themeVersion={pageTheme}
              onPlayer={setPlayer}
              onError={report}
              appearance={{ style: "bars", height: 200 }}
              viewport={{ zoom }}
              interaction={{ drag: "select" }}
              annotationRules={{ snap, minLength: 0.1 }}
              {...(ownership === "controlled"
                ? {
                    annotations: document,
                    annotationsRevision: revision,
                    onAnnotationsCommit: commit,
                  }
                : { annotationStore: store ?? undefined })}
              annotationEditor
              onAnnotationSelect={setSelectedId}
              renderRegionLabel={(region) => (
                <strong>◆ {region.label || region.id}</strong>
              )}
              aria-label="Editable recording"
            />
          ) : (
            <VanillaEditor
              source={source}
              annotations={ownership === "controlled" ? controlled : store}
              zoom={zoom}
              snap={snap}
              onPlayer={setPlayer}
              onSelect={setSelectedId}
              onError={report}
            />
          )}
          <div className="transport">
            <button
              className="primary"
              disabled={status !== "ready"}
              onClick={() => {
                if (playing) player!.pause();
                else void player!.play().catch(report);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              disabled={!enabled || !selected || !("start" in selected)}
              onClick={() => {
                if (selected && "start" in selected)
                  void player!.playRange(selected).catch(report);
              }}
            >
              Play region
            </button>
            <button
              disabled={!enabled || !selected || !("start" in selected)}
              onClick={() => {
                if (selected && "start" in selected)
                  void player!.playRange({ ...selected, loop: true }).catch(report);
              }}
            >
              Loop region
            </button>
            <Time player={player} />
          </div>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      </Preview>
      <DemoSettings summary="Annotation options">
        <details className="persistence">
          <summary>Save, load & export annotations</summary>
          <p>JSON contains annotation data only. Audio stays separate.</p>
          <div className="editor-actions">
            <button
              onClick={() =>
                attempt(() => {
                  localStorage.setItem(
                    "raavl-annotations-demo",
                    stringifyAnnotations(document),
                  );
                  setNotice("Saved to this browser.");
                })
              }
            >
              Save in browser
            </button>
            <button
              onClick={() =>
                attempt(() => {
                  const saved = localStorage.getItem("raavl-annotations-demo");
                  if (!saved) throw new Error("No saved annotations");
                  load(saved);
                })
              }
            >
              Load saved
            </button>
            <button onClick={() => setJson(stringifyAnnotations(document))}>
              Refresh JSON
            </button>
            <button onClick={downloadable}>Download JSON</button>
          </div>
          <label>
            Annotation JSON
            <textarea
              rows={10}
              value={json}
              onChange={(event) => setJson(event.target.value)}
            />
          </label>
          <button onClick={() => load(json)}>Import JSON</button>
        </details>
        <div className="audio-settings editor-settings">
          <label>
            Ownership
            <select
              value={ownership}
              onChange={(event) =>
                setOwnership(event.target.value as typeof ownership)
              }
            >
              <option value="controlled">Application controlled</option>
              <option value="store">Library store</option>
            </select>
          </label>
          <label>
            Snap
            <select
              value={snap}
              onChange={(event) => setSnap(Number(event.target.value))}
            >
              <option value="0">Off</option>
              <option value="0.1">0.1 seconds</option>
              <option value="0.5">0.5 seconds</option>
              <option value="1">1 second</option>
            </select>
          </label>
          <label>
            Zoom
            <select
              value={zoom}
              onChange={(event) =>
                setZoom(
                  event.target.value === "fit"
                    ? "fit"
                    : Number(event.target.value),
                )
              }
            >
              <option value="fit">Fit</option>
              <option value="150">150 px/s</option>
              <option value="300">300 px/s</option>
            </select>
          </label>
          {ownership === "controlled" && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={accept}
                onChange={(event) => setAccept(event.target.checked)}
              />
              Accept edits
            </label>
          )}
        </div>
        <div className="editor-actions">
          <button onClick={() => setSource(source === first ? second : first)}>
            {source === first
              ? "Switch to other audio"
              : "Return to annotated audio"}
          </button>
          <button
            onClick={() =>
              edit((target) =>
                target.replaceDocument({
                  ...document,
                  regions: document.regions.map((region, index) =>
                    index === 0
                      ? { ...region, label: `${region.label} *` }
                      : region,
                  ),
                }),
              )
            }
          >
            Simulate external edit
          </button>
          <span>
            {commits} edit proposals · revision {revision}
          </span>
        </div>
      </DemoSettings>
      <p role="status" className="helper">
        {notice}
      </p>
    </article>
  );
}
