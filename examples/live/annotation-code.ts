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
import type { AnnotationDocument, AnnotationStore, Player, Selection, Source, WaveformView } from 'raavl'
import { Waveform, useAnnotations, usePlayerState, usePlayerTime } from 'raavl/react'
import 'raavl/styles.css'

const initial: AnnotationDocument = ${initial}
const source: Source = { kind: 'url', id: 'demo-a', url: '/demo-a.wav' }
${styles}

export default function AnnotationApp() {
  const [store, setStore] = useState<AnnotationStore | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [label, setLabel] = useState('New annotation')
  const [start, setStart] = useState('0')
  const [end, setEnd] = useState('1')
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
  useEffect(() => {
    if (!selected) return
    setLabel(selected.label ?? '')
    setStart(String('start' in selected ? selected.start : selected.time))
    setEnd(String('end' in selected ? selected.end : 0))
  }, [selected])

  function edit(operation: (store: AnnotationStore) => void) {
    if (!enabled || !store) return
    try { setError(''); operation(store) }
    catch (error) { report(error as Error) }
  }
  function apply() {
    if (!selected) return
    edit(store => {
      if ('start' in selected) store.updateRegion(selected.id, { label, start: Number(start), end: Number(end) })
      else store.updateMarker(selected.id, { label, time: Number(start) })
    })
  }
  function lock() {
    if (!selected) return
    edit(store => {
      const patch = { locked: !selected.locked }
      if ('start' in selected) store.updateRegion(selected.id, patch)
      else store.updateMarker(selected.id, patch)
    })
  }

  return <div className="example-app annotation-app">
    <style>{css}</style>
    <Waveform source={source} onPlayer={setPlayer} onError={report}
      onView={instance => { view.current = instance }}
      appearance={{ style: 'bars', height: 200 }} viewport={${viewport}}
      interaction={{ drag: 'select' }} annotationRules={${rules}}
      annotationStore={store ?? undefined}
      onSelectionChange={setSelection} onAnnotationSelect={setSelectedId}
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
    <fieldset disabled={!enabled} className="annotation-fields">
      <legend>Annotations</legend>
      <p className="helper">{selection
        ? 'Selection: ' + selection.start.toFixed(2) + '–' + selection.end.toFixed(2) + 's'
        : selected ? 'Selected: ' + (selected.label || selected.id)
        : 'Drag to select a range, or choose an annotation to edit or delete.'}</p>
      <label>{selected ? 'Label' : 'New annotation label'}
        <input value={label} onChange={event => setLabel(event.target.value)} />
      </label>
      {selected && <>
        <label>{'start' in selected ? 'Start (seconds)' : 'Time (seconds)'}
          <input type="number" min="0" step="0.1" value={start} onChange={event => setStart(event.target.value)} />
        </label>
        {'end' in selected && <label>End (seconds)
          <input type="number" min="0" step="0.1" value={end} onChange={event => setEnd(event.target.value)} />
        </label>}
      </>}
      <div className="editor-actions">
        <button disabled={!selection} onClick={() => edit(store => {
          if (selection) store.addRegion({ id: crypto.randomUUID(), ...selection, label })
        })}>Create region from selection</button>
        <button onClick={() => edit(store => {
          if (player) store.addMarker({ id: crypto.randomUUID(), time: player.getCurrentTime(), label })
        })}>Add marker at playhead</button>
        <button disabled={!selected} onClick={apply}>Apply edit</button>
        <button disabled={!selected} onClick={lock}>{selected?.locked ? 'Unlock' : 'Lock'}</button>
        <button disabled={!selected || selected.locked} onClick={() => edit(store => {
          if (selected) store.remove(selected.id)
        })}>Delete annotation</button>
      </div>
    </fieldset>
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
  <fieldset class="annotation-fields" disabled>
    <legend>Annotations</legend>
    <p class="helper"></p>
    <label><span data-label-name>New annotation label</span><input data-label value="New annotation"></label>
    <label data-start-label hidden><span></span><input data-start type="number" min="0" step="0.1"></label>
    <label data-end-label hidden>End (seconds)<input data-end type="number" min="0" step="0.1"></label>
    <div class="editor-actions">
      <button data-add-region disabled>Create region from selection</button>
      <button data-add-marker>Add marker at playhead</button>
      <button data-apply disabled>Apply edit</button>
      <button data-lock disabled>Lock</button>
      <button data-delete disabled>Delete annotation</button>
    </div>
  </fieldset>
  <p role="alert" class="error"></p>
\`)
const find = selector => host.querySelector(selector)
const player = createPlayer()
const annotations = createAnnotations({ document: initial })
let selection = null
let selectedId = null
let previousSelected
const selected = () => {
  const { regions, markers } = annotations.getSnapshot().document
  return [...regions, ...markers].find(item => item.id === selectedId)
}
function report(error) { find('.error').textContent = error.message }
function edit(operation) {
  try { find('.error').textContent = ''; operation() }
  catch (error) { report(error) }
}
function render() {
  const state = player.getSnapshot()
  const item = selected()
  const ready = state.source === 'ready'
  const enabled = ready && state.sourceId === annotations.getSnapshot().document.sourceId
  find('[data-play]').disabled = !ready
  find('[data-play]').textContent = state.playback === 'playing' ? 'Pause' : 'Play'
  find('[data-play-region]').disabled = find('[data-loop-region]').disabled = !enabled || !item || !('start' in item)
  find('fieldset').disabled = !enabled
  find('[data-add-region]').disabled = !selection
  find('[data-apply]').disabled = find('[data-lock]').disabled = !item
  find('[data-delete]').disabled = !item || item.locked
  find('[data-lock]').textContent = item?.locked ? 'Unlock' : 'Lock'
  find('[data-label-name]').textContent = item ? 'Label' : 'New annotation label'
  find('.helper').textContent = selection
    ? 'Selection: ' + selection.start.toFixed(2) + '–' + selection.end.toFixed(2) + 's'
    : item ? 'Selected: ' + (item.label || item.id)
    : 'Drag to select a range, or choose an annotation to edit or delete.'
  find('[data-start-label]').hidden = !item
  find('[data-end-label]').hidden = !item || !('end' in item)
  if (item && item !== previousSelected) {
    find('[data-label]').value = item.label ?? ''
    find('[data-start]').value = 'start' in item ? item.start : item.time
    find('[data-end]').value = 'end' in item ? item.end : 0
    find('[data-start-label] span').textContent = 'start' in item ? 'Start (seconds)' : 'Time (seconds)'
  }
  previousSelected = item
  if (state.error || state.waveformError) report(state.error ?? state.waveformError)
}
const view = mountWaveform(find('[data-waveform]'), {
  player, annotations,
  appearance: { style: 'bars', height: 200 }, viewport: ${viewport},
  interaction: { drag: 'select' }, annotationRules: ${rules},
  renderRegionLabel(region) {
    const label = document.createElement('strong')
    label.textContent = '◆ ' + (region.label || region.id)
    return label
  },
  onSelectionChange(value) { selection = value; render() },
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
find('[data-add-region]').onclick = () => edit(() => {
  annotations.addRegion({ id: crypto.randomUUID(), ...selection, label: find('[data-label]').value })
})
find('[data-add-marker]').onclick = () => edit(() => {
  annotations.addMarker({ id: crypto.randomUUID(), time: player.getCurrentTime(), label: find('[data-label]').value })
})
find('[data-apply]').onclick = () => edit(() => {
  const item = selected()
  const label = find('[data-label]').value
  const start = Number(find('[data-start]').value)
  if ('start' in item) annotations.updateRegion(item.id, { label, start, end: Number(find('[data-end]').value) })
  else annotations.updateMarker(item.id, { label, time: start })
})
find('[data-lock]').onclick = () => edit(() => {
  const item = selected()
  const patch = { locked: !item.locked }
  if ('start' in item) annotations.updateRegion(item.id, patch)
  else annotations.updateMarker(item.id, patch)
})
find('[data-delete]').onclick = () => edit(() => annotations.remove(selectedId))
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
