"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  createAnnotations,
  type AnnotationDocument,
  type AnnotationStore,
  type AnnotationRules,
  type CommitHandler,
  type Region,
  type Selection,
} from "../regions/index.js";
import { useErrorReporter, usePlayer } from "./use-player.js";
import {
  mountWaveform,
  type Appearance,
  type AnnotationSnapper,
  type Interaction,
  type Viewport,
  type WaveformView,
  type WaveformTheme,
} from "../dom/index.js";
import type { Player, RaavlError, Source } from "../core/types.js";

import { useContext } from "react";
import { PlayerContext } from "./player-root.js";

type CommonProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onError" | "children"
> & {
  theme?: WaveformTheme | null;
  appearance?: Appearance;
  viewport?: Viewport;
  interaction?: Interaction;
  themeVersion?: string | number;
  onError?: (error: RaavlError) => void;
  onPlayer?: (player: Player | null) => void;
  onView?: (view: WaveformView | null) => void;
  snapAnnotation?: AnnotationSnapper;
  onDraw?: () => void;
  annotations?: AnnotationDocument;
  annotationsRevision?: number;
  defaultAnnotations?: AnnotationDocument;
  annotationStore?: AnnotationStore;
  annotationEditor?: boolean | "inline" | "modal";
  annotationRules?: AnnotationRules;
  onAnnotationsCommit?: CommitHandler;
  onSelectionChange?: (selection: Selection) => void;
  onAnnotationSelect?: (id: string | null) => void;
  renderRegionLabel?: (region: Region) => ReactNode;
};
export type WaveformProps = CommonProps &
  (
    | { source?: Source | null; player?: never }
    | { player: Player; source?: never }
  );

