# Proposed workflows

Generated from `examples/workflows.js` with `npm run docs:workflows`.

These are API sketches, not executable library examples. Imports named raavl
do not exist yet. Snippets omit surrounding application UI and repeated imports.
`container`, `showError`, `showStatus`, `saveDocument`, `episodeSource`,
and `waveformData` are application-provided placeholders. React snippets use
React hooks and the proposed Waveform component. Persistence helpers must handle
their own failures. All async operations in production examples will handle errors.

## 01 / Play a URL

Implementation phase: 2.

The shortest path to playback. Loading the waveform and preparing audio have independent status.

setSource resolves after metadata is available. Handle rejected loading and play promises. Waveform errors remain observable separately. Dispose both the view and owned player when leaving the page.

### Vanilla JavaScript

```js
import { createPlayer, mountWaveform } from "raavl";

const player = createPlayer();
const view = mountWaveform(container, { player });
const unsubscribe = player.subscribe(() => {
  const state = player.getSnapshot();
  showStatus(state.source, state.waveform);
});

try {
  await player.setSource({ kind: "url", id: "episode-1", url: "/audio.mp3" });
} catch (error) {
  showError(error);
}

playButton.onclick = () => player.play().catch(showError);
// On page teardown:
// unsubscribe(); view.dispose(); player.dispose()
```

### React

```jsx
import { useRef } from "react";
import { Waveform } from "raavl/react";

function AudioPlayer() {
  const player = useRef(null);
  return (
    <>
      <Waveform
        ref={player}
        source={{ kind: "url", id: "episode-1", url: "/audio.mp3" }}
        onError={showError}
        aria-label="Episode waveform"
      />
      <button onClick={() => player.current?.play().catch(showError)}>
        Play
      </button>
    </>
  );
}
```

## 02 / Open a local file

Implementation phase: 2.

Accept a File directly. The library owns and revokes any object URL it creates.

Choosing another file cancels the previous load. Cancellation is normal control flow. The application creates a new source identity for each chosen asset.

### Vanilla JavaScript

```js
fileInput.onchange = async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    await player.setSource({ kind: "file", id: crypto.randomUUID(), file });
  } catch (error) {
    if (error.code !== "CANCELLED") showError(error);
  }
};
```

### React

```jsx
function LocalAudio() {
  const [source, setSource] = useState(null);
  return (
    <>
      <input
        type="file"
        accept="audio/*"
        aria-label="Choose audio"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setSource({ kind: "file", id: crypto.randomUUID(), file });
        }}
      />
      <Waveform source={source} onError={showError} />
    </>
  );
}
```

## 03 / Long recording with peaks

Implementation phase: 2.

Supply visualization data without decoding the entire audio file in the browser.

waveformData follows the versioned min/max bucket format, belongs to interview-1, and declares its duration. Audio and waveform data must describe the same asset. A peaks mismatch affects the waveform, not otherwise valid playback.

### Vanilla JavaScript

```js
const source = {
  kind: "url",
  id: "interview-1",
  url: "/interview.mp3",
  waveform: { kind: "peaks", data: waveformData },
};
await player.setSource(source);
// Keep waveformData stable; never mutate buffers after passing them in.
```

### React

```jsx
// Define outside the component or memoize the asset descriptor.
const source = {
  kind: "url",
  id: "interview-1",
  url: "/interview.mp3",
  waveform: { kind: "peaks", data: waveformData },
};

function Interview() {
  return (
    <Waveform
      source={source}
      onError={showError}
      viewport={{ zoom: 30, follow: "visible" }}
    />
  );
}
```

## 04 / Create and persist regions

Implementation phase: 3.

Keep annotation data independent of DOM and audio loading. Persist only committed edits.

This store owns its document. Regions can be declared before metadata loads. JSON import validates version, IDs, numbers, and source identity. Handle storage errors in application code.

### Vanilla JavaScript

