"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import {
  mountActionsToolbar,
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
export function ActionsToolbar({
  range,
  sourceId,
  variant = "icons",
  disabled,
  onError,
  onCreateRegion,
  ...html
}: ActionsToolbarProps) {
  const { player, reportError } = usePlayerRoot();
  const host = useRef<HTMLDivElement>(null);
  const toolbar = useRef<ReturnType<typeof mountActionsToolbar> | null>(null);
  useEffect(() => {
    toolbar.current = mountActionsToolbar(host.current!, { player: null });
    return () => {
      toolbar.current?.dispose();
      toolbar.current = null;
    };
  }, []);
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
  }, [player, range, sourceId, variant, disabled, onError, onCreateRegion, reportError]);
  return <div {...html} ref={host} />;
}