/** Owned players are allocated after commit; supplying player opts into borrowed ownership. */
export const Waveform = forwardRef<Player | null, WaveformProps>(
  function Waveform(
    {
      source,
      player: borrowed,
      appearance,
      theme,
      viewport,
      interaction,
      themeVersion,
      onError,
      onPlayer,
      onView,
      snapAnnotation,
      onDraw,
      annotations,
      annotationsRevision,
      defaultAnnotations,
      annotationStore,
      annotationEditor,
      annotationRules,
      onAnnotationsCommit,
      onSelectionChange,
      onAnnotationSelect,
      renderRegionLabel,
      ...html
    },
    ref,
  ) {
    if (
      [annotations, defaultAnnotations, annotationStore].filter(
        (value) => value !== undefined,
      ).length > 1
    )
      throw new Error(
        "Choose controlled annotations, defaultAnnotations, or annotationStore",
      );
    if (
      annotations &&
      (annotationsRevision === undefined || !onAnnotationsCommit)
    )
      throw new Error(
        "Controlled annotations require revision and onAnnotationsCommit",
      );
    const container = useRef<HTMLDivElement>(null);
    const view = useRef<WaveformView | null>(null);
    const callbacks = useRef({
      onPlayer,
      onView,
      onDraw,
      onAnnotationsCommit,
      onSelectionChange,
      onAnnotationSelect,
    });
    useEffect(() => {
      callbacks.current = {
        onPlayer,
        onView,
        onDraw,
        onAnnotationsCommit,
        onSelectionChange,
        onAnnotationSelect,
      };
    });
    const context = useContext(PlayerContext);
    const contextual = borrowed === undefined && source === undefined && context !== null;
    const report = useErrorReporter(onError ?? (contextual ? context.reportError : undefined));
    const player = usePlayer(
      contextual
        ? { player: context.player, onError: report }
        : borrowed
          ? { player: borrowed, onError: report }
          : { source, onError: report },
    );
    const [localAnnotations, setLocalAnnotations] =
      useState<AnnotationStore | null>(null);
    const initialAnnotations = useRef(defaultAnnotations);
    useEffect(() => {
      if (!initialAnnotations.current || annotations || annotationStore) return;
      const store = createAnnotations({
        document: initialAnnotations.current,
        rules: annotationRules,
      });
      const off = store.onCommit((document, change) =>
        callbacks.current.onAnnotationsCommit?.(document, change),
      );
      setLocalAnnotations(store);
      return () => {
        view.current?.update({ annotations: null });
        off();
        store.dispose();
      };
    }, [Boolean(annotations), annotationStore]);
    const [slots, setSlots] = useState<
      Array<{ key: number; element: HTMLElement; region: Region }>
    >([]);
    const slotKey = useRef(0);
    const customLabels = Boolean(renderRegionLabel);
    const labelRenderer = useMemo(
      () =>
        customLabels
          ? (region: Region) => {
              const element = document.createElement("span"),
                key = ++slotKey.current;
              setSlots((current) => [...current, { key, element, region }]);
              return {
                element,
                dispose: () =>
                  setSlots((current) =>
                    current.filter((slot) => slot.key !== key),
                  ),
              };
            }
          : undefined,
      [customLabels],
    );
    // Like a DOM ref, this is null until the committed owned player exists.
    useImperativeHandle(ref, () => player!, [player]);
    useEffect(() => {
      if (
        !player ||
        player.getSnapshot().source === "disposed" ||
        !container.current
      )
        return;
      const mounted = mountWaveform(container.current, {
        player,
        onDraw: () => callbacks.current.onDraw?.(),
      });
      view.current = mounted;
      callbacks.current.onView?.(mounted);
      callbacks.current.onPlayer?.(player);
      return () => {
        callbacks.current.onView?.(null);
        mounted.dispose();
        if (view.current === mounted) view.current = null;
        callbacks.current.onPlayer?.(null);
      };
    }, [player]);

    useEffect(() => {
      view.current?.update({ viewport: { zoom: viewport?.zoom } });
    }, [player, viewport?.zoom]);
    useEffect(() => {
      view.current?.update({
        theme,
        appearance: {
          style: appearance?.style,
          height: appearance?.height,
          barWidth: appearance?.barWidth,
          barGap: appearance?.barGap,
          normalize: appearance?.normalize,
          splitChannels: appearance?.splitChannels,
          lineWidth: appearance?.lineWidth,
          barRadius: appearance?.barRadius,
          amplitude: appearance?.amplitude,
          cursorWidth: appearance?.cursorWidth,
          borderRadius: appearance?.borderRadius,
        },
        viewport: { follow: viewport?.follow },
        interaction: { seek: interaction?.seek, drag: interaction?.drag },
        label: html["aria-label"] ?? "Audio waveform",
      });
    }, [
      player,
      theme,
      appearance?.style,
      appearance?.height,
      appearance?.barWidth,
      appearance?.barGap,
      appearance?.normalize,
      appearance?.splitChannels,
      appearance?.lineWidth,
      appearance?.barRadius,
      appearance?.amplitude,
      appearance?.cursorWidth,
      appearance?.borderRadius,
      viewport?.follow,
      interaction?.seek,
      interaction?.drag,
      html["aria-label"],
    ]);
    useEffect(() => {
      if (!view.current) return;
      view.current.update({
        annotations: annotations
          ? {
              value: annotations,
              revision: annotationsRevision!,
              onCommit: (document, change) => {
                const commit = () =>
                  callbacks.current.onAnnotationsCommit?.(document, change);
                // Native input handlers redraw immediately after proposing an edit.
                // Publish accepted React props first so that redraw cannot flash
                // the previous bounds. This runs once per edit, never per move.
                if (change.origin === "pointer" || change.origin === "keyboard")
                  flushSync(commit);
                else commit();
              },
            }
          : (annotationStore ?? localAnnotations),
        annotationEditor,
        annotationRules,
        snapAnnotation,
        renderRegionLabel: labelRenderer,
        onSelectionChange: (selection) =>
          callbacks.current.onSelectionChange?.(selection),
        onAnnotationSelect: (id) => callbacks.current.onAnnotationSelect?.(id),
        onAnnotationError: report,
      });
    }, [
      player,
      annotations,
      annotationsRevision,
      annotationStore,
      annotationEditor,
      localAnnotations,
      annotationRules?.minLength,
      annotationRules?.maxLength,
      annotationRules?.snap,
      snapAnnotation,
      labelRenderer,
      report,
    ]);
    useEffect(() => {
      view.current?.refreshTheme();
    }, [player, themeVersion]);
    return (
      <>
        <div {...html} ref={container} />
        {slots.map((slot) =>
          createPortal(
            renderRegionLabel?.(slot.region),
            slot.element,
            String(slot.key),
          ),
        )}
      </>
    );
  },
);
