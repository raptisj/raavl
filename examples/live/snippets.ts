// These snippets use the implemented public API, independently of the preview.
import { soundcloudStyles, soundcloudTheme } from "./soundcloud";

function soundcloudCode(mode: CodeMode): string {
  const shared = `const theme = parseTheme(${JSON.stringify(soundcloudTheme, null, 2)})
const css = ${JSON.stringify(soundcloudStyles.trim())}
const source = { kind: 'url', id: 'bach-classical', url: '/bach_classical.mp3' }
const formatTime = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')
`;
  if (mode === "vanilla")
    return `import { createPlayer, mountWaveform, parseTheme } from 'raavl'
import 'raavl/styles.css'

// HTML: <div id="soundcloud"></div>
${shared}
const style = document.createElement('style')
style.textContent = css
document.head.append(style)
const container = document.querySelector('#soundcloud')
container.innerHTML = '<div class="sc-demo"><div class="sc-waveform"><div class="sc-canvas"></div><span class="sc-time">0:00</span><span class="sc-duration">0:00</span><div class="sc-hover"></div></div></div>'
const waveform = container.querySelector('.sc-waveform')
const time = container.querySelector('.sc-time')
const duration = container.querySelector('.sc-duration')
const hover = container.querySelector('.sc-hover')
const player = createPlayer()
const view = mountWaveform(container.querySelector('.sc-canvas'), {
  player, theme, interaction: { seek: 'click', drag: 'none' },
  label: 'SoundCloud waveform. Arrow keys seek; Space plays or pauses.',
})
const off = player.subscribe(() => {
  const state = player.getSnapshot()
  duration.textContent = formatTime(state.duration)
  if (state.error || state.waveformError) console.error(state.error || state.waveformError)
})
const offTime = player.subscribeTime(() => { time.textContent = formatTime(player.getCurrentTime()) })
function toggle() {
  const state = player.getSnapshot()
  if (state.source !== 'ready') return
  if (state.playback === 'playing' || state.playback === 'buffering') player.pause()
  else player.play().catch(console.error)
}
waveform.onclick = toggle
waveform.onkeydown = event => {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  toggle()
}
waveform.onpointermove = event => {
  const bounds = waveform.getBoundingClientRect()
  hover.style.width = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) + 'px'
}
await player.setSource(source).catch(console.error)

// On teardown:
function dispose() {
  waveform.onclick = waveform.onkeydown = waveform.onpointermove = null
  offTime(); off(); view.dispose(); player.dispose()
  container.replaceChildren(); style.remove()
}`;
  return `import { useRef, useState } from 'react'
import { parseTheme } from 'raavl'
import { Waveform, usePlayerState, usePlayerTime } from 'raavl/react'
import 'raavl/styles.css'

${shared}
export default function SoundCloudPlayer() {
  const [player, setPlayer] = useState(null)
  const hover = useRef(null)
  const state = usePlayerState(player, state => state)
  const time = usePlayerTime(player)
  function toggle() {
    if (!player || state?.source !== 'ready') return
    if (state.playback === 'playing' || state.playback === 'buffering') player.pause()
    else player.play().catch(console.error)
  }
  return <>
    <style>{css}</style>
    <div className="sc-demo">
      <div className="sc-waveform" onClick={toggle}
        onKeyDown={event => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          toggle()
        }}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          hover.current.style.width = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) + 'px'
        }}>
        <Waveform source={source} theme={theme} onPlayer={setPlayer}
          interaction={{ seek: 'click', drag: 'none' }} onError={console.error}
          aria-label="SoundCloud waveform. Arrow keys seek; Space plays or pauses." />
        <span className="sc-time" aria-hidden="true">{formatTime(time)}</span>
        <span className="sc-duration" aria-hidden="true">{formatTime(state?.duration ?? 0)}</span>
        <div className="sc-hover" ref={hover} aria-hidden="true" />
      </div>
    </div>
  </>
}`;
}
const source = `{ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }`;
const appearance = `{ style: 'bars', height: 160, barWidth: 2, barGap: 1 }`;

