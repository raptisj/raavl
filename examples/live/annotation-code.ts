import { annotationDocument, annotationStyles } from "./annotation-example";
import type { CodeMode } from "./snippets";
import { exampleThemeCss, stylesheetCode } from "./example-theme";

export type AnnotationCodeOptions = {
  zoom?: number | "fit" | "auto";
  snap?: number;
  editorLayout?: "inline" | "modal";
};

export function annotationCode(mode: CodeMode, options: AnnotationCodeOptions = {}, dark = false) {
  const initial = JSON.stringify(annotationDocument, null, 2);
  const viewport = JSON.stringify({ zoom: options.zoom ?? "auto" });
  const rules = JSON.stringify({ snap: options.snap ?? 0.1, minLength: 0.1 });
  const styles = stylesheetCode(annotationStyles + exampleThemeCss(dark));
  if (mode === "react") return `import { useEffect, useRef, useState } from 'react'
import { createAnnotations } from 'raavl'
import type { AnnotationDocument, AnnotationStore, Player, Source, WaveformView } from 'raavl'
import { Waveform, PlayerRoot, ActionsToolbar, useAnnotations } from 'raavl/react'
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
  const document = snapshot?.document
  const selected = document && [...document.regions, ...document.markers].find(item => item.id === selectedId)
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
      annotationStore={store ?? undefined} annotationEditor=${options.editorLayout === "modal" ? '"modal"' : "{true}"}
      onAnnotationSelect={setSelectedId}
      renderRegionLabel={region => <strong>◆ {region.label || region.id}</strong>}
      aria-label="Editable recording" />
    <PlayerRoot player={player} onError={report}>
      <ActionsToolbar range={selected && 'start' in selected ? selected : null}
        sourceId={document?.sourceId ?? null}
        onCreateRegion={time => view.current?.createRegionAtTime(time)} />
    </PlayerRoot>
    {error && <p role="alert" className="error">{error}</p>}
  </div>
}`;

  return `import { createPlayer, createAnnotations, mountWaveform, mountActionsToolbar } from 'raavl'
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
  <div data-actions></div>
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
const toolbar = mountActionsToolbar(find('[data-actions]'), { player, onError: report,
  onCreateRegion: time => view.createRegionAtTime(time) })
function render() {
  const item = selected()
  toolbar.update({ range: item && 'start' in item ? item : null,
    sourceId: annotations.getSnapshot().document.sourceId })
  const state = player.getSnapshot()
  if (state.error || state.waveformError) report(state.error ?? state.waveformError)
}
const view = mountWaveform(find('[data-waveform]'), {
  player, annotations, annotationEditor: ${options.editorLayout === "modal" ? '"modal"' : "true"},
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
const off = player.subscribe(render)
const offAnnotations = annotations.subscribe(render)
render()
await player.setSource({ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }).catch(report)

// Call when removing the app.
function dispose() {
  toolbar.dispose(); offAnnotations(); off()
  view.dispose(); player.dispose(); annotations.dispose()
  host.replaceChildren()
}`;
}
