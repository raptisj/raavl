import { useEffect, useRef, useState } from 'react'
import { mountWaveform, type WaveformView, type WaveformData } from 'raavl'
import { createAnnotations, type AnnotationStore } from 'raavl/regions'
import { usePageTheme } from './usePageTheme'
import { Preview } from './Preview'
import { DemoSettings } from './DemoSettings'
import type { ExampleCodeOptions } from './snippets'

// A deterministic long-duration fixture, not a downloaded or decoded audio file.
function fixture(): WaveformData {
  const count = 720000
  return { version: 1, sourceId: 'scale', duration: 7200, channels: [0, 1].map(channel => {
    const min = new Float32Array(count), max = new Float32Array(count)
    for (let i = 0; i < count; i++) { const amplitude = .1 + .8 * Math.abs(Math.sin(i * .017 + channel)); min[i] = -amplitude; max[i] = amplitude }
    return { min, max }
  }) }
}
export function ScaleLab({ onOptionsChange }: { onOptionsChange?: (options: ExampleCodeOptions) => void } = {}) {
  const pageTheme = usePageTheme()
  const host = useRef<HTMLDivElement>(null), view = useRef<WaveformView | null>(null)
  const store = useRef<AnnotationStore | null>(null), pending = useRef<(() => void) | null>(null), alive = useRef(false)
  const [report, setReport] = useState('Choose Run benchmark to collect timings in this browser.')
  const [busy, setBusy] = useState(false), [zoom, setZoom] = useState('100'), [dense, setDense] = useState(true)
  const [selected, setSelected] = useState('None')
  useEffect(() => { onOptionsChange?.({ scale: { zoom: zoom === 'fit' ? 'fit' : Number(zoom), dense } }) }, [zoom, dense, onOptionsChange])
  useEffect(() => {
    alive.current = true
    store.current = createAnnotations({ document: { version: 1, sourceId: 'scale', regions: Array.from({ length: 10000 }, (_, i) => ({ id: `region-${i}`, label: `Phrase ${i + 1}`, start: i * .72, end: i * .72 + .5 })), markers: [] } })
    view.current = mountWaveform(host.current!, { data: fixture(), annotations: store.current, viewport: { zoom: 100 }, onAnnotationSelect: id => setSelected(id ?? 'None'), onDraw: () => { pending.current?.(); pending.current = null } })
    return () => { alive.current = false; pending.current?.(); pending.current = null; view.current?.dispose(); view.current = null; store.current?.dispose(); store.current = null }
  }, [])
  useEffect(() => { view.current?.update({ viewport: { zoom: zoom === 'fit' ? 'fit' : Number(zoom) }, annotations: dense ? store.current : null }) }, [zoom, dense])
  useEffect(() => { view.current?.refreshTheme() }, [pageTheme])
  async function run() {
    setBusy(true)
    const samples: number[] = []
    for (let i = 0; i < 31 && alive.current; i++) {
      const start = performance.now()
      await new Promise<void>(resolve => { pending.current = resolve; view.current!.refreshTheme() })
      if (i) samples.push(performance.now() - start)
    }
    if (!alive.current) return
    samples.sort((a, b) => a - b)
    const canvases = [...host.current!.querySelectorAll('canvas')]
    setReport(JSON.stringify({ fixture: '2 hours, stereo, 100 buckets/sec, 10000 regions', samples: samples.length, redrawLatencyMs: { p50: samples[14], p95: samples[28], max: samples[29] }, zoom, annotations: dense, overlays: host.current!.querySelectorAll('.raavl-region').length, listRows: host.current!.querySelectorAll('li').length, peakBytes: 11520000, canvasBackingBytes: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0), viewportWidth: host.current!.clientWidth, dpr: devicePixelRatio, userAgent: navigator.userAgent }, null, 2))
    setBusy(false)
  }
  return <article className="player-card">
    <h3>Two-hour waveform · 10,000 editable regions</h3>
    <p className="helper">This uses the actual vanilla rendering engine, shared by the React adapter. Synthetic supplied peaks use 11.52 MB; no two-hour audio is downloaded or decoded.</p>
    <Preview><div ref={host} /></Preview>
    <DemoSettings summary="Benchmark">
      <div className="view-settings">
        <label>Scale zoom <select value={zoom} disabled={busy} onChange={e => setZoom(e.target.value)}><option value="fit">Fit two hours</option><option value="100">100 px / sec</option><option value="300">300 px / sec</option></select></label>
        <label><input type="checkbox" checked={dense} disabled={busy} onChange={e => setDense(e.target.checked)} />Show 10,000 regions</label>
        <button disabled={busy} onClick={() => void run()}>{busy ? 'Measuring…' : 'Run benchmark'}</button>
      </div>
      <p>Scroll horizontally, resize a region, or use the paginated list. Selected: {selected}. Fit with regions intentionally displays all 10,000 overlays and may be slow.</p>
      <details open><summary>Benchmark report</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} aria-live="polite">{report}</pre></details>
      <p>Redraw latency includes waiting for the next animation frame. It is not CPU-only drawing time or a heap measurement. Run in a foreground tab.</p>
    </DemoSettings>
  </article>
}
