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
  path.setAttribute(
    "d",
    {
      apply: "M5 12l4 4L19 6",
      delete: "M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
      cancel: "M6 6l12 12M18 6L6 18",
    }[icon],
  );
  svg.append(path);
  element.append(svg);
  return element;
}

type Annotation = Region | Marker;
type Boundary = "start" | "end";
const timeStep = 0.1;
const formatTime = (time: number) => String(Number(time.toFixed(6)));

function coordinates(item: Annotation): [number, number?] {
  return "start" in item ? [item.start, item.end] : [item.time];
}
function findAnnotation(document: AnnotationDocument, id: string) {
  return (
    document.regions.find((item) => item.id === id) ??
    document.markers.find((item) => item.id === id)
  );
}
function sameEditableValues(a: Annotation, b: Annotation) {
  const [from, to] = coordinates(a);
  const [otherFrom, otherTo] = coordinates(b);
  return (
    a.id === b.id && a.label === b.label && from === otherFrom && to === otherTo
  );
}

export function createAnnotationEditor(
  badges: HTMLElement,
  focusBadge: (id: string) => void,
  clearSelection: () => void,
  playSelection: ((range: NonNullable<Selection>) => void) | undefined,
  setSelectionBoundary: (side: Boundary, time: number) => void,
  resizeBoundary: (
    range: NonNullable<Selection>,
    time: number,
    side: Boundary,
  ) => NonNullable<Selection>,
  renderPreview: () => void,
  onRegionEdit: (editing: boolean) => void,
  canOpenModal: () => boolean = () => true,
) {
  const document = badges.ownerDocument;
  const element = document.createElement("div");
  const dialog = document.createElement("dialog");
  dialog.className = "raavl-annotation-dialog";
  const closeDialog = button(document, "Close", "cancel");
  closeDialog.classList.add("raavl-annotation-dialog-close");
  let mode: "inline" | "modal" = "inline";
  const creation = document.createElement("div");
  creation.className = "raavl-annotation-create";
  creation.setAttribute("role", "group");
  creation.setAttribute("aria-label", "New region");
  creation.hidden = true;
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
  function timeField(side: Boundary, update: (step: number) => void) {
    const name = side === "start" ? "Start" : "End";
    const time = field(`${name} (seconds)`, true);
    const element = document.createElement("div");
    element.className = "raavl-annotation-time-field";
    const steps = document.createElement("span");
    steps.className = "raavl-annotation-time-steps";
    const decrease = button(document, "−");
    const increase = button(document, "+");
    decrease.setAttribute("aria-label", `Decrease ${side} by ${timeStep} seconds`);
    increase.setAttribute("aria-label", `Increase ${side} by ${timeStep} seconds`);
    decrease.onclick = () => update(-timeStep);
    increase.onclick = () => update(timeStep);
    steps.append(decrease, increase);
    element.append(time.label, steps);
    return { ...time, element, steps, decrease, increase };
  }
  const newLabel = field("Label");
  newLabel.input.value = "New annotation";
  const selectionStart = timeField("start", (step) => updateSelection("start", step));
  const selectionEnd = timeField("end", (step) => updateSelection("end", step));
  const label = field("Label");
  const start = timeField("start", (step) => stepRegionBoundary("start", step));
  const end = timeField("end", (step) => stepRegionBoundary("end", step));
  const addRegion = button(document, "Create region from selection", "apply");
  addRegion.disabled = true;
  const cancelRegion = button(document, "Cancel selection", "cancel");
  const preview = button(document, "Play region");
  const editPreview = button(document, "Play region");
  const apply = button(document, "Apply edit", "apply");
  const remove = button(document, "Delete annotation", "delete");
  const cancel = button(document, "Cancel edit", "cancel");
  function saveActions(play: HTMLButtonElement, save: HTMLButtonElement) {
    const group = document.createElement("div");
    group.className = "raavl-annotation-save-actions";
    if (playSelection) group.append(play);
    group.append(save);
    return group;
  }
  const actions = document.createElement("div");
  actions.className = "raavl-annotation-actions";
  actions.append(remove, cancel, saveActions(editPreview, apply));
  const error = document.createElement("p");
  error.className = "raavl-annotation-error";
  error.setAttribute("role", "alert");
  const creationActions = document.createElement("div");
  creationActions.className = "raavl-annotation-actions";
  creationActions.append(cancelRegion, saveActions(preview, addRegion));
  creation.append(
    newLabel.label,
    selectionStart.element,
    selectionEnd.element,
    creationActions,
  );
  editor.append(label.label, start.element, end.element, actions);
  element.append(creation, editor, error);

  let store: AnnotationStore | null = null;
  let selection: Selection = null;
  let item: Annotation | null = null;
  let draft: Annotation | null = null;
  let snapshot: ReturnType<AnnotationStore["getSnapshot"]> | undefined;
  let sequence = 0;
  function dismissDialog() {
    if (selection) clearSelection();
    if (item) close(true);
  }
  function cancelEdit() {
    if (mode === "modal") dismissDialog();
    else close(true);
  }
  closeDialog.onclick = dismissDialog;
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismissDialog();
  });
  function updateSelection(side: Boundary, step = 0) {
    if (!selection) return;
    const { input } = side === "start" ? selectionStart : selectionEnd;
    const current = selection[side];
    const typed = input.valueAsNumber;
    const time =
      Number.isFinite(typed) && input.value !== formatTime(current)
        ? typed
        : current;
    setSelectionBoundary(side, time + step);
    input.value = selection ? formatTime(selection[side]) : "";
  }
  for (const [side, { input }] of [
    ["start", selectionStart],
    ["end", selectionEnd],
  ] as const) {
    input.onchange = () => updateSelection(side);
    input.onkeydown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        updateSelection(side);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : timeStep;
        updateSelection(side, event.key === "ArrowUp" ? step : -step);
      }
    };
  }
  function close(restoreFocus = editor.contains(document.activeElement)) {
    if (!item) return;
    const { id } = item;
    item = null;
    draft = null;
    editor.hidden = true;
    syncVisibility();
    error.textContent = "";
    renderPreview();
    if (restoreFocus) focusBadge(id);
  }
  function readEditRange(region: Region): Selection {
    const from = region.locked ? region.start : start.input.valueAsNumber;
    const to = region.locked ? region.end : end.input.valueAsNumber;
    const duration = snapshot?.duration ?? Infinity;
    return from >= 0 && to > from && Number.isFinite(to) && to <= duration
      ? { start: from, end: to }
      : null;
  }
  function updatePreview() {
    if (!item) return;
    const [previousStart, previousEnd] = coordinates(draft ?? item);
    const nextLabel = label.input.value;
    if ("start" in item) {
      const range = readEditRange(item);
      editPreview.disabled = range === null;
      draft = {
        ...item,
        start: range?.start ?? previousStart,
        end: range?.end ?? previousEnd ?? item.end,
        label: nextLabel,
      };
    } else {
      const from = start.input.valueAsNumber;
      const duration = snapshot?.duration ?? Infinity;
      const validStart = Number.isFinite(from) && from >= 0 && from <= duration;
      draft = {
        ...item,
        time: !item.locked && validStart ? from : previousStart,
        label: nextLabel,
      };
    }
    renderPreview();
  }
  editor.oninput = updatePreview;
  function stepRegionBoundary(side: Boundary, step: number) {
    if (!item || !("start" in item) || item.locked) return;
    const current = draft && "start" in draft ? draft : item;
    const time = Number(formatTime(current[side] + step));
    const next = resizeBoundary(current, time, side);
    start.input.value = String(next.start);
    end.input.value = String(next.end);
    updatePreview();
  }
  function edit(operation: (store: AnnotationStore) => void) {
    if (!store) return;
    error.textContent = "";
    try {
      operation(store);
    } catch (cause) {
      error.textContent =
        cause instanceof Error ? cause.message : String(cause);
    }
  }
  function newRegionId(target: AnnotationStore) {
    const { regions, markers } = target.getSnapshot().document;
    const ids = new Set([...regions, ...markers].map(({ id }) => id));
    let id: string;
    do id = `region-${++sequence}`;
    while (ids.has(id));
    return id;
  }
  addRegion.onclick = () =>
    edit((target) => {
      if (!selection) return;
      target.addRegion({
        id: newRegionId(target),
        ...selection,
        label: newLabel.input.value,
      });
      clearSelection();
    });
  cancelRegion.onclick = clearSelection;
  preview.onclick = () => {
    if (selection) playSelection?.(selection);
  };
  editPreview.onclick = () => {
    const range = item && "start" in item ? readEditRange(item) : null;
    if (range) playSelection?.(range);
  };
  apply.onclick = () =>
    edit((target) => {
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
        target.updateMarker(
          item.id,
          timeChanged ? { ...patch, time: nextStart } : patch,
        );
      }
    });
  remove.onclick = () =>
    edit((target) => {
      if (item) target.remove(item.id);
    });
  cancel.onclick = cancelEdit;
  creation.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      clearSelection();
    } else if (event.key === "Enter" && event.target === newLabel.input) {
      event.preventDefault();
      addRegion.click();
    }
  };
  editor.onkeydown = (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
    } else if (
      event.key === "Enter" &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
      apply.click();
    }
  };
  function syncEditControls(annotation: Annotation) {
    const locked = !!annotation.locked;
    for (const { input, decrease, increase } of [start, end])
      input.disabled = decrease.disabled = increase.disabled = locked;
    remove.disabled = locked;
    const isRegion = "start" in annotation;
    editPreview.hidden = !isRegion;
    editPreview.disabled = !isRegion || readEditRange(annotation) === null;
  }
  function syncVisibility() {
    creation.hidden = !store || !selection || item !== null;
    badges.hidden = mode === "inline" && (item !== null || !creation.hidden);
    onRegionEdit(item !== null && "start" in item);
    const show =
      mode === "modal" &&
      (!creation.hidden || !editor.hidden) &&
      canOpenModal();
    dialog.setAttribute(
      "aria-label",
      item ? `Edit ${item.label || item.id}` : "New region",
    );
    if (show && !dialog.open && dialog.isConnected) dialog.showModal();
    else if (!show && dialog.open) dialog.close();
  }
  function previewAnnotation(annotation: Annotation): Annotation {
    if (
      !item ||
      !draft ||
      item.id !== annotation.id ||
      !sameEditableValues(item, annotation)
    )
      return annotation;
    if (item === annotation) return draft;
    if ("start" in annotation && "start" in draft)
      return {
        ...annotation,
        label: draft.label,
        start: draft.start,
        end: draft.end,
      };
    if ("time" in annotation && "time" in draft)
      return { ...annotation, label: draft.label, time: draft.time };
    return annotation;
  }
  return {
    element,
    setMode(next: "inline" | "modal") {
      if (mode === next) return;
      if (dialog.open) dialog.close();
      mode = next;
      if (mode === "modal") {
        dialog.append(creation, editor, error, closeDialog);
        element.append(dialog);
      } else {
        element.append(creation, editor, error);
        dialog.remove();
      }
      syncVisibility();
    },
    dispose() {
      if (dialog.open) dialog.close();
      badges.hidden = false;
      element.remove();
    },
    focusCreation() {
      if (!creation.hidden) newLabel.input.focus({ preventScroll: true });
    },
    close,
    preview: previewAnnotation,
    open(id: string) {
      if (item?.id === id) {
        label.input.focus({ preventScroll: true });
        return;
      }
      const annotation =
        store && findAnnotation(store.getSnapshot().document, id);
      if (!annotation) return;
      item = annotation;
      draft = null;
      const [from, to] = coordinates(annotation);
      label.input.value = annotation.label ?? "";
      start.caption.textContent =
        to === undefined ? "Time (seconds)" : "Start (seconds)";
      start.input.value = String(from);
      start.steps.hidden = end.element.hidden = to === undefined;
      end.input.value = to === undefined ? "" : String(to);
      editor.setAttribute(
        "aria-label",
        `Edit ${annotation.label || annotation.id}`,
      );
      syncEditControls(annotation);
      error.textContent = "";
      editor.hidden = false;
      syncVisibility();
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
      if (selection !== range) {
        selection = range;
        addRegion.disabled = !range;
        selectionStart.input.value = range ? formatTime(range.start) : "";
        selectionEnd.input.value = range ? formatTime(range.end) : "";
        if (!range) error.textContent = "";
      }
      syncVisibility();
      const next = target?.getSnapshot();
      if (next === snapshot) return;
      snapshot = next;
      if (!item || !next) return;
      const current = findAnnotation(next.document, item.id);
      if (!current || !sameEditableValues(item, current)) {
        close();
        return;
      }
      if (draft && current !== item) draft = previewAnnotation(current);
      item = current;
      syncEditControls(current);
    },
  };
}
