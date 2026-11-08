import { failure } from "../core/data";
import {
  createAnnotations,
  snapTime,
  validateRules,
  type AnnotationStore,
  type ControlledAnnotations,
  type AnnotationRules,
  type Region,
  type Marker,
  type Selection,
} from "../regions";
import type { RavlError } from "../core/types";

export type LabelSlot = HTMLElement | { element: HTMLElement; dispose(): void };
export type AnnotationViewOptions = {
  annotations?: AnnotationStore | ControlledAnnotations | null;
  annotationRules?: AnnotationRules;
  renderRegionLabel?: (region: Region) => LabelSlot;
  onSelectionChange?: (selection: Selection) => void;
  onAnnotationSelect?: (id: string | null) => void;
  onAnnotationError?: (error: RavlError) => void;
};
export type AnnotationGeometry = {
  sourceId: string | null;
  duration: number;
  width: number;
  channels: number;
  selectMode: boolean;
};
type Gesture = {
  pointer: number;
  startX: number;
  anchor: number;
  id?: string;
  side?: "start" | "end";
  item?: Region | Marker;
  next?: Region | Marker;
  revision: number;
  moved: boolean;
};

export function mountAnnotations(
  container: HTMLElement,
  root: HTMLElement,
  surface: HTMLElement,
  geometry: () => AnnotationGeometry,
) {
  let options: AnnotationViewOptions = {},
    store: AnnotationStore | null = null,
    owned = false;
  let unsubscribe: (() => void) | undefined,
    disposed = false,
    gesture: Gesture | null = null;
  let selection: Selection = null,
    selected: string | null = null,
    lastSource: string | null = null;
  let rules = validateRules(),
    rendering = false;
  const overlay = document.createElement("div");
  overlay.className = "ravl-annotations";
  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
  });
  const preview = document.createElement("div");
  preview.className = "ravl-selection";
  preview.hidden = true;
  Object.assign(preview.style, {
    position: "absolute",
    top: "0",
    bottom: "0",
    pointerEvents: "none",
    background: "var(--ravl-selection-color, #538ce644)",
    border: "1px dashed currentColor",
  });
  overlay.append(preview);
  surface.append(overlay);
  const list = document.createElement("section");
  list.className = "ravl-annotation-list";
  list.setAttribute("aria-label", "Annotations");
  const status = document.createElement("p");
  status.className = "ravl-annotation-status";
  status.setAttribute("role", "status");
  const rows = document.createElement("ul");
  const pagination = document.createElement("div");
  pagination.className = "ravl-annotation-pagination";
  const previous = document.createElement("button"), next = document.createElement("button"), pageLabel = document.createElement("span");
  previous.type = next.type = "button";
  previous.textContent = "Previous annotations";
  next.textContent = "Next annotations";
  pageLabel.setAttribute("role", "status");
  let page = 0;
  const pageSize = 100;
  previous.onclick = () => { page--; render(); };
  next.onclick = () => { page++; render(); };
  pagination.append(previous, pageLabel, next);
  list.append(status, rows, pagination);
  container.append(list);
  list.hidden = true;
  const nodes = new Map<
    string,
    {
      element: HTMLElement;
      item: Region | Marker;
      cleanup?: () => void;
      renderer?: AnnotationViewOptions["renderRegionLabel"];
    }
  >();
  const report = (error: unknown) => {
    const err = error as RavlError;
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
      ? target.closest<HTMLElement>("[data-ravl-annotation]")
      : null;
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
  const snap = (time: number) =>
    Math.max(0, Math.min(geometry().duration, snapTime(time, rules.snap)));
  const select = (id: string | null) => {
    selected = id;
    for (const [key, node] of nodes)
      node.element.dataset.selected = String(key === id);
    options.onAnnotationSelect?.(id);
  };
  const setSelection = (next: Selection, notify = true) => {
    selection = next;
    preview.hidden = !next || !active();
    if (next) {
      preview.style.left = `${(next.start / geometry().duration) * 100}%`;
      preview.style.width = `${((next.end - next.start) / geometry().duration) * 100}%`;
    }
    if (notify) options.onSelectionChange?.(next);
  };
  const cancel = () => {
    const previous = gesture;
    gesture = null;
    if (previous && root.hasPointerCapture?.(previous.pointer))
      root.releasePointerCapture(previous.pointer);
    if (previous && !previous.id) setSelection(null);
  };
  const position = (element: HTMLElement, item: Region | Marker) => {
    const { duration, channels } = geometry();
    element.style.left = `${(("start" in item ? item.start : item.time) / duration) * 100}%`;
    element.style.width =
      "start" in item
        ? `${((item.end - item.start) / duration) * 100}%`
        : "2px";
    const channel = "channel" in item ? item.channel : undefined;
    element.style.top =
      channel === undefined ? "0" : `${(channel / channels) * 100}%`;
    element.style.height =
      channel === undefined ? "100%" : `${100 / channels}%`;
  };
  function render() {
    if (disposed || rendering) return;
    rendering = true;
    try {
      const { duration, sourceId, channels } = geometry();
      if (lastSource !== sourceId) {
        cancel();
        setSelection(null);
        select(null);
        lastSource = sourceId;
      }
      if (!store) {
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
      const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusId = focus?.dataset.ravlAnnotation, focusSide = focus?.dataset.side;
      const from = root.scrollLeft / geometry().width * duration;
      const to = (root.scrollLeft + root.clientWidth) / geometry().width * duration;
      const visible = active() && geometry().width > 0 ? items.filter((item) => !invalid.has(item.id) && (
        item.id === focusId || item.id === gesture?.id ||
        ("start" in item ? item.end >= from && item.start <= to : item.time >= from && item.time <= to)
      )) : [];
      const ids = new Set(visible.map((item) => item.id));
      for (const [id, node] of nodes)
        if (!ids.has(id)) {
          node.cleanup?.();
          node.element.remove();
          nodes.delete(id);
        }
      for (const item of visible) {
        let node = nodes.get(item.id);
        if (
          !node ||
          node.item !== item ||
          node.renderer !== options.renderRegionLabel
        ) {
          node?.cleanup?.();
          node?.element.remove();
          const element = document.createElement("div");
          element.className = "start" in item ? "ravl-region" : "ravl-marker";
          element.dataset.ravlAnnotation = item.id;
          element.dataset.selected = String(selected === item.id);
          Object.assign(element.style, {
            position: "absolute",
            pointerEvents: "auto",
            background:
              "start" in item
                ? "var(--ravl-region-color, #a67ce333)"
                : "var(--ravl-marker-color, #b65d29)",
          });
          const body = document.createElement("button");
          body.type = "button";
          body.className = "ravl-region-body";
          body.dataset.ravlAnnotation = item.id;
          Object.assign(body.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            minWidth: "10px",
            padding: "0",
            border: "0",
            background: "transparent",
            touchAction: "none",
          });
          body.setAttribute(
            "aria-label",
            `${item.label || item.id}${item.locked ? ", locked" : ""}. ${"start" in item ? `${item.start.toFixed(2)} to ${item.end.toFixed(2)}` : item.time.toFixed(2)} seconds. Arrow keys move; Delete removes.`,
          );
          const label = document.createElement("span");
          label.className = "ravl-region-label";
          label.style.pointerEvents = "none";
          let cleanup: (() => void) | undefined;
          if ("start" in item && options.renderRegionLabel) {
            const result = options.renderRegionLabel(item);
            label.append(
              result instanceof HTMLElement ? result : result.element,
            );
            if (!(result instanceof HTMLElement)) cleanup = result.dispose;
          } else label.textContent = item.label || item.id;
          body.append(label);
          element.append(body);
          if ("start" in item)
            for (const side of ["start", "end"] as const) {
              const handle = document.createElement("button");
              handle.type = "button";
              handle.className = `ravl-region-handle ravl-region-handle-${side}`;
              handle.dataset.ravlAnnotation = item.id;
              handle.dataset.side = side;
              handle.disabled = !!item.locked;
              handle.setAttribute(
                "aria-label",
                `Resize ${side} of ${item.label || item.id}. Arrow keys adjust boundary.`,
              );
              Object.assign(handle.style, {
                position: "absolute",
                top: "0",
                bottom: "0",
                [side === "start" ? "left" : "right"]: "0",
                width: "8px",
                padding: "0",
                border: "0",
                background: "var(--ravl-handle-color, #8055ba88)",
                cursor: "ew-resize",
                touchAction: "none",
              });
              element.append(handle);
            }
          overlay.append(element);
          node = {
            element,
            item,
            cleanup,
            renderer: options.renderRegionLabel,
          };
          nodes.set(item.id, node);
        }
        position(node.element, item);
      }
      if (focusId && !focus?.isConnected) {
        const element = nodes.get(focusId)?.element;
        const target = focusSide
          ? element?.querySelector<HTMLElement>(`[data-side="${focusSide}"]`)
          : element?.querySelector<HTMLElement>(".ravl-region-body");
        target?.focus({ preventScroll: true });
      }
      // The list is the non-spatial alternative to overlays; no hidden canvas data.
      const focusedRow = focus?.dataset.rowId;
      rows.replaceChildren();
      page = Math.max(0, Math.min(page, Math.ceil(items.length / pageSize) - 1));
      pagination.hidden = !matches() || items.length <= pageSize;
      previous.disabled = page === 0;
      next.disabled = (page + 1) * pageSize >= items.length;
      pageLabel.textContent = ` Page ${page + 1} of ${Math.max(1, Math.ceil(items.length / pageSize))} `;
      if (matches())
        for (const item of items.slice(page * pageSize, (page + 1) * pageSize)) {
          const row = document.createElement("li"),
            button = document.createElement("button");
          button.type = "button";
          button.dataset.rowId = item.id;
          button.textContent = `${item.label || item.id} · ${"start" in item ? `${item.start.toFixed(2)}–${item.end.toFixed(2)}` : item.time.toFixed(2)}s${item.locked ? " · locked" : ""}${invalid.has(item.id) ? " · out of bounds" : ""}`;
          button.onclick = () => {
            select(item.id);
            if (active()) {
              root.scrollLeft = Math.max(
                0,
                (("start" in item ? item.start : item.time) / duration) *
                  geometry().width -
                  root.clientWidth / 3,
              );
              render();
              nodes.get(item.id)?.element
                .querySelector<HTMLElement>(".ravl-region-body")
                ?.focus({ preventScroll: true });
            }
          };
          row.append(button);
          rows.append(row);
          if (focusedRow === item.id) button.focus({ preventScroll: true });
        }
      setSelection(selection, false);
    } finally {
      rendering = false;
    }
  }
  const click = (event: MouseEvent) => {
    const target = annotationTarget(event.target);
    if (target) {
      event.stopPropagation();
      select(target.dataset.ravlAnnotation!);
    }
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !active()) return;
    const target = annotationTarget(event.target);
    const id = target?.dataset.ravlAnnotation;
    const item = id
      ? [
          ...store!.getSnapshot().document.regions,
          ...store!.getSnapshot().document.markers,
        ].find((item) => item.id === id)
      : undefined;
    if (id && (!item || item.locked)) return;
    if (!id && !geometry().selectMode) return;
    event.preventDefault();
    event.stopPropagation();
    if (target)
      (target.matches("button")
        ? target
        : target.querySelector<HTMLElement>("button")
      )?.focus({ preventScroll: true });
    else root.focus({ preventScroll: true });
    cancel();
    if (id) select(id);
    else {
      select(null);
      setSelection(null);
    }
    gesture = {
      pointer: event.pointerId,
      startX: event.clientX,
      anchor: timeAt(event.clientX),
      id,
      item,
      side: target?.dataset.side as Gesture["side"],
      revision: store!.getSnapshot().revision,
      moved: false,
    };
    root.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const g = gesture,
      now = snap(timeAt(event.clientX)),
      duration = geometry().duration;
    g.moved ||= Math.abs(event.clientX - g.startX) >= 3;
    if (!g.moved) return;
    if (!g.item) {
      const start = Math.min(snap(g.anchor), now),
        end = Math.max(snap(g.anchor), now);
      setSelection(end > start ? { start, end } : null);
      return;
    }
    if ("start" in g.item) {
      const original = g.item,
        min = Math.max(0.001, rules.minLength),
        length = original.end - original.start;
      let start = original.start,
        end = original.end;
      if (g.side === "start")
        start = Math.max(
          0,
          end - rules.maxLength,
          Math.min(end - min, snap(original.start + now - g.anchor)),
        );
      else if (g.side === "end")
        end = Math.min(
          duration,
          start + rules.maxLength,
          Math.max(start + min, snap(original.end + now - g.anchor)),
        );
      else {
        start = Math.max(
          0,
          Math.min(duration - length, snap(original.start + now - g.anchor)),
        );
        end = start + length;
      }
      g.next = { ...original, start, end };
    } else g.next = { ...g.item, time: snap(g.item.time + now - g.anchor) };
    const node = nodes.get(g.id!);
    if (node && g.next) position(node.element, g.next);
  };
  const up = (event: PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const g = gesture;
    gesture = null;
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
  const lost = () => {
    if (gesture) {
      cancel();
      render();
    }
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      cancel();
      setSelection(null);
      render();
      return;
    }
    const target = annotationTarget(event.target);
    if (!target || !active()) return;
    if (!["ArrowLeft", "ArrowRight", "Delete", "Backspace"].includes(event.key))
      return;
    event.preventDefault();
    event.stopPropagation();
    const id = target.dataset.ravlAnnotation!,
      item = [
        ...store!.getSnapshot().document.regions,
        ...store!.getSnapshot().document.markers,
      ].find((item) => item.id === id);
    if (!item || item.locked) return;
    attempt(() => {
      if (event.key === "Delete" || event.key === "Backspace") {
        store!.remove(id, "keyboard");
        select(null);
        root.focus();
        return;
      }
      const delta =
        (event.key === "ArrowLeft" ? -1 : 1) *
        (rules.snap || (event.shiftKey ? 1 : 0.1)) *
        (rules.snap && event.shiftKey ? 10 : 1);
      if ("start" in item) {
        const length = item.end - item.start,
          min = Math.max(0.001, rules.minLength);
        if (target.dataset.side === "start")
          store!.updateRegion(
            id,
            {
              start: Math.max(
                0,
                item.end - rules.maxLength,
                Math.min(item.end - min, snap(item.start + delta)),
              ),
            },
            "keyboard",
          );
        else if (target.dataset.side === "end")
          store!.updateRegion(
            id,
            {
              end: Math.min(
                geometry().duration,
                item.start + rules.maxLength,
                Math.max(item.start + min, snap(item.end + delta)),
              ),
            },
            "keyboard",
          );
        else {
          const start = Math.max(
            0,
            Math.min(geometry().duration - length, snap(item.start + delta)),
          );
          store!.updateRegion(id, { start, end: start + length }, "keyboard");
        }
      } else
        store!.updateMarker(id, { time: snap(item.time + delta) }, "keyboard");
    });
    render();
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", lost);
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
      render();
    },
    sync: render,
    getSelection: () => selection,
    clearSelection: () => setSelection(null),
    createRegionFromSelection(id: string, label?: string) {
      if (!selection || !store || !active())
        throw failure("NOT_READY", "view", "Select an audio range first");
      store.addRegion({ id, ...selection, label });
      setSelection(null);
    },
    isEditing: () => gesture !== null,
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      unsubscribe?.();
      if (owned) store?.dispose();
      nodes.forEach((node) => node.cleanup?.());
      nodes.clear();
      overlay.remove();
      list.remove();
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", lost);
      root.removeEventListener("lostpointercapture", lost);
      root.removeEventListener("click", click);
      root.removeEventListener("keydown", key);
    },
  };
}
