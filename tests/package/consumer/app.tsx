import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPlayer, mountWaveform } from "raavl";
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
let reactPlayer: ReturnType<typeof createPlayer> | null = null;
root.render(
  <StrictMode>
    <AudioPlayer
      source={{ kind: "url", id: "react", url: "/tone.wav" }}
      theme={waveformThemes.sage}
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
    errors,
    dispose() {
      root.unmount();
      view.dispose();
      player.dispose();
    },
  },
});
