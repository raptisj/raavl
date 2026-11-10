"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Player, PlayerSnapshot } from "../core/types.js";
import type { AnnotationStore } from "../regions/index.js";

const noopSubscribe = () => () => {};
export function usePlayerState<T>(
  player: Player | null,
  selector: (state: PlayerSnapshot | null) => T,
): T {
  const readers = useMemo(() => {
    let previous: PlayerSnapshot | null | undefined;
    let selected: T;
    const server = selector(null);
    return {
      client: () => {
        const snapshot = player?.getSnapshot() ?? null;
        if (snapshot !== previous) {
          selected = selector(snapshot);
          previous = snapshot;
        }
        return selected;
      },
      server: () => server,
    };
  }, [player, selector]);
  return useSyncExternalStore(
    player?.subscribe ?? noopSubscribe,
    readers.client,
    readers.server,
  );
}
export function usePlayerTime(player: Player | null): number {
  return useSyncExternalStore(
    player?.subscribeTime ?? noopSubscribe,
    player?.getCurrentTime ?? (() => 0),
    () => 0,
  );
}

export function useAnnotations(store: AnnotationStore | null) {
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? (() => null),
    () => null,
  );
}
