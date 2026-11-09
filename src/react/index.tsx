import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { createAnnotations, type AnnotationDocument, type AnnotationStore, type AnnotationRules, type CommitHandler, type Region, type Selection } from "../regions";
import { createPlayer } from "../player";
import {
  mountWaveform,
  type Appearance,
  type AnnotationSnapper,
  type Interaction,
  type Viewport,
  type WaveformView,
  type WaveformTheme,
} from "../dom";
import type { Player, PlayerSnapshot, RavlError, Source } from "../core/types";

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

type CommonProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onError" | "children"
> & {
  theme?: WaveformTheme | null;
  appearance?: Appearance;
  viewport?: Viewport;
  interaction?: Interaction;
  themeVersion?: string | number;
  onError?: (error: RavlError) => void;
  onPlayer?: (player: Player | null) => void;
  onView?: (view: WaveformView | null) => void;
  snapAnnotation?: AnnotationSnapper;
  onDraw?: () => void;
  annotations?: AnnotationDocument;
  annotationsRevision?: number;
  defaultAnnotations?: AnnotationDocument;
  annotationStore?: AnnotationStore;
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
      onView, snapAnnotation,
      onDraw,
      annotations, annotationsRevision, defaultAnnotations, annotationStore,
      annotationRules, onAnnotationsCommit, onSelectionChange, onAnnotationSelect,
      renderRegionLabel,
      ...html
    },
    ref,
  ) {
    if ([annotations, defaultAnnotations, annotationStore].filter(value => value !== undefined).length > 1) throw new Error("Choose controlled annotations, defaultAnnotations, or annotationStore");
    if (annotations && (annotationsRevision === undefined || !onAnnotationsCommit)) throw new Error("Controlled annotations require revision and onAnnotationsCommit");
    const container = useRef<HTMLDivElement>(null);
    const view = useRef<WaveformView | null>(null);
    const [owned, setOwned] = useState<Player | null>(null);
    const callbacks = useRef({ onError, onPlayer, onView, onDraw, onAnnotationsCommit, onSelectionChange, onAnnotationSelect });
    useEffect(() => {
      callbacks.current = { onError, onPlayer, onView, onDraw, onAnnotationsCommit, onSelectionChange, onAnnotationSelect };
    });
    const seen = useRef(new WeakSet<Error>());
    const report = useCallback((error: RavlError) => {
      if (error.code === "CANCELLED" || seen.current.has(error)) return;
      seen.current.add(error);
      callbacks.current.onError?.(error);
    }, []);
    const [localAnnotations, setLocalAnnotations] = useState<AnnotationStore | null>(null);
    const initialAnnotations = useRef(defaultAnnotations);
    useEffect(() => {
      if (!initialAnnotations.current || annotations || annotationStore) return;
      const store = createAnnotations({ document: initialAnnotations.current, rules: annotationRules });
      const off = store.onCommit((document, change) => callbacks.current.onAnnotationsCommit?.(document, change));
      setLocalAnnotations(store);
      return () => { view.current?.update({ annotations: null }); off(); store.dispose(); };
    }, [Boolean(annotations), annotationStore]);
    const [slots, setSlots] = useState<Array<{ key: number; element: HTMLElement; region: Region }>>([]);
    const slotKey = useRef(0);
    const customLabels = Boolean(renderRegionLabel);
    const labelRenderer = useMemo(() => customLabels ? (region: Region) => {
      const element = document.createElement("span"), key = ++slotKey.current;
      setSlots(current => [...current, { key, element, region }]);
      return { element, dispose: () => setSlots(current => current.filter(slot => slot.key !== key)) };
    } : undefined, [customLabels]);
    const player = borrowed ?? owned;
    // Like a DOM ref, this is null until the committed owned player exists.
    useImperativeHandle(ref, () => player!, [player]);
    useEffect(() => {
      if (borrowed) return;
      const instance = createPlayer();
      setOwned(instance);
      return () => instance.dispose();
    }, [borrowed]);
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
      const off = player.subscribe(() => {
        const state = player.getSnapshot();
        if (state.error) report(state.error);
        if (state.waveformError) report(state.waveformError);
      });
      return () => {
        off();
        callbacks.current.onView?.(null);
        mounted.dispose();
        if (view.current === mounted) view.current = null;
        callbacks.current.onPlayer?.(null);
      };
    }, [player, report]);

    // Compare scalar descriptor fields and large immutable inputs by identity.
    // An inline { kind: 'url', id, url } does not recreate the controller/load.
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
      if (borrowed || !player || player.getSnapshot().source === "disposed")
        return;
      if (!descriptor) {
        player.clearSource();
        return;
      }
      const abort = new AbortController();
      void player.setSource(descriptor, { signal: abort.signal }).catch(report);
      return () => abort.abort();
    }, [player, borrowed, descriptor, report]);
    useEffect(() => {
      view.current?.update({
        theme,
        appearance: {
          style: appearance?.style,
          height: appearance?.height,
          barWidth: appearance?.barWidth,
          barGap: appearance?.barGap,
          normalize: appearance?.normalize,
          lineWidth: appearance?.lineWidth,
          barRadius: appearance?.barRadius,
          amplitude: appearance?.amplitude,
          cursorWidth: appearance?.cursorWidth,
          borderRadius: appearance?.borderRadius,
        },
        viewport: { zoom: viewport?.zoom, follow: viewport?.follow },
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
      appearance?.lineWidth,
      appearance?.barRadius,
      appearance?.amplitude,
      appearance?.cursorWidth,
      appearance?.borderRadius,
      viewport?.zoom,
      viewport?.follow,
      interaction?.seek,
      interaction?.drag,
      html["aria-label"],
    ]);
    useEffect(() => {
      if (!view.current) return;
      view.current.update({
        annotations: annotations ? { value: annotations, revision: annotationsRevision!, onCommit: (document, change) => callbacks.current.onAnnotationsCommit?.(document, change) } : annotationStore ?? localAnnotations,
        annotationRules,
        snapAnnotation,
        renderRegionLabel: labelRenderer,
        onSelectionChange: selection => callbacks.current.onSelectionChange?.(selection),
        onAnnotationSelect: id => callbacks.current.onAnnotationSelect?.(id),
        onAnnotationError: report,
      });
    }, [player, annotations, annotationsRevision, annotationStore, localAnnotations, annotationRules?.minLength, annotationRules?.maxLength, annotationRules?.snap, snapAnnotation, labelRenderer, report]);
    useEffect(() => {
      view.current?.refreshTheme();
    }, [player, themeVersion]);
    return <><div {...html} ref={container} />{slots.map(slot => createPortal(renderRegionLabel?.(slot.region), slot.element, String(slot.key)))}</>;
  },
);

export function useAnnotations(store: AnnotationStore | null) {
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? (() => null), () => null);
}
