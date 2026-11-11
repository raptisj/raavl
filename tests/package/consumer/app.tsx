import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPlayer, mountWaveform, type WaveformView } from "raavl";
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
const editAnnotations = new URLSearchParams(window.location.search).has("annotations");
let reactPlayer: ReturnType<typeof createPlayer> | null = null;
let reactView: WaveformView | null = null;
root.render(
  <StrictMode>
    <AudioPlayer
      source={{ kind: "url", id: "react", url: "/tone.wav" }}
      theme={waveformThemes.sage}
      waveform={{
        onView: (instance) => { reactView = instance; },
        ...(editAnnotations && {
          interaction: { drag: "select" },
          annotationEditor: true,
          defaultAnnotations: {
            version: 1,
            sourceId: "react",
            regions: [{ id: "intro", start: 0.3, end: 0.65, label: "Intro" }],
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
      view.dispose();
      player.dispose();
    },
  },
});
