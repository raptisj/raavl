"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import {
  mountPlaybackActions,
  type ActionsToolbarOptions,
} from "../dom/actions-toolbar.js";
import { usePlayerRoot } from "./player-root.js";
import type { RaavlError } from "../core/types.js";

export type ActionsToolbarProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onError"
> &
  Omit<ActionsToolbarOptions, "player">;

/** Playback and region actions sharing the nearest PlayerRoot or AudioPlayer. */
export function ActionsToolbar(props: ActionsToolbarProps) {
  return <PlaybackActions {...props} />;
}

export function PlaybackActions({
  range,
  sourceId,
  variant = "icons",
  disabled,
  onError,
  onCreateRegion,
  regionOnly = false,
  ...html
}: ActionsToolbarProps & { regionOnly?: boolean }) {
  const { player, reportError } = usePlayerRoot();
  const host = useRef<HTMLDivElement>(null);
  const toolbar = useRef<ReturnType<typeof mountPlaybackActions> | null>(null);
  useEffect(() => {
    toolbar.current = mountPlaybackActions(
      host.current!,
      { player: null },
      regionOnly,
    );
    return () => {
      toolbar.current?.dispose();
      toolbar.current = null;
    };
  }, [regionOnly]);
  useEffect(() => {
    toolbar.current?.update({
      player,
      range,
      sourceId,
      variant,
      disabled,
      onCreateRegion,
      onError: onError ?? ((error) => reportError(error as RaavlError)),
    });
  }, [
    player,
    range,
    sourceId,
    variant,
    disabled,
    onError,
    onCreateRegion,
    reportError,
    regionOnly,
  ]);
  return <div {...html} ref={host} />;
}
