"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPlayer } from "../player.js";
import type { Player, RaavlError, Source } from "../core/types.js";

export type UsePlayerOptions = {
  onError?: (error: RaavlError) => void;
} & (
  | { source?: Source | null; player?: never }
  | { player: Player | null; source?: never }
);

/** Share cancellation filtering and error deduplication with the waveform view. */
export function useErrorReporter(onError?: (error: RaavlError) => void) {
  const callback = useRef(onError);
  useEffect(() => {
    callback.current = onError;
  });
  const seen = useRef(new WeakSet<Error>());
  return useCallback((error: RaavlError) => {
    if (error.code === "CANCELLED" || seen.current.has(error)) return;
    seen.current.add(error);
    callback.current?.(error);
  }, []);
}

/** Own a browser player after commit, or borrow one without changing its source or lifetime. */
export function usePlayer({
  source,
  player: borrowed,
  onError,
}: UsePlayerOptions = {}): Player | null {
  const [owned, setOwned] = useState<Player | null>(null);
  const report = useErrorReporter(onError);
  // Ownership changes must not expose an instance disposed by the previous effect.
  const borrowing = borrowed !== undefined;
  const player = borrowing
    ? borrowed
    : owned?.getSnapshot().source !== "disposed"
      ? owned
      : null;

  useEffect(() => {
    if (borrowing) return;
    const instance = createPlayer();
    setOwned(instance);
    return () => instance.dispose();
  }, [borrowing]);

  useEffect(() => {
    if (!player || player.getSnapshot().source === "disposed") return;
    const observe = () => {
      const state = player.getSnapshot();
      if (state.error) report(state.error);
      if (state.waveformError) report(state.waveformError);
    };
    const off = player.subscribe(observe);
    observe();
    return off;
  }, [player, report]);

  // Inline descriptors with unchanged scalar fields do not reload audio.
  // Large immutable inputs retain identity-based comparison.
  const descriptor = useMemo(
    () => source,
    [
      source?.kind,
      source?.id,
      source?.revision,
      source?.kind === "url" ? source.url : undefined,
      source?.kind === "url" ? source.request : undefined,
      source?.kind === "file" ? source.file : undefined,
      source?.kind === "media" ? source.element : undefined,
      source?.waveform?.kind,
      source?.waveform?.kind === "peaks" ? source.waveform.data : undefined,
    ],
  );
  useEffect(() => {
    if (borrowing || !player || player.getSnapshot().source === "disposed")
      return;
    if (!descriptor) {
      player.clearSource();
      return;
    }
    const abort = new AbortController();
    void player
      .setSource(descriptor, { signal: abort.signal })
      .catch((error) => {
        if (!abort.signal.aborted) report(error);
      });
    return () => abort.abort();
  }, [player, borrowing, descriptor, report]);

  return player;
}
