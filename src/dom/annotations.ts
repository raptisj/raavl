import { failure } from "../core/data.js";
import {
  createAnnotations,
  snapTime,
  validateRules,
  type AnnotationStore,
  type AnnotationDocument,
  type ControlledAnnotations,
  type AnnotationRules,
  type Region,
  type Marker,
  type Selection,
} from "../regions/index.js";
import type { RaavlError } from "../core/types.js";
import { createAnnotationEditor } from "./annotation-editor.js";
import { annotationTime, createAnnotationPicker } from "./annotation-picker.js";
import { includesOverlapRegion, visibleOverlaps } from "./annotation-overlaps.js";

export type LabelSlot = HTMLElement | { element: HTMLElement; dispose(): void };
export type AnnotationSnapper = (
  time: number,
  context: {
    document: AnnotationDocument;
    excludeId?: string;
    duration: number;
    pixelsPerSecond: number;
  },
) => number;
export type AnnotationViewOptions = {
  snapAnnotation?: AnnotationSnapper;
  annotations?: AnnotationStore | ControlledAnnotations | null;
  /** Enable creation/editing inline (true) or in a modal dialog. */
  annotationEditor?: boolean | "inline" | "modal";
  annotationRules?: AnnotationRules;
  renderRegionLabel?: (region: Region) => LabelSlot;
  onSelectionChange?: (selection: Selection) => void;
  onAnnotationSelect?: (id: string | null) => void;
  onAnnotationError?: (error: RaavlError) => void;
};
export type AnnotationGeometry = {
  sourceId: string | null;
  duration: number;
  width: number;
  channels: number;
  splitChannels: boolean;
  selectMode: boolean;
};
type Gesture = {
  pointer: number;
  startX: number;
  anchor: number;
  id?: string;
  side?: "start" | "end";
  item?: Region | Marker;
  initialSelection?: NonNullable<Selection>;
  next?: Region | Marker;
  revision: number;
  moved: boolean;
};

function createResizeHandle(
  document: Document,
  side: NonNullable<Gesture["side"]>,
  label: string,
  className = "raavl-region-handle",
) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = `${className} ${className}-${side}`;
  handle.dataset.side = side;
  handle.setAttribute(
    "aria-label",
    `Resize ${side} of ${label}. Arrow keys adjust boundary.`,
  );
  Object.assign(handle.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    [side === "start" ? "left" : "right"]: "0",
    width: "8px",
    padding: "0",
    border: "0",
    background: "var(--raavl-handle-color, #8055ba88)",
    cursor: "ew-resize",
    touchAction: "none",
  });
  return handle;
}

function createAnnotationNode(
  document: Document,
  item: Region | Marker,
  selected: boolean,
  renderer: AnnotationViewOptions["renderRegionLabel"],
) {
  const element = document.createElement("div");
  element.className = "start" in item ? "raavl-region" : "raavl-marker";
  element.dataset.raavlAnnotation = item.id;
  element.dataset.selected = String(selected);
  Object.assign(element.style, {
    position: "absolute",
    pointerEvents: "auto",
    zIndex: selected && "start" in item ? "1" : "",
    background:
      "start" in item
        ? "var(--raavl-region-color, #a67ce333)"
        : "repeating-linear-gradient(to bottom, var(--raavl-marker-color, #b65d29) 0 6px, transparent 6px 10px)",
  });
  const body = document.createElement("button");
  body.type = "button";
  body.className = "raavl-region-body";
  body.dataset.raavlAnnotation = item.id;
  Object.assign(body.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    minWidth: "10px",
    padding: "0",
    border: "0",
    background: "transparent",
  });
  body.setAttribute(
    "aria-label",
    `${item.label || item.id}${item.locked ? ", locked" : ""}. ${"start" in item ? `${item.start.toFixed(2)} to ${item.end.toFixed(2)}` : item.time.toFixed(2)} seconds. Arrow keys move; Delete removes.`,
  );
  const label = document.createElement("span");
  label.className = "raavl-region-label";
  label.style.pointerEvents = "none";
  let cleanup: (() => void) | undefined;
  if ("start" in item && renderer) {
    const result = renderer(item);
    label.append(result instanceof HTMLElement ? result : result.element);
    if (!(result instanceof HTMLElement)) cleanup = result.dispose;
  } else label.textContent = item.label || item.id;
  body.append(label);
  element.append(body);
  if ("start" in item)
    for (const side of ["start", "end"] as const) {
      const handle = createResizeHandle(document, side, item.label || item.id);
      handle.dataset.raavlAnnotation = item.id;
      handle.disabled = !!item.locked;
      if (item.locked) handle.style.touchAction = "auto";
      element.append(handle);
    }
  return { element, cleanup };
}

