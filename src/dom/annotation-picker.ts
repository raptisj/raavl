import type { Marker, Region } from "../regions/index.js";

type Annotation = Region | Marker;
type Filter = (item: Annotation) => boolean;

const inlineLimit = 4;
const pageSize = 100;
let nextPickerId = 0;

export const annotationTime = (item: Annotation) =>
  "start" in item ? item.start : item.time;

function parseSearchTime(query: string) {
  if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:\s*(?:s|sec|seconds?))?$/.test(query))
    return Number.parseFloat(query);
  if (/^\d+:(?:[0-5]?\d:)?[0-5]?\d(?:\.\d+)?$/.test(query))
    return query.split(":").reduce((time, part) => time * 60 + Number(part), 0);
  return null;
}

export function createAnnotationPicker(
  document: Document,
  onChoose: (item: Annotation) => void,
) {
  const element = document.createElement("div");
  element.className = "raavl-annotation-badges";
  const strip = document.createElement("div");
  strip.className = "raavl-annotation-strip";
  const inlineRows = document.createElement("ul");
  inlineRows.className = "raavl-annotation-badge-row";
  const compact = document.createElement("div");
  compact.className = "raavl-annotation-compact";
  compact.hidden = true;
  const panel = document.createElement("div");
  panel.className = "raavl-annotation-picker";
  panel.id = `raavl-annotation-picker-${++nextPickerId}`;
  panel.setAttribute("role", "group");
  panel.hidden = true;

  function button(content: string | HTMLElement) {
    const control = document.createElement("button");
    control.type = "button";
    control.append(content);
    return control;
  }

  function badgeText(text = "") {
    const label = document.createElement("span");
    label.className = "raavl-annotation-badge-text";
    label.textContent = text;
    return label;
  }

  const browse = button("");
  browse.className = "raavl-annotation-browse";
  const selectedLabel = badgeText();
  const selectedBadge = button(selectedLabel);
  selectedBadge.className = "raavl-annotation-selected-badge";
  const header = document.createElement("div");
  header.className = "raavl-annotation-picker-header";
  const heading = document.createElement("span");
  heading.setAttribute("role", "status");
  const showAll = button("");
  const dismiss = button("×");
  dismiss.className = "raavl-annotation-picker-close";
  dismiss.setAttribute("aria-label", "Close annotation picker");
  header.append(heading, showAll, dismiss);
  const search = document.createElement("input");
  search.type = "search";
  search.className = "raavl-annotation-picker-search";
  search.placeholder = "Search labels or time";
  search.setAttribute("aria-label", "Search annotations by label or time");
  const rows = document.createElement("ul");
  rows.className = "raavl-annotation-picker-rows";
  rows.id = `${panel.id}-rows`;
  search.setAttribute("aria-controls", rows.id);
  const empty = document.createElement("p");
  empty.className = "raavl-annotation-picker-empty";
  empty.textContent = "No matches.";
  empty.hidden = true;
  const pagination = document.createElement("div");
  pagination.className = "raavl-annotation-pagination";
  const previous = button("Previous annotations");
  const next = button("Next annotations");
  const pageLabel = document.createElement("span");
  pageLabel.setAttribute("role", "status");
  pagination.append(previous, pageLabel, next);
  panel.append(header, search, rows, empty, pagination);
  compact.append(browse, selectedBadge);
  strip.append(inlineRows, compact);
  element.append(strip, panel);

  let items: Annotation[] = [];
  let invalid: ReadonlySet<string> = new Set();
  let selected: string | null = null;
  let origin: HTMLButtonElement | null = null;
  let filter: Filter | undefined;
  let page = 0;
  let label = "Annotations";

  function describe(item: Annotation) {
    const time = annotationTime(item).toFixed(2);
    const range = "end" in item ? `${time}–${item.end.toFixed(2)}` : time;
    return `${item.label || item.id} · ${range}s${item.locked ? " · locked" : ""}${invalid.has(item.id) ? " · out of bounds" : ""}`;
  }

  function choose(item: Annotation) {
    close();
    onChoose(item);
  }

  function fill(list: HTMLElement, annotations: Annotation[]) {
    list.replaceChildren(
      ...annotations.map((item) => {
        const row = document.createElement("li");
        const text = describe(item);
        const control = button(list === inlineRows ? badgeText(text) : text);
        control.dataset.rowId = item.id;
        control.onclick = () => choose(item);
        row.append(control);
        return row;
      }),
    );
  }

  function syncSelected() {
    const item = selected === null
      ? undefined
      : items.find((item) => item.id === selected);
    selectedBadge.hidden = !item;
    if (item) {
      selectedLabel.textContent = describe(item);
      selectedBadge.dataset.rowId = item.id;
      selectedBadge.onclick = () => choose(item);
    } else {
      delete selectedBadge.dataset.rowId;
      selectedBadge.onclick = null;
    }
    for (const control of element.querySelectorAll<HTMLButtonElement>("button[data-row-id]")) {
      const current = control.dataset.rowId === selected;
      control.dataset.selected = String(current);
      if (current) control.setAttribute("aria-current", "true");
      else control.removeAttribute("aria-current");
    }
  }

  function updateLayout() {
    const width = strip.clientWidth;
    const collapse = items.length > inlineLimit ||
      (width > 0 ? inlineRows.offsetWidth > width : !compact.hidden);
    if (compact.hidden === !collapse) return;
    const focus = document.activeElement;
    inlineRows.inert = collapse;
    inlineRows.style.visibility = collapse ? "hidden" : "";
    inlineRows.style.position = collapse ? "absolute" : "";
    compact.hidden = !collapse;
    if (collapse && inlineRows.contains(focus)) focusBadge(selected);
    if (!collapse && compact.contains(focus)) focusBadge(selected);
  }

  function focusBadge(id: string | null) {
    const row = [...inlineRows.querySelectorAll("button")].find(
      (control) => control.dataset.rowId === id,
    );
    const target = compact.hidden
      ? (row ?? inlineRows.querySelector("button"))
      : selectedBadge.dataset.rowId === id && !selectedBadge.hidden
        ? selectedBadge
        : browse;
    if (!target || target.closest("[hidden]")) return false;
    target.focus({ preventScroll: true });
    return true;
  }

  function renderPanel() {
    const match = filter;
    let candidates = match
      ? items.filter((item) => !invalid.has(item.id) && match(item))
      : items;
    if (!candidates.length && filter) {
      filter = undefined;
      candidates = items;
    }
    const query = search.value.trim().toLowerCase();
    if (query) {
      const time = parseSearchTime(query);
      candidates = candidates.filter((item) => {
        if (time === null)
          return item.label?.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
        const start = annotationTime(item);
        const end = "end" in item ? item.end : start;
        return (start <= time && time <= end) ||
          Number(start.toFixed(2)) === time || Number(end.toFixed(2)) === time;
      });
    }
    const pages = Math.max(1, Math.ceil(candidates.length / pageSize));
    page = Math.min(page, pages - 1);
    const title = filter ? "Overlapping regions" : label;
    panel.setAttribute("aria-label", title);
    heading.textContent = `${title} (${candidates.length})`;
    rows.hidden = !candidates.length;
    empty.hidden = !!candidates.length;
    showAll.hidden = !filter;
    showAll.textContent = `Show all ${items.length}`;
    pagination.hidden = pages === 1;
    previous.disabled = page === 0;
    next.disabled = page === pages - 1;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    const focus = document.activeElement as HTMLElement | null;
    const focusedId = rows.contains(focus) ? focus?.dataset.rowId : undefined;
    fill(rows, candidates.slice(page * pageSize, (page + 1) * pageSize));
    syncSelected();
    if (focusedId !== undefined) {
      const target = [...rows.querySelectorAll("button")].find(
        (control) => control.dataset.rowId === focusedId,
      );
      (target ?? rows.querySelector("button") ?? dismiss).focus({ preventScroll: true });
    }
  }

  function close(restoreFocus = false) {
    if (!origin) return;
    const trigger = origin;
    trigger.setAttribute("aria-expanded", "false");
    origin = null;
    filter = undefined;
    search.value = "";
    panel.hidden = true;
    rows.replaceChildren();
    if (!restoreFocus) return;
    if (trigger.isConnected && !trigger.closest("[hidden]"))
      trigger.focus({ preventScroll: true });
    else focusBadge(selected);
  }

  function connect(trigger: HTMLButtonElement) {
    trigger.setAttribute("aria-controls", panel.id);
    trigger.setAttribute("aria-expanded", "false");
  }

  function open(trigger: HTMLButtonElement, match?: Filter) {
    if (origin === trigger && Boolean(filter) === Boolean(match)) {
      close(true);
      return;
    }
    close();
    origin = trigger;
    filter = match;
    page = 0;
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    renderPanel();
    rows.scrollTop = 0;
    (rows.querySelector("button") ?? dismiss).focus();
  }

  function changePage(nextPage: number) {
    page = nextPage;
    renderPanel();
    rows.scrollTop = 0;
    (rows.querySelector("button") ?? dismiss).focus({ preventScroll: true });
  }

  connect(browse);
  browse.onclick = () => open(browse);
  previous.onclick = () => changePage(page - 1);
  next.onclick = () => changePage(page + 1);
  showAll.onclick = () => {
    filter = undefined;
    changePage(0);
  };
  search.oninput = () => {
    page = 0;
    renderPanel();
    rows.scrollTop = 0;
  };
  dismiss.onclick = () => close(true);
  element.onkeydown = (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  const observer = new ResizeObserver(updateLayout);
  observer.observe(strip);
  observer.observe(inlineRows);

  return {
    element,
    strip,
    connect,
    open,
    close,
    isOpen: () => origin !== null,
    focusBadge,
    select(id: string | null) {
      if (id === selected) return;
      selected = id;
      syncSelected();
    },
    update(annotations: Annotation[], invalidIds: ReadonlySet<string>) {
      const active = document.activeElement as HTMLElement | null;
      const focusedId = inlineRows.contains(active) ? active?.dataset.rowId : undefined;
      items = [...annotations].sort((a, b) => annotationTime(a) - annotationTime(b));
      invalid = invalidIds;
      const regionCount = items.filter((item) => "start" in item).length;
      label = regionCount === items.length
        ? "Regions"
        : regionCount ? "Annotations" : "Markers";
      browse.textContent = `${label} (${items.length})`;
      strip.hidden = !items.length;
      fill(inlineRows, items.length <= inlineLimit ? items : []);
      if (!items.length) close();
      if (origin) renderPanel();
      else syncSelected();
      updateLayout();
      if (focusedId !== undefined) focusBadge(focusedId);
    },
    dispose() {
      close();
      observer.disconnect();
    },
  };
}
