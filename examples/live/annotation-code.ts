import { annotationDocument, annotationStyles } from "./annotation-example";
import type { CodeMode } from "./snippets";
import { exampleThemeCss, stylesheetCode } from "./example-theme";

export type AnnotationCodeOptions = {
  zoom?: number | "fit";
  snap?: number;
};

export function annotationCode(mode: CodeMode, options: AnnotationCodeOptions = {}, dark = false) {
  const initial = JSON.stringify(annotationDocument, null, 2);
  const viewport = JSON.stringify({ zoom: options.zoom ?? "fit" });
  const rules = JSON.stringify({ snap: options.snap ?? 0.1, minLength: 0.1 });
  const styles = stylesheetCode(annotationStyles + exampleThemeCss(dark));
  if (mode === "react") return `import { useEffect, useRef, useState } from 'react'
import { createAnnotations } from 'raavl'
import type { AnnotationDocument, AnnotationStore, Player, Source, WaveformView } from 'raavl'
import { Waveform, useAnnotations, usePlayerState, usePlayerTime } from 'raavl/react'
import 'raavl/styles.css'

const initial: AnnotationDocument = ${initial}
const source: Source = { kind: 'url', id: 'demo-a', url: '/demo-a.wav' }
${styles}

export default function AnnotationApp() {
  const [store, setStore] = useState<AnnotationStore | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const view = useRef<WaveformView | null>(null)
  const snapshot = useAnnotations(store)
  const ready = usePlayerState(player, state => state?.source === 'ready')
  const playing = usePlayerState(player, state => state?.playback === 'playing')
  const time = usePlayerTime(player)
  const document = snapshot?.document
  const selected = document && [...document.regions, ...document.markers].find(item => item.id === selectedId)
  const enabled = ready && document?.sourceId === source.id
  const report = (error: Error) => setError(error.message)

  useEffect(() => {
    const annotations = createAnnotations({ document: initial })
    setStore(annotations)
    return () => {
      view.current?.update({ annotations: null })
      annotations.dispose()
    }
  }, [])
  return <div className="example-app annotation-app">
    <style>{css}</style>
    <Waveform source={source} onPlayer={setPlayer} onError={report}
      onView={instance => { view.current = instance }}
      appearance={{ style: 'bars', height: 200 }} viewport={${viewport}}
      interaction={{ drag: 'select' }} annotationRules={${rules}}
      annotationStore={store ?? undefined} annotationEditor
      onAnnotationSelect={setSelectedId}
      renderRegionLabel={region => <strong>◆ {region.label || region.id}</strong>}
      aria-label="Editable recording" />
    <div className="transport">
      <button className="primary" disabled={!ready} onClick={() => {
        if (!player) return
        if (playing) player.pause()
        else void player.play().catch(report)
      }}>{playing ? 'Pause' : 'Play'}</button>
      <button disabled={!enabled || !selected || !('start' in selected)} onClick={() => {
        if (player && selected && 'start' in selected) void player.playRange(selected).catch(report)
      }}>Play region</button>
      <button disabled={!enabled || !selected || !('start' in selected)} onClick={() => {
        if (player && selected && 'start' in selected) void player.playRange({ ...selected, loop: true }).catch(report)
      }}>Loop region</button>
      <span className="clock">{time.toFixed(2)}s</span>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}`;

  return `import { createPlayer, createAnnotations, mountWaveform } from 'raavl'
import 'raavl/styles.css'

// HTML: <div id="annotations"></div>
const initial = ${initial}
${styles}
const style = document.createElement('style')
style.textContent = css
const host = document.querySelector('#annotations')
host.className = 'example-app annotation-app'
host.append(style)
host.insertAdjacentHTML('beforeend', \`
  <div data-waveform></div>
  <div class="transport">
    <button data-play class="primary" disabled>Play</button>
    <button data-play-region disabled>Play region</button>
    <button data-loop-region disabled>Loop region</button>
    <span class="clock">0.00s</span>
  </div>
  <p role="alert" class="error"></p>
\`)
const find = selector => host.querySelector(selector)
const player = createPlayer()
const annotations = createAnnotations({ document: initial })
let selectedId = null
const selected = () => {
  const { regions, markers } = annotations.getSnapshot().document
  return [...regions, ...markers].find(item => item.id === selectedId)
}
function report(error) { find('.error').textContent = error.message }
function render() {
  const state = player.getSnapshot()
  const item = selected()
  const ready = state.source === 'ready'
  const enabled = ready && state.sourceId === annotations.getSnapshot().document.sourceId
  find('[data-play]').disabled = !ready
  find('[data-play]').textContent = state.playback === 'playing' ? 'Pause' : 'Play'
  find('[data-play-region]').disabled = find('[data-loop-region]').disabled = !enabled || !item || !('start' in item)
  if (state.error || state.waveformError) report(state.error ?? state.waveformError)
}
const view = mountWaveform(find('[data-waveform]'), {
  player, annotations, annotationEditor: true,
  appearance: { style: 'bars', height: 200 }, viewport: ${viewport},
  interaction: { drag: 'select' }, annotationRules: ${rules},
  renderRegionLabel(region) {
    const label = document.createElement('strong')
    label.textContent = '◆ ' + (region.label || region.id)
    return label
  },
  onAnnotationSelect(id) { selectedId = id; render() },
  onAnnotationError: report,
  label: 'Editable recording',
})
find('[data-play]').onclick = () => {
  if (player.getSnapshot().playback === 'playing') player.pause()
  else player.play().catch(report)
}
find('[data-play-region]').onclick = () => player.playRange(selected()).catch(report)
find('[data-loop-region]').onclick = () => player.playRange({ ...selected(), loop: true }).catch(report)
const off = player.subscribe(render)
const offAnnotations = annotations.subscribe(render)
const offTime = player.subscribeTime(() => {
  find('.clock').textContent = player.getCurrentTime().toFixed(2) + 's'
})
render()
await player.setSource({ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }).catch(report)

// Call when removing the app.
function dispose() {
  offTime(); offAnnotations(); off()
  view.dispose(); player.dispose(); annotations.dispose()
  host.replaceChildren()
}`;
}