export type CodeMode = "vanilla" | "react";
export type CodeScene =
  | "url"
  | "file"
  | "peaks"
  | "external"
  | "dual"
  | "styling"
  | "annotations"
  | "scale"
  | "modules"
  | "soundcloud";

export function exampleCode(scene: CodeScene, mode: CodeMode): string {
  if (scene === "soundcloud") return soundcloudCode(mode);
  if (scene === "modules") return modulesCode(mode);
  if (scene === "scale") return scaleCode(mode);
  const annotations = scene === "annotations";
  const setup =
    scene === "peaks" || scene === "external"
      ? `const response = await fetch('/demo-a.json')\nif (!response.ok) throw new Error('Unable to load peaks')\nconst peaks = await response.json()\n`
      : "";
  const descriptor =
    scene === "peaks"
      ? `{ kind: 'url', id: 'demo-a', url: '/demo-a.wav',\n  waveform: { kind: 'peaks', data: peaks } }`
      : scene === "external"
        ? `{ kind: 'media', id: 'demo-a', element: media,\n  waveform: { kind: 'peaks', data: peaks } }`
        : source;
  const document = `{ version: 1, sourceId: 'demo-a',\n  regions: [{ id: 'intro', start: 0.5, end: 2.5, label: 'Introduction' }],\n  markers: [{ id: 'cue', time: 8, label: 'Cue' }] }`;
  if (mode === "vanilla")
    return `import { createPlayer, mountWaveform${annotations ? ", createAnnotations, stringifyAnnotations" : ""} } from 'raavl'
${scene === "styling" ? "import { waveformThemes, parseTheme } from 'raavl/themes'\n" : ""}import 'raavl/styles.css'

// HTML: <div id="waveform"></div><button id="play">Play</button>${scene === "file" ? '\n// <input id="file" type="file" accept="audio/*" />' : ""}${scene === "external" ? '\n// <audio id="audio" src="/demo-a.wav" controls></audio>' : ""}${scene === "dual" ? '\n// <div id="second-waveform"></div><button id="second-play">Play B</button>' : ""}
${setup}${scene === "external" ? "const media = document.querySelector('#audio')\n" : ""}${annotations ? `const annotations = createAnnotations({ document: ${document} })\n` : ""}const player = createPlayer()
const view = mountWaveform(document.querySelector('#waveform'), {
  player,
  ${scene === "styling" ? "theme: waveformThemes.neon" : `appearance: ${appearance}`},
  interaction: { drag: '${annotations ? "select" : "seek"}' },${annotations ? "\n  annotations,\n  annotationRules: { snap: 0.25, minLength: 0.1 }," : ""}
})
${
  scene === "file"
    ? `document.querySelector('#file').onchange = event => {
  const file = event.target.files?.[0]
  if (file) player.setSource({ kind: 'file', id: crypto.randomUUID(), file }).catch(console.error)
}`
    : `await player.setSource(${descriptor}).catch(console.error)`
}
document.querySelector('#play').onclick = () => player.play().catch(console.error)
${
  scene === "dual"
    ? `
const second = createPlayer()
const secondView = mountWaveform(document.querySelector('#second-waveform'), { player: second })
await second.setSource({ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }).catch(console.error)
document.querySelector('#second-play').onclick = () => second.play().catch(console.error)
`
    : ""
}${
      scene === "styling"
        ? `
// Update in response to your controls; playback continues.
view.update({ theme: waveformThemes.paper, appearance: { lineWidth: 3 } })

// Or load one JSON file with { version: 1, name, appearance, colors }:
// const response = await fetch('/waveform-theme.json')
// if (!response.ok) throw new Error('Unable to load theme')
// view.update({ theme: parseTheme(await response.json()) })
`
        : ""
    }${
      annotations
        ? `
const stopSaving = annotations.onCommit(value => {
  localStorage.setItem('raavl-annotations', stringifyAnnotations(value))
})
// After dragging a selection:
// view.createRegionFromSelection(crypto.randomUUID(), 'New region')
`
        : ""
    }
// On teardown${scene === "external" ? " (the application-owned audio keeps playing)" : ""}:
// view.dispose(); player.dispose()${scene === "dual" ? "; secondView.dispose(); second.dispose()" : ""}${annotations ? "; stopSaving(); annotations.dispose()" : ""}`;

  if (!annotations)
    return `${scene === "file" || scene === "external" ? "import { useState } from 'react'\n" : ""}import { AudioPlayer } from 'raavl/react'
${scene === "styling" ? "import { waveformThemes } from 'raavl/themes'\n" : ""}import 'raavl/styles.css'

${setup}${scene !== "file" && scene !== "external" ? `const source = ${descriptor}\n` : ""}
export default function AudioExample() {${scene === "file" ? "\n  const [source, setSource] = useState(null)" : ""}${
      scene === "external"
        ? `
  const [media, setMedia] = useState(null)
  const source = media ? ${descriptor} : null`
        : ""
    }
  return <>
${
  scene === "file"
    ? `    <input type="file" accept="audio/*" aria-label="Choose audio" onChange={event => {
      const file = event.target.files?.[0]
      if (file) setSource({ kind: 'file', id: crypto.randomUUID(), file })
    }} />\n`
    : ""
}${scene === "external" ? '    <audio ref={setMedia} src="/demo-a.wav" controls />\n' : ""}    <AudioPlayer
      source={source}
      waveform={{
        ${scene === "styling" ? "theme: waveformThemes.neon" : `appearance: ${appearance}`},
        interaction: { drag: 'seek' },${scene === "styling" ? "\n        viewport: { zoom: 100, follow: 'center' }," : ""}
      }}
      controls={{ playbackRate: true, loop: true }}
      onError={console.error}
      aria-label="Audio player"
    />${
      scene === "dual"
        ? `
    <AudioPlayer
      source={{ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }}
      onError={console.error}
      aria-label="Second audio player" />`
        : ""
    }
  </>
}`;

  return `import { PlayerRoot, Waveform, PlayPauseButton, TimeDisplay, PlayerStatus } from 'raavl/react'
import { stringifyAnnotations } from 'raavl'
import 'raavl/styles.css'

const source = ${source}
const initialAnnotations = ${document}

export default function AudioExample() {
  return <PlayerRoot source={source} onError={console.error}>
    <Waveform
      appearance={${appearance}}
      interaction={{ drag: 'select' }}
      defaultAnnotations={initialAnnotations}
      annotationRules={{ snap: 0.25, minLength: 0.1 }}
      onAnnotationsCommit={value => {
        localStorage.setItem('raavl-annotations', stringifyAnnotations(value))
      }}
    />
    <div className="my-toolbar">
      <PlayPauseButton />
      <TimeDisplay />
    </div>
    <PlayerStatus />
  </PlayerRoot>
}`;
}

