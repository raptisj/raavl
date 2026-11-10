"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Player, PlayerSnapshot, RaavlError } from "../core/types.js";
import {
  useErrorReporter,
  usePlayer,
  type UsePlayerOptions,
} from "./use-player.js";

type PlayerContextValue = {
  player: Player | null;
  error: RaavlError | null;
  reportError: (error: RaavlError) => void;
  run: (command: (player: Player) => void | Promise<void>) => void;
};
export const PlayerContext = createContext<PlayerContextValue | null>(null);
export type PlayerRootProps = UsePlayerOptions & {
  children?: ReactNode;
  onPlayer?: (player: Player | null) => void;
};

export function usePlayerRoot() {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("Player controls must be inside PlayerRoot or AudioPlayer");
  return context;
}

/** Read the nearest root's controller without taking ownership of it. */
export function usePlayerContext(): Player | null {
  return usePlayerRoot().player;
}

type Settings = Pick<
  PlayerSnapshot,
  "volume" | "muted" | "playbackRate" | "loop"
>;
function settings(state: PlayerSnapshot): Settings {
  return {
    volume: state.volume,
    muted: state.muted,
    playbackRate: state.playbackRate,
    loop: state.loop,
  };
}

/** Shares one controller; only this root owns source loading and disposal. */
export function PlayerRoot({
  source,
  player: borrowed,
  onError,
  onPlayer,
  children,
}: PlayerRootProps) {
  const [error, setError] = useState<RaavlError | null>(null);
  const reportError: (error: RaavlError) => void = useErrorReporter((error) => {
    const state = player?.getSnapshot();
    // Snapshot failures already have their own subscriptions. Keep only errors
    // such as invalid source descriptors and annotation commands in context.
    setError(
      state?.error === error || state?.waveformError === error ? null : error,
    );
    onError?.(error);
  });
  const player: Player | null = usePlayer(
    borrowed !== undefined
      ? { player: borrowed, onError: reportError }
      : { source, onError: reportError },
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const callbacks = useRef(onPlayer);
  useEffect(() => {
    callbacks.current = onPlayer;
  });
  useEffect(() => {
    callbacks.current?.(player);
    return () => callbacks.current?.(null);
  }, [player]);

  const preferences = useRef<Settings | null>(null);
  useEffect(() => {
    if (!player || player.getSnapshot().source === "disposed") return;
    let lastMedia = player.getMediaElement();
    let configuredMedia: HTMLMediaElement | null = null;
    let applying = false;
    const observe = () => {
      const state = player.getSnapshot();
      const media = player.getMediaElement();
      if (media !== lastMedia || state.source === "idle") {
        lastMedia = media;
        setError(null);
      }
      if (borrowed !== undefined || applying || state.source !== "ready")
        return;
      if (media !== configuredMedia) {
        configuredMedia = media;
        if (preferences.current) {
          applying = true;
          try {
            const saved = preferences.current;
            player.setVolume(saved.volume);
            player.setMuted(saved.muted);
            player.setPlaybackRate(saved.playbackRate);
            player.setLoop(saved.loop);
          } catch (error) {
            reportError(error as RaavlError);
          } finally {
            applying = false;
          }
        }
      }
      preferences.current = settings(player.getSnapshot());
    };
    observe();
    return player.subscribe(observe);
  }, [player, borrowed, reportError]);

  const run = useCallback(
    (command: (player: Player) => void | Promise<void>) => {
      if (!player || player.getSnapshot().source !== "ready") return;
      setError(null);
      try {
        const pending = command(player);
        if (pending)
          void pending.catch((error) => {
            if (mounted.current) reportError(error as RaavlError);
          });
      } catch (error) {
        reportError(error as RaavlError);
      }
    },
    [player, reportError],
  );
  const value = useMemo(
    () => ({ player, error, reportError, run }),
    [player, error, reportError, run],
  );
  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
