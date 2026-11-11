import type {
  AnnotationDocument,
  AnnotationStore,
  Marker,
  Region,
  Selection,
} from "../regions/index.js";

function button(
  document: Document,
  label: string,
  icon?: "apply" | "delete" | "cancel",
) {
  const element = document.createElement("button");
  element.type = "button";
  if (!icon) {
    element.textContent = label;
    return element;
  }
  element.className = `raavl-annotation-action raavl-annotation-action-${icon}`;
  element.setAttribute("aria-label", label);
  element.title = label;
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const path = document.createElementNS(namespace, "path");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", {
    apply: "M5 12l4 4L19 6",
    delete: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
    cancel: "M6 6l12 12M18 6L6 18",
  }[icon]);
  svg.append(path);
  element.append(svg);
  return element;
}

type Annotation = Region | Marker;
function coordinates(item: Annotation): [number, number?] {
  return "start" in item ? [item.start, item.end] : [item.time];
}
function findAnnotation(document: AnnotationDocument, id: string) {
  return document.regions.find((item) => item.id === id)
    ?? document.markers.find((item) => item.id === id);
}

export function createAnnotationEditor(
  badges: HTMLElement,
  focusBadge: (id: string) => void,
  getTime: (() => number) | undefined,
) {
  const document = badges.ownerDocument;
  const element = document.createElement("div");
  const creation = document.createElement("fieldset");
  creation.className = "raavl-annotation-create";
  const legend = document.createElement("legend");
  legend.textContent = "Annotations";
  const selectionTime = document.createElement("span");
  selectionTime.className = "raavl-annotation-selection-time";
  selectionTime.hidden = true;
  const editor = document.createElement("div");
  editor.className = "raavl-annotation-editor";
  editor.setAttribute("role", "group");
  editor.hidden = true;
  function field(name: string, numeric = false) {
    const label = document.createElement("label");
    const caption = document.createElement("span");
    caption.textContent = name;
    const input = document.createElement("input");
    if (numeric) {
      input.type = "number";
      input.min = "0";
      input.step = "any";
    }
    label.append(caption, input);
    return { label, caption, input };
  }
  const newLabel = field("New annotation label");
  newLabel.input.value = "New annotation";
  const label = field("Label");
  const start = field("Start (seconds)", true);
  const end = field("End (seconds)", true);
  const addRegion = button(document, "Create region from selection");
  addRegion.disabled = true;
  const addMarker = button(document, "Add marker at playhead");
  const apply = button(document, "Apply edit", "apply");
  const remove = button(document, "Delete annotation", "delete");
  const cancel = button(document, "Cancel edit", "cancel");
  const lock = button(document, "Lock");
  const actions = document.createElement("div");
  actions.className = "raavl-annotation-actions";
  actions.append(apply, remove, cancel, lock);
  const error = document.createElement("p");
  error.className = "raavl-annotation-error";
  error.setAttribute("role", "alert");
  creation.append(legend, newLabel.label, addRegion);
  if (getTime) creation.append(addMarker);
  creation.append(selectionTime);
  editor.append(label.label, start.label, end.label, actions);
  element.append(creation, editor, error);

  let store: AnnotationStore | null = null;
  let selection: Selection = null;
  let item: Annotation | null = null;
  let snapshot: ReturnType<AnnotationStore["getSnapshot"]> | undefined;
  let sequence = 0;
  function close(restoreFocus = editor.contains(document.activeElement)) {
    if (!item) return;
    const { id } = item;
    item = null;
    editor.hidden = true;
    badges.hidden = creation.hidden = false;
    error.textContent = "";
    if (restoreFocus) focusBadge(id);
  }
  function edit(operation: (store: AnnotationStore) => void) {
    if (!store) return;
    error.textContent = "";
    try {
      operation(store);
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause);
    }
  }
  function newId(target: AnnotationStore, prefix: "region" | "marker") {
    const { regions, markers } = target.getSnapshot().document;
    const ids = new Set([...regions, ...markers].map(({ id }) => id));
    let id: string;
    do id = `${prefix}-${++sequence}`;
    while (ids.has(id));
    return id;
  }
  addRegion.onclick = () => edit((target) => {
    if (selection)
      target.addRegion({
        id: newId(target, "region"),
        ...selection,
        label: newLabel.input.value,
      });
  });
  addMarker.onclick = () => edit((target) => {
    if (getTime)
      target.addMarker({
        id: newId(target, "marker"),
        time: getTime(),
        label: newLabel.input.value,
      });
  });
  apply.onclick = () => edit((target) => {
    if (!item) return;
    const [from, to] = coordinates(item);
    const nextLabel = label.input.value;
    const nextStart = start.input.valueAsNumber;
    const nextEnd = end.input.valueAsNumber;
    const labelChanged = nextLabel !== (item.label ?? "");
    const timeChanged =
      !item.locked &&
      (nextStart !== from || (to !== undefined && nextEnd !== to));
    if (!labelChanged && !timeChanged) {
      close(true);
      return;
    }
    const patch = labelChanged ? { label: nextLabel } : {};
    if ("start" in item) {
      target.updateRegion(
        item.id,
        timeChanged ? { ...patch, start: nextStart, end: nextEnd } : patch,
      );
    } else {
      target.updateMarker(item.id, timeChanged ? { ...patch, time: nextStart } : patch);
    }
  });
  lock.onclick = () => edit((target) => {
    if (!item) return;
    const patch = { locked: !item.locked };
    if ("start" in item) target.updateRegion(item.id, patch);
    else target.updateMarker(item.id, patch);
  });
  remove.onclick = () => edit((target) => {
    if (item) target.remove(item.id);
  });
  cancel.onclick = () => close(true);
  editor.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      apply.click();
    }
  };
  function showLockState(annotation: Annotation) {
    start.input.disabled = end.input.disabled = remove.disabled = !!annotation.locked;
    lock.textContent = annotation.locked ? "Unlock" : "Lock";
  }
  return {
    element,
    close,
    open(id: string) {
      const annotation = store && findAnnotation(store.getSnapshot().document, id);
      if (!annotation) return;
      item = annotation;
      const [from, to] = coordinates(annotation);
      label.input.value = annotation.label ?? "";
      start.caption.textContent = to === undefined ? "Time (seconds)" : "Start (seconds)";
      start.input.value = String(from);
      end.label.hidden = to === undefined;
      end.input.value = to === undefined ? "" : String(to);
      editor.setAttribute("aria-label", `Edit ${annotation.label || annotation.id}`);
      showLockState(annotation);
      error.textContent = "";
      editor.hidden = false;
      badges.hidden = creation.hidden = true;
      label.input.focus({ preventScroll: true });
    },
    select(id: string | null) {
      if (item?.id !== id) close(false);
    },
    sync(target: AnnotationStore | null, range: Selection) {
      if (store !== target) {
        close();
        store = target;
        error.textContent = "";
      }
      creation.disabled = !store;
      if (selection !== range) {
        selection = range;
        addRegion.disabled = !range;
        selectionTime.hidden = !range;
        selectionTime.textContent = range
          ? `Selection: ${range.start.toFixed(2)}–${range.end.toFixed(2)}s`
          : "";
      }
      const next = target?.getSnapshot();
      if (next === snapshot) return;
      snapshot = next;
      if (!item || !next) return;
      const current = findAnnotation(next.document, item.id);
      const [from, to] = coordinates(item);
      const [nextStart, nextEnd] = current ? coordinates(current) : [];
      if (
        !current || current.label !== item.label ||
        nextStart !== from || nextEnd !== to
      ) {
        close();
        return;
      }
      item = current;
      showLockState(current);
    },
  };
}
