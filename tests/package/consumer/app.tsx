import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createPlayer,
  mountLoopButton,
  mountMuteButton,
  mountWaveform,
  type WaveformView,
} from "raavl";
import { AudioPlayer } from "raavl/react";
import { waveformThemes } from "raavl/themes";
import "raavl/styles.css";

const errors: string[] = [];
const player = createPlayer();
const view = mountWaveform(document.getElementById("vanilla")!, {
  player,
  theme: waveformThemes.neon,
  label: "Vanilla waveform",
});
void player
  .setSource({ kind: "url", id: "vanilla", url: "/tone.wav" })
  .catch((error) => errors.push(error.message));
const root = createRoot(document.getElementById("react")!);
const params = new URLSearchParams(window.location.search);
const showToggles = params.has("toggles");
const vanilla = document.getElementById("vanilla")!;
const toggles = showToggles
  ? [mountMuteButton(vanilla, { player }), mountLoopButton(vanilla, { player })]
  : [];
const overlapCount = Number(params.get("overlaps"));
const editAnnotations = params.has("annotations") || overlapCount > 0;
const regions = overlapCount > 0 ? [
  { id: "vocal", start: 0.4, end: 0.65, label: "Vocal harmony" },
  { id: "intro", start: 0.3, end: 0.6, label: "Introduction and opening phrase with extended instrumentation" },
  { id: "guitar", start: 0.35, end: 0.7, label: "Guitar melody" },
  ...Array.from({ length: overlapCount - 3 }, (_, i) => ({
    id: `r${i}`,
    start: 0.8 + i * 0.04,
    end: 0.825 + i * 0.04,
    label: `Region ${i + 4}`,
  })),
] : [{ id: "intro", start: 0.3, end: 0.65, label: "Intro" }];
let reactPlayer: ReturnType<typeof createPlayer> | null = null;
let reactView: WaveformView | null = null;
root.render(
  <StrictMode>
    <AudioPlayer
      source={{ kind: "url", id: "react", url: "/tone.wav" }}
      controls={{ loop: showToggles }}
      waveform={{
        onView: (instance) => { reactView = instance; },
        ...(editAnnotations && {
          interaction: { drag: "select" },
          annotationEditor: params.has("modal") ? "modal" : true,
          defaultAnnotations: {
            version: 1,
            sourceId: "react",
            regions,
            markers: [],
          },
        }),
      }}
      onError={(error) => errors.push(error.message)}
      onPlayer={(instance) => {
        reactPlayer = instance;
      }}
    />
  </StrictMode>,
);

Object.assign(window, {
  packageTest: {
    player,
    get reactPlayer() {
      return reactPlayer;
    },
    get reactView() {
      return reactView;
    },
    errors,
    dispose() {
      root.unmount();
      for (const toggle of toggles) toggle.dispose();
      view.dispose();
      player.dispose();
    },
  },
});