function scaleCode(mode: CodeMode) {
  const fixture = `const count = 720000
const data = {
  version: 1, sourceId: 'scale', duration: 7200,
  channels: [0, 1].map(channel => {
    const min = new Float32Array(count), max = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const amplitude = 0.1 + 0.8 * Math.abs(Math.sin(i * 0.017 + channel))
      min[i] = -amplitude; max[i] = amplitude
    }
    return { min, max }
  }),
}
const annotations = createAnnotations({ document: {
  version: 1, sourceId: 'scale', markers: [],
  regions: Array.from({ length: 10000 }, (_, i) => ({
    id: 'region-' + i, label: 'Phrase ' + (i + 1), start: i * 0.72, end: i * 0.72 + 0.5,
  })),
} })`;
  const options = `{ data, annotations, viewport: { zoom: 100 } }`;
  if (mode === "vanilla")
    return `import { mountWaveform, createAnnotations } from 'raavl'
import 'raavl/styles.css'

${fixture}

// HTML: <div id="waveform"></div>
const view = mountWaveform(document.querySelector('#waveform'), ${options})
// On teardown: view.dispose(); annotations.dispose()`;
  return `import { useEffect, useRef } from 'react'
import { mountWaveform, createAnnotations } from 'raavl'
import 'raavl/styles.css'

// The data-only benchmark mounts the shared DOM engine in a React effect.
export default function ScaleExample() {
  const host = useRef(null)
  useEffect(() => {
${fixture
  .split("\n")
  .map((line) => "    " + line)
  .join("\n")}
    const view = mountWaveform(host.current, ${options})
    return () => { view.dispose(); annotations.dispose() }
  }, [])
  return <div ref={host} />
}`;
}

