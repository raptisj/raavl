import { failure, finite } from '../core/data'
import type { WaveformView } from '../dom'
export type TimelineOptions = { view: WaveformView; minSpacing?: number; formatTime?: (seconds: number) => string }
export function formatTime(seconds: number): string {
  const rounded = Math.round(seconds * 1000) / 1000
  const hours = Math.floor(rounded / 3600), minutes = Math.floor(rounded / 60) % 60
  const remainder = (rounded % 60).toFixed(3).replace(/\.?0+$/, '') || '0'
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : Math.floor(rounded / 60)}:${remainder.padStart(remainder.includes('.') ? 3 + remainder.split('.')[1].length : 2, '0')}`
}
/** A light-DOM ruler, bounded by viewport width rather than recording duration. */
export function mountTimeline(container: HTMLElement, options: TimelineOptions) {
  if (options.view.getViewport().disposed) throw failure('DISPOSED', 'view', 'Cannot attach a timeline to a disposed view')
  const spacing = finite(options.minSpacing ?? 80, 'Timeline spacing', 16, 1000)
  const root = document.createElement('div')
  root.className = 'ravl-timeline'
  root.setAttribute('aria-hidden', 'true') // Time is exposed by the waveform and minimap controls.
  Object.assign(root.style, { position: 'relative', height: '28px', overflow: 'hidden' })
  container.append(root)
  let disposed = false
  function render() {
    if (disposed) return
    const state = options.view.getViewport()
    root.replaceChildren()
    if (state.disposed || !state.duration || !state.pixelsPerSecond) return
    const desired = spacing / state.pixelsPerSecond
    const base = 10 ** Math.floor(Math.log10(desired))
    const step = [1, 2, 5, 10].find(value => value * base >= desired)! * base
    const first = Math.ceil(state.start / step)
    const count = Math.min(Math.ceil(state.width / spacing) + 2, 10000)
    for (let i = 0; i < count; i++) {
      const time = (first + i) * step
      if (time > state.end) break
      const tick = document.createElement('span')
      tick.className = 'ravl-timeline-tick'
      tick.dataset.time = String(time)
      tick.textContent = (options.formatTime ?? formatTime)(time)
      Object.assign(tick.style, { position: 'absolute', left: `${(time - state.start) * state.pixelsPerSecond}px`, whiteSpace: 'nowrap' })
      root.append(tick)
    }
  }
  const off = options.view.subscribeViewport(render)
  render()
  return { dispose() { if (disposed) return; disposed = true; off(); root.remove() } }
}
