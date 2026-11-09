import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPlayer, createAnnotations, mountWaveform, type Player, type WaveformView, type AnnotationStore, type AnnotationSnapper, type Selection } from '../../src'
import { Waveform, useAnnotations, usePlayerState } from '../../src/react'
import { mountTimeline } from '../../src/timeline'
import { mountMinimap } from '../../src/minimap'
import { createSnapper } from '../../src/snapping'
import { createHistory, recordHistory, undoHistory, redoHistory } from '../../src/history'
import { usePageTheme } from './usePageTheme'

const initial = { version: 1 as const, sourceId: 'demo-a', regions: [{ id: 'intro', start: 1, end: 3, label: 'Opening' }, { id: 'phrase', start: 5, end: 7, label: 'Phrase' }], markers: [{ id: 'cue', time: 8, label: 'Snap target' }] }
function Vanilla({ player, store, zoom, snapper, onView, onSelection, report }: { player: Player; store: AnnotationStore; zoom: number | 'fit'; snapper?: AnnotationSnapper; onView: (view: WaveformView | null) => void; onSelection: (selection: Selection) => void; report: (error: Error) => void }) {
  const pageTheme = usePageTheme()
  const host = useRef<HTMLDivElement>(null), view = useRef<WaveformView | null>(null)
  useEffect(() => {
    const mounted = mountWaveform(host.current!, { player, annotations: store, interaction: { drag: 'select' }, onSelectionChange: onSelection, onAnnotationError: report })
    view.current = mounted; onView(mounted)
    return () => { onView(null); mounted.dispose(); view.current = null }
  }, [player, store, onView, onSelection, report])
  useEffect(() => { view.current?.update({ viewport: { zoom, follow: 'off' }, snapAnnotation: snapper, annotationRules: { snap: .1 } }) }, [zoom, snapper])
  useEffect(() => { view.current?.refreshTheme() }, [pageTheme])
  return <div ref={host} />
}
function Accessories({ view, player }: { view: WaveformView | null; player: Player }) {
  const pageTheme = usePageTheme()
  const timeline = useRef<HTMLDivElement>(null), minimap = useRef<HTMLDivElement>(null)
  const overview = useRef<ReturnType<typeof mountMinimap> | null>(null)
  useEffect(() => {
    if (!view || view.getViewport().disposed) return
    const ruler = mountTimeline(timeline.current!, { view })
    const mounted = mountMinimap(minimap.current!, { view, player })
    overview.current = mounted
    return () => { overview.current = null; mounted.dispose(); ruler.dispose() }
  }, [view, player])
  useEffect(() => { overview.current?.refreshTheme() }, [pageTheme])
  return <><div ref={timeline} /><p className="helper">Overview: drag to pan · arrows move the window · Shift moves a full window · Home / End</p><div ref={minimap} /></>
}
export function ModulesEditor({ mode }: { mode: 'vanilla' | 'react' }) {
  const pageTheme = usePageTheme()
  const [resources, setResources] = useState<{ player: Player; store: AnnotationStore } | null>(null)
  const [view, setView] = useState<WaveformView | null>(null), activeView = useRef<WaveformView | null>(null)
  const onView = useCallback((value: WaveformView | null) => { activeView.current = value; setView(value) }, [])
  const [history, setHistory] = useState(() => createHistory(initial, { limit: 50 })), historyRef = useRef(history), restoring = useRef(false)
  const [zoom, setZoom] = useState<number | 'fit'>(150), [magnetic, setMagnetic] = useState(true)
  const [selection, setSelection] = useState<Selection>(null), [error, setError] = useState('')
  const report = useCallback((value: Error) => setError(value.message), [])
  const accept = useCallback((value: typeof history) => { historyRef.current = value; setHistory(value) }, [])
  useEffect(() => {
    const player = createPlayer(), store = createAnnotations({ document: initial })
    accept(createHistory(initial, { limit: 50 }))
    const off = store.onCommit(document => { if (!restoring.current) accept(recordHistory(historyRef.current, document)) })
    const offPlayer = player.subscribe(() => { const state = player.getSnapshot(); if (state.error || state.waveformError) report((state.error ?? state.waveformError)!) })
    setResources({ player, store })
    void player.setSource({ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }).catch(error => { if (error.code !== 'CANCELLED') report(error) })
    return () => { activeView.current?.update({ annotations: null }); off(); offPlayer(); player.dispose(); store.dispose() }
  }, [accept, report])
  const player = resources?.player ?? null, store = resources?.store ?? null
  const snapshot = useAnnotations(store), playback = usePlayerState(player, state => state?.playback), ready = usePlayerState(player, state => state?.source === 'ready')
  const snapper = useMemo(() => magnetic ? createSnapper({ grid: .1, tolerancePixels: 10, playhead: () => player?.getCurrentTime() ?? null }) : undefined, [magnetic, player])
  const run = (action: () => void) => { try { setError(''); action() } catch (error) { report(error as Error) } }
  const restore = (direction: 'undo' | 'redo') => run(() => {
    const next = (direction === 'undo' ? undoHistory : redoHistory)(historyRef.current)
    if (next === historyRef.current) return
    restoring.current = true
    try { store!.replaceDocument(next.present); accept(next) } finally { restoring.current = false }
  })
  return <article className="player-card">
    <h3>Timeline, minimap, undo/redo & magnetic snapping</h3>
    <p className="badge">{mode === 'react' ? 'React component' : 'Vanilla API'}</p>
    <p>Drag empty waveform space to select, then create a region. Move or resize labels near the cue at 8s, another region boundary, or the playhead. Each completed edit is one undo step.</p>
    <div className="view-settings">
      <label>Editor zoom <select value={zoom} onChange={e => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}><option value="fit">Fit</option><option value="150">150 px / sec</option><option value="300">300 px / sec</option></select></label>
      <label><input type="checkbox" checked={magnetic} onChange={e => setMagnetic(e.target.checked)} />Magnetic snapping (10 px)</label>
      <button disabled={!history.past.length} onClick={() => restore('undo')}>Undo</button>
      <button disabled={!history.future.length} onClick={() => restore('redo')}>Redo</button>
    </div>
    <p role="status">Undo steps: {history.past.length} · Redo steps: {history.future.length} · Source: {snapshot?.document.sourceId ?? 'loading'}</p>
    {resources && <>
      {mode === 'react' ? <Waveform player={resources.player} themeVersion={pageTheme} annotationStore={resources.store} onView={onView} viewport={{ zoom, follow: 'off' }} interaction={{ drag: 'select' }} annotationRules={{ snap: .1 }} snapAnnotation={snapper} onSelectionChange={setSelection} onError={report} /> : <Vanilla player={resources.player} store={resources.store} onView={onView} zoom={zoom} snapper={snapper} onSelection={setSelection} report={report} />}
      <Accessories view={view} player={resources.player} />
    </>}
    <div className="transport">
      <button disabled={!ready} onClick={() => playback === 'playing' ? player!.pause() : void player!.play().catch(report)}>{playback === 'playing' ? 'Pause' : 'Play'}</button>
      <button disabled={!selection} onClick={() => run(() => activeView.current!.createRegionFromSelection(crypto.randomUUID(), 'New phrase'))}>Create selected region</button>
      <button disabled={!ready} onClick={() => run(() => store!.addMarker({ id: crypto.randomUUID(), time: player!.getCurrentTime(), label: 'New cue' }))}>Add marker at playhead</button>
      <button disabled={!resources} onClick={() => run(() => store!.updateRegion('intro', { label: store!.getSnapshot().document.regions.find(r => r.id === 'intro')?.label === 'Opening' ? 'Renamed opening' : 'Opening' }))}>Rename opening</button>
      <button disabled={!ready} onClick={() => run(() => {
        const id = snapshot!.document.sourceId === 'demo-a' ? 'demo-b' : 'demo-a'
        activeView.current?.clearSelection()
        void player!.setSource({ kind: 'url', id, url: `/${id}.wav` }).catch(error => { if (error.code !== 'CANCELLED') report(error) })
        store!.replaceDocument({ ...initial, sourceId: id })
      })}>Switch source & reset history</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p className="helper">Minimap navigation changes only the visible window, not playback position. Undo restores accepted annotation documents, including labels and locks. History is bounded to 50 edits in this example.</p>
  </article>
}