```js
import { createAnnotations } from "raavl/regions";

const annotations = createAnnotations({
  document: {
    version: 1,
    sourceId: "episode-1",
    markers: [],
    regions: [{ id: "intro", start: 0, end: 12, label: "Introduction" }],
  },
});
view.update({ annotations });
const offCommit = annotations.onCommit((document) => saveDocument(document));
annotations.addRegion({ id: "quote", start: 20, end: 28, label: "Quote" });
// On teardown: offCommit(); annotations.dispose()
```

### React

```jsx
const initialDocument = {
  version: 1,
  sourceId: "episode-1",
  markers: [],
  regions: [{ id: "intro", start: 0, end: 12, label: "Introduction" }],
};

function AnnotatedPlayer() {
  return (
    <Waveform
      source={episodeSource}
      defaultAnnotations={initialDocument}
      onAnnotationsCommit={saveDocument}
      renderRegionLabel={(region) => <strong>{region.label}</strong>}
    />
  );
}
```

## 05 / Controlled annotation editor

Implementation phase: 3.

The application owns committed annotations; the library owns transient drag previews.

Publish the next value synchronously to accept an edit; persist it asynchronously. If the host does not accept, the preview reverts. An external revision change cancels a gesture in progress. Default and controlled values cannot be combined.

### Vanilla JavaScript

```js
let revision = 0;
let document = initialDocument;
function onCommit(next, change) {
  if (change.baseRevision !== revision) return;
  document = next;
  revision += 1;
  view.update({ annotations: { value: document, revision, onCommit } });
  saveDocument(document);
}
view.update({ annotations: { value: document, revision, onCommit } });
```

### React

```jsx
function Editor() {
  const [state, setState] = useState({ value: initialDocument, revision: 0 });
  return (
    <Waveform
      source={episodeSource}
      annotations={state.value}
      annotationsRevision={state.revision}
      onAnnotationsCommit={(next, change) => {
        if (change.baseRevision !== state.revision) return;
        setState({ value: next, revision: state.revision + 1 });
        saveDocument(next);
      }}
      interaction={{ drag: "select" }}
    />
  );
}
```

## 06 / Customize the presentation

Implementation phase: 2.

Use ordinary CSS for DOM appearance and a small view API for canvas shape. Region label slots arrive in Phase 3.

Theme CSS is optional. Canvas colors are read from theme tokens when the view renders; call refreshTheme after changing an external stylesheet or ancestor theme. This redraw never reloads audio.

### Vanilla JavaScript

```js
container.classList.add("podcast-wave");
view.update({
  appearance: { style: "bars", barWidth: 3, barGap: 2 },
});
// After changing a parent theme class:
view.refreshTheme();

/* CSS:
.podcast-wave {
  --raavl-wave-color: #6577d4;
  --raavl-progress-color: #2c2868;
}
.podcast-wave .raavl-region-label { font-weight: 600; }
*/
```

### React

```jsx
function StyledAudio() {
  return (
    <Waveform
      source={episodeSource}
      className="podcast-wave"
      appearance={{ style: "bars", barWidth: 3, barGap: 2 }}
      themeVersion="light"
    />
  );
}
// Change themeVersion when an external theme changes.
// Same CSS tokens and classes as the vanilla view.
```

## 07 / Attach to existing media

Implementation phase: 2.

Reuse playback owned by the application, including a native audio or video element.

The descriptor does not assign media.src. The library borrows the element and detaches on disposal without pausing, removing, or resetting it. Supplying peaks is explicit; there is no hidden full-file fetch.

### Vanilla JavaScript

```js
const media = document.querySelector("audio");
await player.setSource({
  kind: "media",
  id: "episode-1",
  element: media,
  waveform: { kind: "peaks", data: waveformData },
});
// Media is already configured and owned by the application.
// player.dispose() leaves it intact.
```

### React

```jsx
function ExistingAudio() {
  const [media, setMedia] = useState(null);
  const source = useMemo(
    () =>
      media
        ? {
            kind: "media",
            id: "episode-1",
            element: media,
            waveform: { kind: "peaks", data: waveformData },
          }
        : null,
    [media],
  );
  return (
    <>
      <audio ref={setMedia} src="/audio.mp3" controls />
      <Waveform source={source} onError={showError} />
    </>
  );
}
```