function modulesCode(mode: CodeMode) {
  const imports = `import { mountTimeline } from 'raavl/timeline'
import { mountMinimap } from 'raavl/minimap'
import { createSnapper } from 'raavl/snapping'
import { createHistory, recordHistory, undoHistory, redoHistory } from 'raavl/history'
import 'raavl/styles.css'`;
  if (mode === "react")
    return `import { useEffect, useMemo, useRef, useState } from 'react'
import { Waveform } from 'raavl/react'
${imports}

const initial = { version: 1, sourceId: 'demo-a', regions: [{ id: 'intro', start: 1, end: 3, label: 'Opening' }], markers: [{ id: 'cue', time: 8 }] }
export default function Editor() {
  const [state, setState] = useState(() => ({ history: createHistory(initial), revision: 0 }))
  const { history, revision } = state
  const [player, setPlayer] = useState(null), [view, setView] = useState(null)
  const ruler = useRef(null), overview = useRef(null)
  const snapper = useMemo(() => createSnapper({ grid: 0.1 }), [])
  useEffect(() => {
    if (!view || !player || view.getViewport().disposed) return
    const timeline = mountTimeline(ruler.current, { view })
    const minimap = mountMinimap(overview.current, { view, player })
    return () => { minimap.dispose(); timeline.dispose() }
  }, [view, player])
  function travel(transform) {
    setState(current => {
      const next = transform(current.history)
      return next === current.history ? current : { history: next, revision: current.revision + 1 }
    })
  }
  return <>
    <Waveform source={{ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }}
      onView={setView} onPlayer={setPlayer} onError={console.error}
      annotations={history.present} annotationsRevision={revision}
      onAnnotationsCommit={(document, change) => {
        setState(current => change.baseRevision === current.revision
          ? { history: recordHistory(current.history, document), revision: current.revision + 1 }
          : current)
      }}
      snapAnnotation={snapper} viewport={{ zoom: 150, follow: 'off' }} />
    <div ref={ruler} /><div ref={overview} />
    <button disabled={!history.past.length} onClick={() => travel(undoHistory)}>Undo</button>
    <button disabled={!history.future.length} onClick={() => travel(redoHistory)}>Redo</button>
  </>
}`;
  return `import { createPlayer, createAnnotations, mountWaveform } from 'raavl'
${imports}

// HTML: #waveform, #timeline, #minimap containers and #undo / #redo buttons.
const player = createPlayer()
const annotations = createAnnotations({ document: {
  version: 1, sourceId: 'demo-a', regions: [{ id: 'intro', start: 1, end: 3, label: 'Opening' }], markers: [{ id: 'cue', time: 8 }],
} })
let history = createHistory(annotations.getSnapshot().document)
let restoring = false
const off = annotations.onCommit(document => {
  if (!restoring) history = recordHistory(history, document)
})
const view = mountWaveform(document.querySelector('#waveform'), {
  player, annotations, viewport: { zoom: 150, follow: 'off' },
  snapAnnotation: createSnapper({ grid: 0.1 }),
})
const timeline = mountTimeline(document.querySelector('#timeline'), { view })
const minimap = mountMinimap(document.querySelector('#minimap'), { view, player })
function travel(transform) {
  const next = transform(history)
  if (next === history) return
  restoring = true
  try { annotations.replaceDocument(next.present); history = next }
  finally { restoring = false }
}
document.querySelector('#undo').onclick = () => travel(undoHistory)
document.querySelector('#redo').onclick = () => travel(redoHistory)
player.setSource({ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }).catch(console.error)
// On teardown: minimap.dispose(); timeline.dispose(); view.dispose();
// off(); annotations.dispose(); player.dispose(); remove button handlers.`;
}