export function mountAnnotations(
  container: HTMLElement,
  root: HTMLElement,
  surface: HTMLElement,
  geometry: () => AnnotationGeometry,
  playSelection?: (range: NonNullable<Selection>) => void,
) {
  const gestureDocument = root.ownerDocument;
  const gestureWindow = gestureDocument.defaultView;
  let options: AnnotationViewOptions = {},
    store: AnnotationStore | null = null,
    owned = false;
  let unsubscribe: (() => void) | undefined,
    disposed = false,
    gesture: Gesture | null = null;
  let playbackBlocked = false;
  let clickedRegionId: string | undefined;
  let selection: Selection = null,
    selected: string | null = null,
    lastSource: string | null = null;
  let rules = validateRules(),
    rendering = false;
  const overlay = document.createElement("div");
  overlay.className = "raavl-annotations";
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
  });
  const shapes = document.createElement("div");
  shapes.style.isolation = "isolate";
  const overlapControls = document.createElement("div");
  const overlapButtons = new Map<string, HTMLButtonElement>();
  const preview = document.createElement("div");
  preview.className = "raavl-selection";
  preview.hidden = true;
  Object.assign(preview.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    zIndex: "3",
    background: "var(--raavl-selection-color, #538ce644)",
    border: "1px dashed currentColor",
  });
  const previewHandles = (["start", "end"] as const).map((side) => {
    const handle = createResizeHandle(
      gestureDocument,
      side,
      "temporary region",
      "raavl-selection-handle",
    );
    handle.style.pointerEvents = "auto";
    return handle;
  });
  preview.append(...previewHandles);
  overlay.append(overlapControls, shapes, preview);
  surface.append(overlay);
  const list = document.createElement("section");
  list.className = "raavl-annotation-list";
  list.setAttribute("aria-label", "Annotations");
  const status = document.createElement("p");
  status.className = "raavl-annotation-status";
  status.setAttribute("role", "status");
  const picker = createAnnotationPicker(gestureDocument, chooseAnnotation);
  let editor: ReturnType<typeof createAnnotationEditor> | undefined;
  let listSnapshot: ReturnType<AnnotationStore["getSnapshot"]> | null = null;
  let listChannels = -1,
    listSource: string | null = null;
  list.append(status, picker.element);
  container.append(list);
  list.hidden = true;
  const nodes = new Map<
    string,
    {
      element: HTMLElement;
      item: Region | Marker;
      displayItem: Region | Marker;
      cleanup?: () => void;
      renderer?: AnnotationViewOptions["renderRegionLabel"];
    }
  >();
  const report = (error: unknown) => {
    const err = error as RaavlError;
    status.textContent = err.message;
    options.onAnnotationError?.(err);
  };
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      report(error);
    }
  };
  const matches = () =>
    !!store && store.getSnapshot().document.sourceId === geometry().sourceId;
  const active = () => matches() && geometry().duration > 0;
  const annotationTarget = (target: EventTarget | null) =>
    target instanceof Element
      ? target.closest<HTMLElement>("[data-raavl-annotation]")
      : null;
  const isPreviewTarget = (target: EventTarget | null): target is HTMLElement =>
    target instanceof HTMLElement && preview.contains(target);
  const isOverlapTarget = (target: EventTarget | null) =>
    target instanceof Element && overlapControls.contains(target);
  const getPlaybackTarget = (
    target: EventTarget | null,
    afterPointerUp = false,
  ): Region | null | undefined => {
    // Null is waveform background. Undefined is a consumed gesture or control.
    if (
      isPreviewTarget(target) ||
      isOverlapTarget(target) ||
      (afterPointerUp && playbackBlocked)
    )
      return undefined;
    const control = annotationTarget(target);
    if (
      control &&
      !control.matches(".raavl-region, .raavl-region > .raavl-region-body")
    )
      return undefined;
    const id =
      control?.dataset.raavlAnnotation ??
      (afterPointerUp && target === root ? clickedRegionId : undefined);
    if (id === undefined) return null;
    const item = nodes.get(id)?.item;
    return item && "start" in item ? item : undefined;
  };
  const timeAt = (x: number) =>
    Math.max(
      0,
      Math.min(
        geometry().duration,
        ((x - root.getBoundingClientRect().left + root.scrollLeft) /
          geometry().width) *
          geometry().duration,
      ),
    );
  const snap = (time: number) => {
    let value = snapTime(time, rules.snap);
    if (gesture && options.snapAnnotation && store) {
      value = options.snapAnnotation(time, {
        document: store.getSnapshot().document,
        excludeId: gesture.id,
        duration: geometry().duration,
        pixelsPerSecond: geometry().width / geometry().duration,
      });
      if (!Number.isFinite(value)) value = time;
    }
    return Math.max(0, Math.min(geometry().duration, value));
  };
  const select = (id: string | null) => {
    selected = id;
    editor?.select(id);
    picker.select(id);
    for (const [key, node] of nodes) {
      const active = key === id;
      node.element.dataset.selected = String(active);
      if ("start" in node.item) node.element.style.zIndex = active ? "1" : "";
    }
    options.onAnnotationSelect?.(id);
  };
  function chooseAnnotation(item: Region | Marker) {
    select(item.id);
    if (active()) {
      const { width, duration } = geometry();
      root.scrollLeft = Math.max(
        0,
        Math.min(
          width - root.clientWidth,
          (annotationTime(item) / duration) * width - root.clientWidth / 3,
        ),
      );
      render();
      if (editor) {
        editor.open(item.id);
        return;
      }
      const body = nodes
        .get(item.id)
        ?.element.querySelector<HTMLElement>(".raavl-region-body");
      if (body) {
        body.focus({ preventScroll: true });
        return;
      }
    }
    if (!picker.focusBadge(item.id)) root.focus({ preventScroll: true });
  }
  const setSelection = (next: Selection, notify = true) => {
    const drafting = next !== null && active();
    if (drafting && selection === null) picker.close();
    selection = next;
    preview.hidden = !drafting;
    overlapControls.hidden = drafting;
    shapes.style.opacity = drafting ? "0.25" : "";
    shapes.toggleAttribute("inert", drafting);
    const draggable = drafting && geometry().selectMode;
    preview.style.pointerEvents = draggable ? "auto" : "none";
    preview.style.cursor = draggable ? "grab" : "";
    for (const handle of previewHandles) handle.disabled = !drafting;
    if (next) {
      preview.style.left = `${(next.start / geometry().duration) * 100}%`;
      preview.style.width = `${((next.end - next.start) / geometry().duration) * 100}%`;
    }
    if (notify) {
      editor?.sync(active() ? store : null, next);
      options.onSelectionChange?.(next);
    }
  };
  const cancel = () => {
    const previous = gesture;
    gesture = null;
    trackGesture(false);
    if (previous && root.hasPointerCapture?.(previous.pointer))
      root.releasePointerCapture(previous.pointer);
    if (previous && !previous.id)
      setSelection(previous.initialSelection ?? null);
  };
  const position = (element: HTMLElement, item: Region | Marker) => {
    const { duration, channels, splitChannels } = geometry();
    element.style.left =
      "start" in item
        ? `${(item.start / duration) * 100}%`
        : `clamp(0px, ${(item.time / duration) * 100}%, 100% - 2px)`;
    element.style.width =
      "start" in item
        ? `${((item.end - item.start) / duration) * 100}%`
        : "2px";
    const channel =
      splitChannels && "channel" in item ? item.channel : undefined;
    element.style.top =
      channel === undefined ? "0" : `${(channel / channels) * 100}%`;
    element.style.height =
      channel === undefined ? "100%" : `${100 / channels}%`;
  };
  function renderOverlaps(regions: Region[]) {
    const overlaps = visibleOverlaps(regions, geometry(), {
      left: root.scrollLeft,
      width: root.clientWidth,
      height: root.clientHeight,
    });
    const keys = new Set(overlaps.map((overlap) => overlap.key));
    for (const [key, button] of overlapButtons) {
      if (keys.has(key)) continue;
      overlapButtons.delete(key);
      if (gestureDocument.activeElement === button && !picker.focusBadge(selected))
        root.focus({ preventScroll: true });
      button.remove();
    }
    for (const { key, count, left, top, width, time, lane } of overlaps) {
      let button = overlapButtons.get(key);
      if (!button) {
        button = gestureDocument.createElement("button");
        button.type = "button";
        button.className = "raavl-region-overlap";
        Object.assign(button.style, {
          position: "absolute",
          pointerEvents: "auto",
          zIndex: "2",
        });
        picker.connect(button);
        overlapControls.append(button);
        overlapButtons.set(key, button);
      }
      const label = `${count} regions`;
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute(
        "aria-label",
        `${count} overlapping regions at ${time.toFixed(2)} seconds`,
      );
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
      button.style.width = `${width}px`;
      const trigger = button;
      button.onclick = () =>
        picker.open(trigger, (item) =>
          "start" in item && includesOverlapRegion(item, time, lane),
        );
    }
  }
  function render() {
    if (disposed || rendering) return;
    rendering = true;
    try {
      const { duration, sourceId, channels } = geometry();
      if (lastSource !== sourceId) {
        cancel();
        picker.close();
        clickedRegionId = undefined;
        setSelection(null);
        select(null);
        lastSource = sourceId;
      }
      if (!store) {
        editor?.sync(null, null);
        for (const node of nodes.values()) {
          node.cleanup?.();
          node.element.remove();
        }
        nodes.clear();
        picker.update([], new Set());
        renderOverlaps([]);
        listSnapshot = null;
        overlay.hidden = true;
        list.hidden = true;
        return;
      }
      if (
        store.getSnapshot().duration !==
        (matches() && duration > 0 ? duration : null)
      )
        store.setDuration(matches() && duration > 0 ? duration : null);
      const snapshot = store.getSnapshot();
      list.hidden = false;
      overlay.hidden = !active();
      status.textContent = !matches()
        ? "Annotations belong to another source."
        : !duration
          ? "Annotations pending audio duration."
          : "";
      const invalid = new Set(snapshot.invalidIds);
      for (const region of snapshot.document.regions)
        if (
          region.channel !== undefined &&
          channels > 0 &&
          region.channel >= channels
        )
          invalid.add(region.id);
      if (matches() && invalid.size)
        status.textContent = `${invalid.size} annotation(s) outside duration or channels; data retained for correction.`;
      const items = [
        ...snapshot.document.regions,
        ...snapshot.document.markers,
      ];
      const focus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const focusId = focus?.dataset.raavlAnnotation,
        focusSide = focus?.dataset.side;
      const from = (root.scrollLeft / geometry().width) * duration;
      const to =
        ((root.scrollLeft + root.clientWidth) / geometry().width) * duration;
      const visible =
        active() && geometry().width > 0
          ? items.filter((item) => {
              const displayItem = editor?.preview(item) ?? item;
              return (
                !invalid.has(item.id) &&
                (item.id === focusId ||
                  item.id === gesture?.id ||
                  ("start" in displayItem
                    ? displayItem.end >= from && displayItem.start <= to
                    : displayItem.time >= from && displayItem.time <= to))
              );
            })
          : [];
      const ids = new Set(visible.map((item) => item.id));
      for (const [id, node] of nodes)
        if (!ids.has(id)) {
          node.cleanup?.();
          node.element.remove();
          nodes.delete(id);
        }
      for (const committed of visible) {
        const item = editor?.preview(committed) ?? committed;
        let node = nodes.get(item.id);
        if (
          !node ||
          node.displayItem !== item ||
          node.renderer !== options.renderRegionLabel
        ) {
          node?.cleanup?.();
          node?.element.remove();
          const { element, cleanup } = createAnnotationNode(
            document,
            item,
            selected === item.id,
            options.renderRegionLabel,
          );
          shapes.append(element);
          node = {
            element,
            item: committed,
            displayItem: item,
            cleanup,
            renderer: options.renderRegionLabel,
          };
          nodes.set(item.id, node);
        }
        // Redraws and unrelated player updates must preserve the live gesture.
        position(
          node.element,
          gesture?.id === item.id && gesture.next ? gesture.next : item,
        );
      }
      if (focusId && !focus?.isConnected) {
        const element = nodes.get(focusId)?.element;
        const target = focusSide
          ? element?.querySelector<HTMLElement>(`[data-side="${focusSide}"]`)
          : element?.querySelector<HTMLElement>(".raavl-region-body");
        target?.focus({ preventScroll: true });
      }
      const listChanged =
        listSnapshot !== snapshot ||
        listChannels !== channels ||
        listSource !== sourceId;
      if (listChanged) {
        listSnapshot = snapshot;
        listChannels = channels;
        listSource = sourceId;
        picker.update(matches() ? items : [], invalid);
      }
      renderOverlaps(visible.filter((item): item is Region => "start" in item));
      if (editor) {
        editor.element.hidden = !matches();
        editor.sync(active() ? store : null, selection);
      }
      if (
        listChanged && selected !== null &&
        !items.some((item) => item.id === selected)
      )
        select(null);
      setSelection(selection, false);
    } finally {
      rendering = false;
    }
  }
  const click = (event: MouseEvent) => {
    const target = annotationTarget(event.target);
    if (target) event.stopPropagation();
    const id =
      target?.dataset.raavlAnnotation ??
      (event.target === root ? clickedRegionId : undefined);
    if (id === undefined) return;
    picker.close();
    if (target || selected !== id) select(id);
    if (event.button !== 0 || (event.detail > 0 && playbackBlocked)) return;
    if (target && !target.matches(".raavl-region, .raavl-region-body")) return;
    const item = nodes.get(id)?.item;
    if (item && "start" in item) editor?.open(id);
  };
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      (event.pointerType === "touch" && !event.isPrimary)
    )
      return;
    if (gesture && event.pointerId !== gesture.pointer) return;
    playbackBlocked = false;
    clickedRegionId = undefined;
    if (!active() || isOverlapTarget(event.target)) return;
    const target = annotationTarget(event.target);
    const draftTarget = isPreviewTarget(event.target) ? event.target : null;
    const side = (target ?? draftTarget)?.dataset.side as Gesture["side"];
    // Touch pans over the waveform and annotation bodies. Handles opt into editing.
    if (event.pointerType === "touch" && !side) return;
    const id = target?.dataset.raavlAnnotation;
    const item = id
      ? [
          ...store!.getSnapshot().document.regions,
          ...store!.getSnapshot().document.markers,
        ].find((item) => item.id === id)
      : undefined;
    if (id && (!item || item.locked)) return;
    if (!id && !geometry().selectMode && !(draftTarget && side)) return;
    event.preventDefault();
    event.stopPropagation();
    if (target)
      (target.matches("button")
        ? target
        : target.querySelector<HTMLElement>("button")
      )?.focus({ preventScroll: true });
    else if (draftTarget?.matches("button"))
      draftTarget.focus({ preventScroll: true });
    else root.focus({ preventScroll: true });
    cancel();
    const initialSelection = draftTarget ? selection : null;
    if (id) select(id);
    else {
      select(null);
      if (!initialSelection) setSelection(null);
    }
    gesture = {
      pointer: event.pointerId,
      startX: event.clientX,
      anchor: timeAt(event.clientX),
      id,
      item,
      initialSelection: initialSelection ?? undefined,
      side,
      revision: store!.getSnapshot().revision,
      moved: false,
    };
    // Capture can retarget the browser's click to the waveform, even for a drag.
    playbackBlocked = true;
    trackGesture(true);
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released. Document tracking still works.
    }
  };
  const resizeRange = (
    range: NonNullable<Selection>,
    time: number,
    duration: number,
    side: NonNullable<Gesture["side"]>,
  ) => {
    const min = Math.max(0.001, rules.minLength);
    if (side === "start") {
      const start = Math.max(
        0,
        range.end - rules.maxLength,
        Math.min(range.end - min, time),
      );
      return { start, end: range.end };
    }
    const end = Math.min(
      duration,
      range.start + rules.maxLength,
      Math.max(range.start + min, time),
    );
    return { start: range.start, end };
  };
  const adjustRange = (
    range: NonNullable<Selection>,
    delta: number,
    duration: number,
    side: Gesture["side"],
  ) => {
    if (side)
      return resizeRange(range, snap(range[side] + delta), duration, side);
    const length = range.end - range.start;
    const start = Math.max(
      0,
      Math.min(duration - length, snap(range.start + delta)),
    );
    return { start, end: start + length };
  };
  const move = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const g = gesture,
      now = timeAt(event.clientX),
      duration = geometry().duration;
    g.moved ||= Math.abs(event.clientX - g.startX) >= 3;
    if (!g.moved) return;
    if (g.initialSelection) {
      setSelection(
        adjustRange(g.initialSelection, now - g.anchor, duration, g.side),
      );
      return;
    }
    if (!g.item) {
      const start = Math.min(snap(g.anchor), now),
        end = Math.max(snap(g.anchor), now);
      setSelection(end > start ? { start, end } : null);
      return;
    }
    if ("start" in g.item) {
      g.next = {
        ...g.item,
        ...adjustRange(g.item, now - g.anchor, duration, g.side),
      };
    } else g.next = { ...g.item, time: snap(g.item.time + now - g.anchor) };
    const node = nodes.get(g.id!);
    if (node && g.next) position(node.element, g.next);
  };
  const up = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const g = gesture;
    // Fast gestures may release before the next pointermove is delivered.
    // Apply the final coordinates through the same threshold, bounds and snapping.
    move(event);
    if (gesture !== g) return;
    playbackBlocked =
      g.moved ||
      !!g.initialSelection ||
      !!g.side ||
      (!!g.item && !("start" in g.item));
    clickedRegionId = playbackBlocked ? undefined : g.id;
    gesture = null;
    trackGesture(false);
    if (root.hasPointerCapture(g.pointer))
      root.releasePointerCapture(g.pointer);
    if (
      g.next &&
      g.moved &&
      store &&
      g.revision === store.getSnapshot().revision
    )
      attempt(() => {
        if ("start" in g.next!)
          store!.updateRegion(
            g.id!,
            { start: g.next.start, end: g.next.end },
            "pointer",
          );
        else store!.updateMarker(g.id!, { time: g.next!.time }, "pointer");
      });
    render(); // Controlled rejection restores the committed geometry immediately.
  };
  const abort = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    cancel();
    render();
  };
  const lost = (event: PointerEvent) => {
    if (
      !gesture ||
      event.pointerId !== gesture.pointer ||
      event.target !== root ||
      root.hasPointerCapture(event.pointerId)
    )
      return;
    // Trackpads can release capture without delivering pointerup. No pressed
    // buttons means finish the edit at the release position, rather than revert it.
    // If still pressed, document tracking carries on until release or cancellation.
    if (event.buttons === 0) up(event);
  };
  const cancelGesture = () => {
    if (!gesture) return;
    cancel();
    render();
  };
  const visibility = () => {
    if (gestureDocument.hidden) cancelGesture();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") cancelGesture();
  };
  function trackGesture(listen: boolean) {
    // Capture-phase tracking survives capture loss, releases outside the waveform,
    // and propagation stopped by controls. Only an active gesture owns listeners.
    if (listen) {
      gestureDocument.addEventListener("pointermove", move, true);
      gestureDocument.addEventListener("pointerup", up, true);
      gestureDocument.addEventListener("pointercancel", abort, true);
      gestureDocument.addEventListener("keydown", escape, true);
      gestureDocument.addEventListener("visibilitychange", visibility);
      gestureWindow?.addEventListener("blur", cancelGesture);
    } else {
      gestureDocument.removeEventListener("pointermove", move, true);
      gestureDocument.removeEventListener("pointerup", up, true);
      gestureDocument.removeEventListener("pointercancel", abort, true);
      gestureDocument.removeEventListener("keydown", escape, true);
      gestureDocument.removeEventListener("visibilitychange", visibility);
      gestureWindow?.removeEventListener("blur", cancelGesture);
    }
  }
  const key = (event: KeyboardEvent) => {
    const draftTarget = isPreviewTarget(event.target) ? event.target : null;
    if (event.key === "Escape") {
      if (picker.isOpen()) {
        picker.close(true);
        return;
      }
      cancel();
      setSelection(null);
      if (draftTarget) root.focus({ preventScroll: true });
      render();
      return;
    }
    const target = annotationTarget(event.target);
    if ((!target && !draftTarget) || !active()) return;
    const arrow = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const remove = event.key === "Delete" || event.key === "Backspace";
    if (!arrow && !remove) return;
    event.preventDefault();
    event.stopPropagation();
    const delta =
      (event.key === "ArrowLeft" ? -1 : 1) *
      (rules.snap || (event.shiftKey ? 1 : 0.1)) *
      (rules.snap && event.shiftKey ? 10 : 1);
    if (draftTarget) {
      if (selection && arrow)
        setSelection(
          adjustRange(
            selection,
            delta,
            geometry().duration,
            draftTarget.dataset.side as Gesture["side"],
          ),
        );
      return;
    }
    if (!target) return;
    const id = target.dataset.raavlAnnotation!,
      item = [
        ...store!.getSnapshot().document.regions,
        ...store!.getSnapshot().document.markers,
      ].find((item) => item.id === id);
    if (!item || item.locked) return;
    attempt(() => {
      if (remove) {
        store!.remove(id, "keyboard");
        select(null);
        root.focus();
        return;
      }
      if ("start" in item) {
        const side = target.dataset.side as Gesture["side"];
        const adjusted = adjustRange(item, delta, geometry().duration, side);
        const patch =
          side === "start"
            ? { start: adjusted.start }
            : side === "end"
              ? { end: adjusted.end }
              : adjusted;
        store!.updateRegion(id, patch, "keyboard");
      } else
        store!.updateMarker(id, { time: snap(item.time + delta) }, "keyboard");
    });
    render();
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("lostpointercapture", lost);
  root.addEventListener("click", click);
  root.addEventListener("keydown", key);
  return {
    update(next: AnnotationViewOptions) {
      const nextRules = validateRules(next.annotationRules);
      const config = next.annotations ?? null;
      const controlledConfig = config && "value" in config ? config : null;
      if (config !== options.annotations) {
        if (controlledConfig && owned && store)
          store.setControlled(controlledConfig);
        else {
          cancel();
          unsubscribe?.();
          if (owned) store?.dispose();
          store = controlledConfig
            ? createAnnotations(controlledConfig)
            : (config as AnnotationStore | null);
          owned = !!controlledConfig;
          unsubscribe = store?.subscribe(() => {
            cancel();
            render();
          });
        }
      }
      options = next;
      rules = nextRules;
      if (next.annotationEditor && !editor) {
        editor = createAnnotationEditor(
          picker.strip,
          (id) => {
            if (!picker.focusBadge(id)) root.focus({ preventScroll: true });
          },
          () => {
            setSelection(null);
            root.focus({ preventScroll: true });
          },
          playSelection,
          (side, time) => {
            if (selection && active())
              setSelection(
                resizeRange(selection, time, geometry().duration, side),
              );
          },
          (range, time, side) =>
            resizeRange(range, time, geometry().duration, side),
          render,
          (editing) => overlay.toggleAttribute("data-editing-region", editing),
          () => !gesture,
        );
        list.append(editor.element);
      } else if (!next.annotationEditor && editor) {
        editor.close();
        editor.dispose();
        editor = undefined;
      }
      editor?.setMode(next.annotationEditor === "modal" ? "modal" : "inline");
      render();
    },
    sync: render,
    cancelGesture,
    getSelection: () => selection,
    clearSelection: () => setSelection(null),
    createRegionAtTime(time: number) {
      if (!store || !active())
        throw failure(
          "NOT_READY",
          "view",
          "Load matching audio before creating a region",
        );
      const duration = geometry().duration;
      if (!Number.isFinite(time) || time < 0 || time >= duration)
        throw failure(
          "INVALID_DATA",
          "view",
          "Place the playhead before the end of the recording",
        );
      const length = Math.min(Math.max(1, rules.minLength), rules.maxLength);
      const end = Math.min(duration, time + length);
      select(null);
      setSelection({ start: time, end });
      editor?.focusCreation();
    },
    createRegionFromSelection(id: string, label?: string) {
      if (!selection || !store || !active())
        throw failure("NOT_READY", "view", "Select an audio range first");
      store.addRegion({ id, ...selection, label });
      setSelection(null);
    },
    isEditing: () => gesture !== null,
    isAnnotationTarget: (target: EventTarget | null) =>
      isPreviewTarget(target) ||
      isOverlapTarget(target) ||
      !!annotationTarget(target),
    getPlaybackTarget,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      unsubscribe?.();
      if (owned) store?.dispose();
      nodes.forEach((node) => node.cleanup?.());
      nodes.clear();
      overlay.remove();
      editor?.dispose();
      picker.dispose();
      list.remove();
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("lostpointercapture", lost);
      root.removeEventListener("click", click);
      root.removeEventListener("keydown", key);
    },
  };
}
