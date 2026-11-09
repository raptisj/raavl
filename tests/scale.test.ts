import { expect, it, vi } from 'vitest'
import { mountWaveform } from '../src/dom'
import { createAnnotations } from '../src/regions'

it('bounds zoomed annotation DOM and releases repeated mounts', () => {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() {}, fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} } as unknown as CanvasRenderingContext2D)
  const host = document.createElement('div'); document.body.append(host)
  const store = createAnnotations({ document: { version: 1, sourceId: 'long', regions: Array.from({ length: 10000 }, (_, i) => ({ id: `r${i}`, start: i * .72, end: i * .72 + .5 })), markers: [] } })
  const data = { version: 1 as const, sourceId: 'long', duration: 7200, channels: [{ min: new Float32Array(720000).fill(-.5), max: new Float32Array(720000).fill(.5) }] }
  let subscriptions = 0
  const subscribe = store.subscribe
  vi.spyOn(store, 'subscribe').mockImplementation(fn => { subscriptions++; const off = subscribe(fn); return () => { subscriptions--; off() } })
  let labels = 0
  const renderRegionLabel = () => { labels++; return { element: document.createElement('span'), dispose: () => { labels-- } } }
  const start = performance.now()
  const view = mountWaveform(host, { data, annotations: store, renderRegionLabel, viewport: { zoom: 100 } })
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(0)) }
  flush()
  console.log(JSON.stringify({ mountMs: performance.now() - start, overlays: host.querySelectorAll('.raavl-region').length, rows: host.querySelectorAll('li').length }))
  expect(host.querySelectorAll('.raavl-region').length).toBeLessThan(20)
  expect(host.querySelectorAll('li')).toHaveLength(100)
  const firstRow = host.querySelector('li button')
  view.refreshTheme(); flush()
  expect(host.querySelector('li button')).toBe(firstRow)
  const nextPage = [...host.querySelectorAll('button')].find(button => button.textContent === 'Next annotations')!
  nextPage.click()
  expect(host.querySelector('li')?.textContent).toContain('r100 ')
  host.querySelector<HTMLButtonElement>('li button')!.click(); flush()
  expect(host.querySelector('[data-raavl-annotation="r100"]')).not.toBeNull()
  expect(document.activeElement?.getAttribute('data-raavl-annotation')).toBe('r100')
  view.update({ annotations: null })
  expect(labels).toBe(0); expect(host.querySelectorAll('.raavl-region')).toHaveLength(0)
  view.dispose(); expect(host.children.length).toBe(0); expect(frames.size).toBe(0); expect(subscriptions).toBe(0); expect(labels).toBe(0)
  for (let i = 0; i < 25; i++) {
    const mounted = mountWaveform(host, { data, annotations: store, renderRegionLabel, viewport: { zoom: 100 } })
    flush(); mounted.dispose()
    expect(host.childElementCount).toBe(0); expect(frames.size).toBe(0); expect(subscriptions).toBe(0); expect(labels).toBe(0)
  }
  store.updateRegion('r0', { label: 'Still usable after views dispose' })
  store.dispose(); host.remove(); vi.unstubAllGlobals()
})
