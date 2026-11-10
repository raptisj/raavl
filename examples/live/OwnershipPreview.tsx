"use client";

import { useId, useState } from "react";
import type { Player, Source } from "../../src";
import { Waveform, usePlayer, usePlayerState, usePlayerTime } from "../../src/react";
import { usePageTheme } from "./usePageTheme";

const demoSource: Source = {
  kind: "url",
  id: "episode-1",
  url: "/demo-a.wav",
};

function PlaybackTime({ player }: { player: Player | null }) {
  const seconds = usePlayerTime(player);
  return <output aria-label="Playback time">{seconds.toFixed(1)} s</output>;
}

function PlaybackControls({ player, onError }: {
  player: Player | null;
  onError: (error: Error) => void;
}) {
  const ready = usePlayerState(player, state => state?.source === "ready");
  const playing = usePlayerState(player, state =>
    state?.playback === "playing" || state?.playback === "buffering");
  return <div className="ownership-controls">
    <button type="button" className="raavl-button" disabled={!ready} onClick={() => {
      if (!player || !ready) return;
      if (playing) player.pause();
      else void player.play().catch(onError);
    }}>{playing ? "Pause" : "Play"}</button>
    <PlaybackTime player={player} />
  </div>;
}

function EpisodeCard() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState("");
  const themeVersion = usePageTheme();
  return <article className="ownership-card">
    <p className="ownership-title">Episode 1: Behind the recording</p>
    <Waveform source={demoSource} onPlayer={setPlayer}
      onError={error => setError(error.message)} themeVersion={themeVersion}
      appearance={{ style: "bars", height: 120 }} interaction={{ drag: "seek" }}
      aria-label="Episode 1 waveform" />
    <PlaybackControls player={player} onError={error => setError(error.message)} />
    {error && <p role="alert">{error}</p>}
  </article>;
}

function EpisodeCardPreview() {
  const [visible, setVisible] = useState(true);
  return <>
    <p className="ownership-hint">Play the demo, then remove the card. Its audio stops.</p>
    {visible ? <EpisodeCard /> : <p className="ownership-placeholder">Episode card removed.</p>}
    <button type="button" className="raavl-button" onClick={() => setVisible(current => !current)}>
      {visible ? "Remove episode card" : "Restore episode card"}
    </button>
  </>;
}

function SharedPlayerPreview() {
  const [showWaveform, setShowWaveform] = useState(true);
  const [error, setError] = useState("");
  const player = usePlayer({ source: demoSource, onError: error => setError(error.message) });
  const waveformId = useId();
  const themeVersion = usePageTheme();
  return <>
    <p className="ownership-hint">Play the demo, then hide the waveform. Audio and the clock keep going.</p>
    <section className="ownership-card">
      <p className="ownership-title">Episode editor</p>
      <PlaybackControls player={player} onError={error => setError(error.message)} />
      <button type="button" className="raavl-button" aria-expanded={showWaveform}
        aria-controls={waveformId} onClick={() => setShowWaveform(current => !current)}>
        {showWaveform ? "Hide waveform" : "Show waveform"}
      </button>
      <div id={waveformId}>
        {showWaveform && player && <Waveform player={player} themeVersion={themeVersion}
          appearance={{ style: "bars", height: 180 }} interaction={{ drag: "seek" }}
          aria-label="Episode editor waveform" />}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  </>;
}

export function OwnershipPreview({ kind }: { kind: "source" | "player" }) {
  return <div className="ownership-preview not-prose" role="region"
    aria-label={kind === "source" ? "Episode card preview" : "Shared player preview"}>
    <p className="ownership-audio">Bundled demo audio · 12 seconds</p>
    {kind === "source" ? <EpisodeCardPreview /> : <SharedPlayerPreview />}
  </div>;
}
