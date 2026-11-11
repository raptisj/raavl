import { modulesDocument } from "./modules-example";
import { annotationStyles } from "./annotation-example";
import { exampleThemeCss, stylesheetCode } from "./example-theme";
import type { CodeMode, ExampleCodeOptions } from "./snippets";

export function modulesCode(mode: CodeMode, options: ExampleCodeOptions["modules"], dark = false) {
  const initial = JSON.stringify(modulesDocument, null, 2);
  const viewport = JSON.stringify({ zoom: options?.zoom ?? 150 });
  const snapper = options?.magnetic === false ? "undefined" : "createSnapper({ grid: 0.1, tolerancePixels: 10, playhead: () => player?.getCurrentTime() ?? null })";
  const css = stylesheetCode(annotationStyles + exampleThemeCss(dark));
  const imports = `import { mountTimeline } from 'raavl/timeline'
import { mountMinimap } from 'raavl/minimap'
import { createSnapper } from 'raavl/snapping'
import { createHistory, recordHistory, undoHistory, redoHistory } from 'raavl/history'
import 'raavl/styles.css'`;
  if (mode === "react") return `import { useEffect, useMemo, useRef, useState } from 'react'
import { createAnnotations } from 'raavl'
import type { AnnotationDocument, AnnotationStore, Player, Selection, WaveformView } from 'raavl'
import { Waveform, usePlayerState } from 'raavl/react'
${imports}

const initial: AnnotationDocument = ${initial}
const source = { kind: 'url' as const, id: 'demo-a', url: '/demo-a.wav' }
${css}

export default function Editor() {
  const [store, setStore] = useState<AnnotationStore | null>(null)
  const [history, setHistory] = useState(() => createHistory(initial, { limit: 50 }))
  const historyRef = useRef(history)
  const restoring = useRef(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [view, setView] = useState<WaveformView | null>(null)
  const activeView = useRef<WaveformView | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [error, setError] = useState('')
  const ruler = useRef<HTMLDivElement>(null)
  const overview = useRef<HTMLDivElement>(null)
  const snapper = useMemo(() => ${snapper}, [player])
  const ready = usePlayerState(player, state => state?.source === 'ready')
  const playing = usePlayerState(player, state => state?.playback === 'playing')
  const report = (error: Error) => setError(error.message)
  function accept(next: typeof history) { historyRef.current = next; setHistory(next) }
  useEffect(() => {
    const annotations = createAnnotations({ document: initial })
    const off = annotations.onCommit(document => {
      if (!restoring.current) accept(recordHistory(historyRef.current, document))
    })
    setStore(annotations)
    return () => {
      activeView.current?.update({ annotations: null })
      off(); annotations.dispose()
    }
  }, [])
  useEffect(() => {
    if (!view || !player || view.getViewport().disposed) return
    const timeline = mountTimeline(ruler.current!, { view })
    const minimap = mountMinimap(overview.current!, { view, player })
    return () => { minimap.dispose(); timeline.dispose() }
  }, [view, player])
  function run(operation: () => void) {
    try { setError(''); operation() }
    catch (error) { report(error as Error) }
  }
  function travel(direction: 'undo' | 'redo') {
    run(() => {
      if (!store) return
      const next = direction === 'undo' ? undoHistory(historyRef.current) : redoHistory(historyRef.current)
      if (next === historyRef.current) return
      restoring.current = true
      try { store.replaceDocument(next.present); accept(next) }
      finally { restoring.current = false }
    })
  }
  return <div className="example-app annotation-app">
    <style>{css}</style>
    <Waveform source={source} onPlayer={setPlayer} onError={report}
      onView={instance => { activeView.current = instance; setView(instance) }}
      annotationStore={store ?? undefined} viewport={${viewport}}
      interaction={{ drag: 'select' }} annotationRules={{ snap: 0.1 }}
      snapAnnotation={snapper} onSelectionChange={setSelection} />
    <div ref={ruler} /><div ref={overview} />
    <div className="transport">
      <button disabled={!ready} onClick={() => {
        if (!player) return
        if (playing) player.pause()
        else void player.play().catch(report)
      }}>{playing ? 'Pause' : 'Play'}</button>
      <button disabled={!selection} onClick={() => run(() => {
        view?.createRegionFromSelection(crypto.randomUUID(), 'New phrase')
      })}>Create selected region</button>
      <button disabled={!ready} onClick={() => run(() => {
        if (player) store?.addMarker({ id: crypto.randomUUID(), time: player.getCurrentTime(), label: 'New cue' })
      })}>Add marker at playhead</button>
      <button disabled={!history.past.length} onClick={() => travel('undo')}>Undo</button>
      <button disabled={!history.future.length} onClick={() => travel('redo')}>Redo</button>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}`;
  return `import { createPlayer, createAnnotations, mountWaveform } from 'raavl'
${imports}

// HTML: <div id="editor"></div>
const initial = ${initial}
${css}
const host = document.querySelector('#editor')
host.className = 'example-app annotation-app'
const style = document.createElement('style')
style.textContent = css
host.append(style)
host.insertAdjacentHTML('beforeend', \`
  <div data-waveform></div><div data-timeline></div><div data-minimap></div>
  <div class="transport">
    <button data-play disabled>Play</button>
    <button data-create disabled>Create selected region</button>
    <button data-marker disabled>Add marker at playhead</button>
    <button data-undo disabled>Undo</button><button data-redo disabled>Redo</button>
  </div>
  <p role="alert" class="error"></p>
\`)
const find = selector => host.querySelector(selector)
const player = createPlayer()
const annotations = createAnnotations({ document: initial })
let history = createHistory(initial, { limit: 50 })
let restoring = false
let selection = null
function report(error) { find('.error').textContent = error.message }
function run(operation) {
  try { find('.error').textContent = ''; operation() }
  catch (error) { report(error) }
}
function render() {
  const state = player.getSnapshot()
  find('[data-play]').disabled = find('[data-marker]').disabled = state.source !== 'ready'
  find('[data-play]').textContent = state.playback === 'playing' ? 'Pause' : 'Play'
  find('[data-create]').disabled = !selection
  find('[data-undo]').disabled = !history.past.length
  find('[data-redo]').disabled = !history.future.length
  if (state.error || state.waveformError) report(state.error ?? state.waveformError)
}
const offAnnotations = annotations.onCommit(document => {
  if (!restoring) history = recordHistory(history, document)
  render()
})
const view = mountWaveform(find('[data-waveform]'), {
  player, annotations, viewport: ${viewport},
  interaction: { drag: 'select' }, annotationRules: { snap: 0.1 },
  snapAnnotation: ${snapper},
  onSelectionChange(value) { selection = value; render() },
  onAnnotationError: report,
})
const timeline = mountTimeline(find('[data-timeline]'), { view })
const minimap = mountMinimap(find('[data-minimap]'), { view, player })
function travel(direction) {
  run(() => {
    const next = direction === 'undo' ? undoHistory(history) : redoHistory(history)
    if (next === history) return
    restoring = true
    try { annotations.replaceDocument(next.present); history = next }
    finally { restoring = false }
    render()
  })
}
find('[data-play]').onclick = () => {
  if (player.getSnapshot().playback === 'playing') player.pause()
  else player.play().catch(report)
}
find('[data-create]').onclick = () => run(() => view.createRegionFromSelection(crypto.randomUUID(), 'New phrase'))
find('[data-marker]').onclick = () => run(() => annotations.addMarker({ id: crypto.randomUUID(), time: player.getCurrentTime(), label: 'New cue' }))
find('[data-undo]').onclick = () => travel('undo')
find('[data-redo]').onclick = () => travel('redo')
const off = player.subscribe(render)
render()
await player.setSource({ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }).catch(report)

// Call when removing the app.
function dispose() {
  off(); offAnnotations(); minimap.dispose(); timeline.dispose()
  view.dispose(); player.dispose(); annotations.dispose()
  host.replaceChildren()
}`;
}
