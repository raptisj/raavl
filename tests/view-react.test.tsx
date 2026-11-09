import { act, StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Waveform, usePlayerState } from '../src/react'
import { createPlayer } from '../src/player'
import { mountWaveform } from '../src/dom'
import type { Player, Source } from '../src/core/types'
import { mockMedia } from './media'
import { parseTheme, waveformThemes } from '../src/themes'

let host: HTMLDivElement, root: Root | undefined, mock: ReturnType<typeof mockMedia>
let frames: Map<number, FrameRequestCallback>, next: number
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  mock = mockMedia(); host = document.createElement('div'); document.body.append(host)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  frames = new Map(); next = 1
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { const id = next++; frames.set(id, fn); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() {}, fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, roundRect() {}, fill() {} } as unknown as CanvasRenderingContext2D)
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; host.remove(); vi.unstubAllGlobals() })
const source: Source = { kind: 'url', id: 'demo', url: '/demo.wav', waveform: { kind: 'none' } }
function flushFrame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0)) }

it('switches themes without retaining old fields and resolves explicit overrides over theme defaults', () => {
  const data = { version: 1 as const, sourceId: 'theme', duration: 10, channels: [{ min: [-.5], max: [.5] }] }
  const view = mountWaveform(host, { data, theme: waveformThemes.neon, appearance: { height: 240 } })
  flushFrame()
  const element = host.querySelector<HTMLElement>('.raavl-waveform')!
  const cursor = host.querySelector<HTMLElement>('.raavl-cursor')!
  expect(element.style.height).toBe('240px')
  expect(element.style.getPropertyValue('--raavl-background')).toBe('#191225')
  expect(cursor.style.width).toBe('3px')
  view.update({ theme: parseTheme({ version: 1, name: 'Minimal', appearance: { cursorWidth: 0 } }) })
  flushFrame()
  expect(element.style.height).toBe('240px')
  expect(element.style.getPropertyValue('--raavl-background')).toBe('')
  expect(element.style.getPropertyValue('--raavl-border-radius')).toBe('8px')
  expect(cursor.style.width).toBe('0px')
  view.update({ theme: waveformThemes.paper, appearance: { height: undefined } })
  flushFrame()
  expect(element.style.height).toBe('120px')
  expect(() => view.update({ theme: waveformThemes.studio, appearance: { barGap: -1 } })).toThrow()
  expect(element.style.getPropertyValue('--raavl-background')).toBe('#faf6ec')
  view.update({ theme: null })
  flushFrame()
  expect(element.style.height).toBe('160px')
  expect(element.style.getPropertyValue('--raavl-progress-color')).toBe('')
  view.dispose()
})

it('draws line thickness, rounded bars and amplitude from theme configuration', () => {
  const drawing = { setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), lineWidth: 0, fillStyle: '' }
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(drawing as unknown as CanvasRenderingContext2D)
  const data = { version: 1 as const, sourceId: 'theme', duration: 10, channels: [{ min: [-.5], max: [.5] }] }
  const view = mountWaveform(host, { data, theme: waveformThemes.paper, appearance: { height: 100, amplitude: 1 } })
  flushFrame()
  expect(drawing.lineWidth).toBe(2.5)
  expect(drawing.moveTo).toHaveBeenCalledWith(.5, 25)
  expect(drawing.lineTo).toHaveBeenCalledWith(.5, 75)
  expect(drawing.stroke).toHaveBeenCalledOnce()
  view.update({ theme: waveformThemes.neon, appearance: { barWidth: 6 } })
  flushFrame()
  expect(drawing.roundRect).toHaveBeenCalledWith(0, 25, 6, 50, 3)
  expect(drawing.fill).toHaveBeenCalledOnce()
  view.update({ appearance: { amplitude: .5, barRadius: 0 } })
  flushFrame()
  expect(drawing.fillRect).toHaveBeenCalledWith(0, 37.5, 6, 25)
  view.dispose()
})

it('renders waveform and progress gradients in their respective pixel spaces and restores CSS colors', () => {
  vi.stubGlobal('devicePixelRatio', 2)
  const waveGradient = { addColorStop: vi.fn() }, progressGradient = { addColorStop: vi.fn() }
  const drawing = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, createLinearGradient: vi.fn(() => waveGradient), fillStyle: '' as unknown }
  const played = { drawImage() {}, fillRect() {}, createLinearGradient: vi.fn(() => progressGradient), fillStyle: '' as unknown }
  vi.mocked(HTMLCanvasElement.prototype.getContext)
    .mockReturnValueOnce(drawing as unknown as CanvasRenderingContext2D)
    .mockReturnValueOnce(played as unknown as CanvasRenderingContext2D)
  const data = { version: 1 as const, sourceId: 'gradient', duration: 10, channels: [{ min: [-.5], max: [.5] }] }
  const view = mountWaveform(host, { data, theme: parseTheme({ version: 1, name: 'Gradient', appearance: { height: 100 }, colors: {
    wave: { type: 'linear-gradient', stops: [{ offset: 0, color: '#666' }, { offset: 1, color: '#bbb' }] },
    progress: { type: 'linear-gradient', axis: 'horizontal', stops: [{ offset: 0, color: '#f50' }, { offset: 1, color: '#fa8' }] },
  } }) })
  flushFrame()
  expect(drawing.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 100)
  expect(played.createLinearGradient).toHaveBeenCalledWith(0, 0, 2000, 0)
  expect(waveGradient.addColorStop.mock.calls).toEqual([[0, '#666'], [1, '#bbb']])
  expect(progressGradient.addColorStop.mock.calls).toEqual([[0, '#f50'], [1, '#fa8']])
  expect(drawing.fillStyle).toBe(waveGradient)
  expect(played.fillStyle).toBe(progressGradient)
  view.update({ theme: waveformThemes.studio }); flushFrame()
  expect(drawing.fillStyle).toBe('#52657b')
  view.update({ theme: null }); flushFrame()
  expect(drawing.fillStyle).toBe('#9aafa7')
  view.dispose()
})

it.each(['line', 'bars'] as const)('combines stereo peaks in %s mode and supports separate channel rows', style => {
  const drawing = { setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(drawing as unknown as CanvasRenderingContext2D)
  const data = { version: 1 as const, sourceId: 'stereo', duration: 10, channels: [
    { min: [-.8, 0], max: [-.2, 0] },
    { min: [.1, 0], max: [.4, 0] },
  ] }
  const original = JSON.stringify(data)
  const view = mountWaveform(host, { data, appearance: { style, height: 100, amplitude: 1, barWidth: 1, barGap: 0 } })
  const expectStroke = (top: number, bottom: number) => {
    if (style === 'line') {
      expect(drawing.moveTo).toHaveBeenCalledWith(.5, top)
      expect(drawing.lineTo).toHaveBeenCalledWith(.5, bottom)
    } else expect(drawing.fillRect).toHaveBeenCalledWith(0, top, 1, bottom - top)
  }
  flushFrame()
  expectStroke(10, 70)
  expect(style === 'line' ? drawing.moveTo : drawing.fillRect).toHaveBeenCalledTimes(1000)
  if (style === 'line') expect(drawing.moveTo).toHaveBeenCalledWith(500.5, 50)
  else expect(drawing.fillRect).toHaveBeenCalledWith(500, 50, 1, 1)
  vi.clearAllMocks()
  view.update({ appearance: { splitChannels: true } })
  flushFrame()
  expectStroke(25, 45)
  expectStroke(65, 75)
  expect(style === 'line' ? drawing.moveTo : drawing.fillRect).toHaveBeenCalledTimes(2000)
  vi.clearAllMocks()
  view.update({ appearance: { splitChannels: undefined, normalize: true } })
  flushFrame()
  expectStroke(0, 75)
  expect(JSON.stringify(data)).toBe(original)
  view.dispose()
})

it('updates React split-channel appearance without reloading audio and resets when the prop is removed', async () => {
  const drawing = { setTransform() {}, fillRect: vi.fn(), drawImage() {}, beginPath() {}, moveTo: vi.fn(), lineTo: vi.fn(), stroke() {} }
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(drawing as unknown as CanvasRenderingContext2D)
  const player = createPlayer()
  const data = { version: 1 as const, sourceId: 'stereo', duration: 10, channels: [
    { min: [-.8], max: [-.2] }, { min: [.1], max: [.4] },
  ] }
  const pending = player.setSource({ kind: 'url', id: 'stereo', url: '/stereo.wav', waveform: { kind: 'peaks', data } })
  mock.ready(player.getMediaElement()!); await pending
  await player.play(); player.seek(3)
  const media = player.getMediaElement(), loads = mock.load.mock.calls.length
  root = createRoot(host)
  for (const splitChannels of [undefined, true, undefined]) {
    await act(async () => root!.render(<Waveform player={player} appearance={{ height: 100, amplitude: 1, splitChannels }} />))
    drawing.moveTo.mockClear()
    flushFrame()
    expect(drawing.moveTo).toHaveBeenCalledTimes(splitChannels ? 2000 : 1000)
  }
  expect(player.getMediaElement()).toBe(media)
  expect(player.getSnapshot().data).toBe(data)
  expect(player.getSnapshot().playback).toBe('playing')
  expect(player.getCurrentTime()).toBe(3)
  expect(mock.load.mock.calls.length).toBe(loads)
  await act(async () => root!.unmount()); root = undefined
  player.dispose()
})

it('keeps channel annotation assignments while switching between combined and split rows', () => {
  const data = { version: 1 as const, sourceId: 'stereo', duration: 10, channels: [
    { min: [-.5], max: [.5] }, { min: [-.5], max: [.5] },
  ] }
  const store = createAnnotations({ document: { version: 1, sourceId: 'stereo', regions: [
    { id: 'right', start: 2, end: 4, channel: 1 },
  ], markers: [] } })
  const view = mountWaveform(host, { data, annotations: store })
  flushFrame()
  const region = host.querySelector<HTMLElement>('[data-raavl-annotation="right"]')!
  expect(region.style.top).toBe('0px')
  expect(region.style.height).toBe('100%')
  view.update({ appearance: { splitChannels: true } }); flushFrame()
  expect(region.style.top).toBe('50%')
  expect(region.style.height).toBe('50%')
  view.update({ appearance: { splitChannels: false } }); flushFrame()
  expect(region.style.height).toBe('100%')
  expect(store.getSnapshot().document.regions[0].channel).toBe(1)
  view.dispose(); store.dispose()
})

it('applies and removes React themes and drawing overrides without reloading or replacing the view', async () => {
  const player = createPlayer(), loaded = player.setSource(source)
  mock.ready(player.getMediaElement()!); await loaded
  await player.play(); player.seek(3)
  const element = player.getMediaElement(), loads = mock.load.mock.calls.length
  root = createRoot(host)
  await act(async () => { root!.render(<StrictMode><Waveform player={player} theme={waveformThemes.neon} appearance={{ height: 250 }} /></StrictMode>) })
  flushFrame()
  const waveform = host.querySelector<HTMLElement>('.raavl-waveform')!
  expect(waveform.style.height).toBe('250px')
  await act(async () => { root!.render(<StrictMode><Waveform player={player} theme={waveformThemes.paper} /></StrictMode>) })
  flushFrame()
  expect(host.querySelector('.raavl-waveform')).toBe(waveform)
  expect(waveform.style.height).toBe('120px')
  expect(host.querySelector<HTMLElement>('.raavl-cursor')!.style.width).toBe('1px')
  await act(async () => { root!.render(<StrictMode><Waveform player={player} /></StrictMode>) })
  flushFrame()
  expect(waveform.style.height).toBe('160px')
  expect(waveform.style.getPropertyValue('--raavl-background')).toBe('')
  expect(player.getMediaElement()).toBe(element)
  expect(player.getCurrentTime()).toBe(3)
  expect(player.getSnapshot().playback).toBe('playing')
  expect(mock.load.mock.calls.length).toBe(loads)
  await act(async () => root!.unmount()); root = undefined
  player.dispose()
})

it('keeps media identity, time, and playback through React appearance updates and inline source objects', async () => {
  let player: Player | null = null
  const onPlayer = (value: Player | null) => { player = value }
  root = createRoot(host)
  await act(async () => root!.render(<StrictMode><Waveform source={{ ...source }} onPlayer={onPlayer} appearance={{ style: 'bars' }} /></StrictMode>))
  const active = player as unknown as Player
  expect(active).toBeTruthy(); expect(active.getSnapshot().source).not.toBe('disposed')
  await act(async () => { mock.ready(active.getMediaElement()!); await active.play(); active.seek(4) })
  const element = active.getMediaElement(), loads = mock.load.mock.calls.length
  await act(async () => root!.render(<StrictMode><Waveform source={{ ...source }} onPlayer={onPlayer} appearance={{ style: 'line', height: 220 }} /></StrictMode>))
  expect(player).toBe(active); expect(active.getMediaElement()).toBe(element)
  expect(active.getCurrentTime()).toBe(4); expect(active.getSnapshot().playback).toBe('playing')
  expect(mock.load.mock.calls.length).toBe(loads)
  expect(host.querySelectorAll('.raavl-waveform')).toHaveLength(1)
  await act(async () => root!.unmount()); root = undefined
  expect(active.getSnapshot().source).toBe('disposed'); expect(frames.size).toBe(0)
})

it('does not destroy a player borrowed by a React view', async () => {
  const player = createPlayer()
  root = createRoot(host)
  await act(async () => root!.render(<Waveform player={player} />))
  await act(async () => root!.unmount()); root = undefined
  expect(player.getSnapshot().source).toBe('idle')
  player.dispose()
})

it('narrow React subscriptions skip unrelated volume and clock changes', async () => {
  const player = createPlayer()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  let renders = 0
  const selector = (state: ReturnType<Player['getSnapshot']> | null) => state?.playback
  function Button() { const playback = usePlayerState(player, selector); renders++; return <button>{playback}</button> }
  root = createRoot(host)
  await act(async () => root!.render(<Button />))
  const before = renders
  await act(async () => { player.setVolume(.4); player.seek(3) })
  expect(renders).toBe(before)
  await act(async () => player.play())
  expect(host.textContent).toBe('playing')
  await act(async () => root!.unmount()); root = undefined; player.dispose()
})

it('updates accessible seeking readiness when supplied peaks arrive before metadata', async () => {
  const player = createPlayer()
  const data = { version: 1 as const, sourceId: 'demo', duration: 10, channels: [{ min: [-.5], max: [.5] }] }
  const pending = player.setSource({ ...source, waveform: { kind: 'peaks', data } })
  const view = mountWaveform(host, { player })
  flushFrame()
  const slider = host.querySelector('[role=slider]')!
  expect(slider.getAttribute('aria-disabled')).toBe('true')
  mock.ready(player.getMediaElement()!, 10)
  await pending
  flushFrame()
  expect(slider.getAttribute('aria-disabled')).toBe('false')
  expect(slider.getAttribute('aria-valuemax')).toBe('10')
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(player.getCurrentTime()).toBe(1)
  view.dispose(); player.dispose()
})

it('supports keyboard seeking and validates view updates before applying them', async () => {
  const player = createPlayer()
  const pending = player.setSource(source); mock.ready(player.getMediaElement()!); await pending
  const view = mountWaveform(host, { player })
  flushFrame()
  const slider = host.querySelector('[role=slider]')!
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(player.getCurrentTime()).toBe(1)
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  expect(player.getCurrentTime()).toBe(10)
  expect(() => view.update({ appearance: { height: -1 } })).toThrow()
  view.dispose(); view.dispose()
  expect(host.children).toHaveLength(0); expect(player.getSnapshot().source).toBe('ready')
  player.dispose()
})

import { createAnnotations, type AnnotationDocument } from '../src/regions'
const annotations: AnnotationDocument = { version: 1, sourceId: 'demo', regions: [{ id: 'intro', start: 2, end: 4, label: 'Intro' }], markers: [{ id: 'cue', time: 7, label: 'Cue' }] }
function pointer(element: Element, name: string, x: number) {
  const event = new MouseEvent(name, { clientX: x, button: 0, bubbles: true, cancelable: true })
  Object.defineProperty(event, 'pointerId', { value: 1 }); element.dispatchEvent(event)
}
async function annotationView(controlled = false) {
  const player = createPlayer(), onCommit = vi.fn()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  const store = controlled ? createAnnotations({ value: annotations, revision: 0, onCommit }) : createAnnotations({ document: annotations })
  if (!controlled) store.onCommit(onCommit)
  const view = mountWaveform(host, { player, annotations: store, interaction: { drag: 'select' } })
  const viewport = host.querySelector<HTMLElement>('.raavl-waveform')!
  Object.defineProperty(viewport, 'clientWidth', { value: 1000 })
  viewport.setPointerCapture = vi.fn(); viewport.releasePointerCapture = vi.fn(); viewport.hasPointerCapture = () => false
  flushFrame()
  return { player, store, view, viewport, onCommit, cleanup: () => { view.dispose(); store.dispose(); player.dispose() } }
}
it('previews dragging without commits, commits once on release, and keeps selection separate', async () => {
  const test = await annotationView()
  const body = host.querySelector('.raavl-region-body')!
  pointer(body, 'pointerdown', 200); pointer(test.viewport, 'pointermove', 300); pointer(test.viewport, 'pointermove', 400)
  expect(test.onCommit).not.toHaveBeenCalled()
  expect(test.store.getSnapshot().document.regions[0].start).toBe(2)
  pointer(test.viewport, 'pointerup', 400)
  expect(test.onCommit).toHaveBeenCalledOnce()
  expect(test.store.getSnapshot().document.regions[0]).toMatchObject({ start: 4, end: 6 })
  pointer(test.viewport, 'pointerdown', 100); pointer(test.viewport, 'pointermove', 300); pointer(test.viewport, 'pointerup', 300)
  expect(test.view.getSelection()).toEqual({ start: 1, end: 3 })
  expect(test.store.getSnapshot().document.regions).toHaveLength(1)
  test.view.createRegionFromSelection('new', 'Selected')
  expect(test.store.getSnapshot().document.regions).toHaveLength(2)
  expect(test.view.getSelection()).toBe(null)
  test.cleanup()
})
it.each(['move', 'resize-start', 'resize-end', 'marker'] as const)('commits a fast %s from the release position when movement events are sparse', async action => {
  const selector = action === 'move' ? '.raavl-region-body' : action === 'marker' ? '.raavl-marker .raavl-region-body' : `.raavl-region-handle-${action === 'resize-start' ? 'start' : 'end'}`
  const startX = action === 'resize-end' ? 400 : action === 'marker' ? 700 : 200
  for (const smallMove of [false, true]) {
    const test = await annotationView()
    const before = test.store.getSnapshot().document
    pointer(host.querySelector(selector)!, 'pointerdown', startX)
    if (smallMove) pointer(test.viewport, 'pointermove', startX + 1)
    pointer(test.viewport, 'pointerup', startX + 100)
    const after = test.store.getSnapshot().document
    if (action === 'marker') expect(after.markers[0].time).toBeCloseTo(before.markers[0].time + 1)
    else expect(after.regions[0]).toMatchObject({
      start: before.regions[0].start + (action === 'resize-end' ? 0 : 1),
      end: before.regions[0].end + (action === 'resize-start' ? 0 : 1),
    })
    expect(test.onCommit).toHaveBeenCalledOnce()
    test.cleanup()
  }
})
it.each(['move', 'resize-start', 'resize-end', 'marker'] as const)('uses the release position after the last %s preview', async action => {
  const test = await annotationView()
  const selector = action === 'move' ? '.raavl-region-body' : action === 'marker' ? '.raavl-marker .raavl-region-body' : `.raavl-region-handle-${action === 'resize-start' ? 'start' : 'end'}`
  const startX = action === 'resize-end' ? 400 : action === 'marker' ? 700 : 200
  pointer(host.querySelector(selector)!, 'pointerdown', startX)
  pointer(test.viewport, 'pointermove', startX + 50)
  pointer(test.viewport, 'pointerup', startX + 100)
  const after = test.store.getSnapshot().document
  if (action === 'marker') expect(after.markers[0].time).toBe(8)
  else expect(after.regions[0]).toMatchObject({
    start: action === 'resize-end' ? 2 : 3,
    end: action === 'resize-start' ? 4 : 5,
  })
  expect(test.onCommit).toHaveBeenCalledOnce()
  test.cleanup()
})
it('finishes a fast range selection at the release position', async () => {
  const test = await annotationView()
  pointer(test.viewport, 'pointerdown', 100)
  pointer(test.viewport, 'pointerup', 300)
  expect(test.view.getSelection()).toEqual({ start: 1, end: 3 })
  expect(test.onCommit).not.toHaveBeenCalled()
  test.cleanup()
})
it('keeps the click threshold while using release coordinates after a drag returns to its origin', async () => {
  const test = await annotationView()
  pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200)
  pointer(test.viewport, 'pointerup', 202)
  expect(test.onCommit).not.toHaveBeenCalled()
  pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200)
  pointer(test.viewport, 'pointermove', 300)
  pointer(test.viewport, 'pointerup', 200)
  expect(test.store.getSnapshot().document.regions[0]).toMatchObject({ start: 2, end: 4 })
  test.cleanup()
})
it.each(['move', 'resize'] as const)('preserves an active region %s preview through redraws and player updates', async action => {
  const test = await annotationView()
  const region = host.querySelector<HTMLElement>('.raavl-region')!
  const target = host.querySelector(action === 'move' ? '.raavl-region-body' : '.raavl-region-handle-end')!
  const startX = action === 'move' ? 200 : 400
  pointer(target, 'pointerdown', startX)
  pointer(test.viewport, 'pointermove', startX + 100)
  expect(region.style.left).toBe(action === 'move' ? '30%' : '20%')
  expect(region.style.width).toBe(action === 'move' ? '20%' : '30%')
  test.view.refreshTheme(); flushFrame()
  test.player.setVolume(.5)
  expect(region.style.left).toBe(action === 'move' ? '30%' : '20%')
  expect(region.style.width).toBe(action === 'move' ? '20%' : '30%')
  expect(test.onCommit).not.toHaveBeenCalled()
  pointer(test.viewport, 'pointerup', startX + 100)
  expect(test.onCommit).toHaveBeenCalledOnce()
  expect(test.store.getSnapshot().document.regions[0]).toMatchObject(action === 'move' ? { start: 3, end: 5 } : { start: 2, end: 5 })
  test.cleanup()
})
it('keeps a controlled React drag through a rerender and commits its final coordinates', async () => {
  const player = createPlayer()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  const onCommit = vi.fn()
  function Editor() {
    const [value, setValue] = useState({ document: annotations, revision: 0 })
    const [selected, setSelected] = useState<string | null>(null)
    const [themeVersion, setThemeVersion] = useState(0)
    return <>
      <button onClick={() => setThemeVersion(current => current + 1)}>Refresh theme</button>
      <span>{selected}</span>
      <Waveform player={player} annotations={value.document} annotationsRevision={value.revision}
        onAnnotationSelect={setSelected} themeVersion={themeVersion}
        onAnnotationsCommit={(document, change) => {
          onCommit(document, change)
          setValue(current => change.baseRevision === current.revision ? { document, revision: current.revision + 1 } : current)
        }} />
    </>
  }
  root = createRoot(host)
  await act(async () => root!.render(<Editor />))
  flushFrame()
  const waveform = host.querySelector<HTMLElement>('.raavl-waveform')!
  waveform.setPointerCapture = vi.fn(); waveform.releasePointerCapture = vi.fn(); waveform.hasPointerCapture = () => false
  await act(async () => pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200))
  await act(async () => pointer(waveform, 'pointermove', 300))
  await act(async () => host.querySelector('button')!.click())
  flushFrame()
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('30%')
  expect(onCommit).not.toHaveBeenCalled()
  await act(async () => pointer(waveform, 'pointerup', 400))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(onCommit.mock.calls[0][0].regions[0]).toMatchObject({ start: 4, end: 6 })
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('40%')
  await act(async () => root!.unmount()); root = undefined
  player.dispose()
})
it.each(['pointercancel', 'lostpointercapture', 'Escape'])('restores saved region bounds when a gesture is cancelled with %s', async event => {
  const test = await annotationView()
  pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200)
  pointer(test.viewport, 'pointermove', 300)
  test.view.refreshTheme(); flushFrame()
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('30%')
  if (event === 'Escape') test.viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  else pointer(test.viewport, event, 300)
  pointer(test.viewport, 'pointerup', 300)
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('20%')
  expect(test.onCommit).not.toHaveBeenCalled()
  test.cleanup()
})
it('reverts rejected controlled drags and cancels gestures on an external revision', async () => {
  const test = await annotationView(true)
  pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200)
  pointer(test.viewport, 'pointermove', 400); pointer(test.viewport, 'pointerup', 400)
  expect(test.onCommit).toHaveBeenCalledOnce()
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('20%')
  test.onCommit.mockClear()
  pointer(host.querySelector('.raavl-region-body')!, 'pointerdown', 200); pointer(test.viewport, 'pointermove', 300)
  test.store.setControlled({ value: { ...annotations, regions: [{ ...annotations.regions[0], start: 1 }] }, revision: 1, onCommit: test.onCommit })
  pointer(test.viewport, 'pointerup', 300)
  expect(test.onCommit).not.toHaveBeenCalled()
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.left).toBe('10%')
  test.cleanup()
})
it('edits region boundaries with the keyboard without seeking playback, and hides annotations on source switch', async () => {
  const test = await annotationView()
  host.querySelector('.raavl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(test.store.getSnapshot().document.regions[0].end).toBeCloseTo(4.1)
  expect(test.player.getCurrentTime()).toBe(0)
  const ready = test.player.setSource({ ...source, id: 'different' }); mock.ready(test.player.getMediaElement()!); await ready
  flushFrame()
  expect(host.querySelector<HTMLElement>('.raavl-annotations')!.hidden).toBe(true)
  expect(test.store.getSnapshot().document.regions).toHaveLength(1)
  expect(host.textContent).toContain('another source')
  test.cleanup()
})
it('renders React-owned custom region labels and receives controlled keyboard proposals', async () => {
  let player: Player | null = null
  const onCommit = vi.fn()
  root = createRoot(host)
  await act(async () => root!.render(<StrictMode><Waveform source={source} onPlayer={value => { player = value }} annotations={annotations} annotationsRevision={0} onAnnotationsCommit={onCommit} renderRegionLabel={region => <strong data-custom-label>{region.label}</strong>} /></StrictMode>))
  const active = player as unknown as Player
  await act(async () => { mock.ready(active.getMediaElement()!); flushFrame() })
  expect(host.querySelector('[data-custom-label]')?.textContent).toBe('Intro')
  await act(async () => host.querySelector('.raavl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(onCommit.mock.calls[0][0].regions[0].end).toBeCloseTo(4.1)
  expect(host.querySelector<HTMLElement>('.raavl-region')!.style.width).toBe('20%')
})

it('focuses a clicked resize handle and preserves focus after committing a keyboard edit', async () => {
  const test = await annotationView()
  const handle = host.querySelector<HTMLElement>('.raavl-region-handle-end')!
  pointer(handle, 'pointerdown', 400); pointer(test.viewport, 'pointerup', 400)
  expect(document.activeElement).toBe(handle)
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(document.activeElement?.classList.contains('raavl-region-handle-end')).toBe(true)
  expect(test.store.getSnapshot().document.regions[0].end).toBeCloseTo(4.1)
  test.cleanup()
})

it('supports React-owned default annotations through Strict Mode remount and cleanup', async () => {
  let player: Player | null = null
  const onCommit = vi.fn()
  root = createRoot(host)
  await act(async () => root!.render(<StrictMode><Waveform source={source} onPlayer={value => { player = value }} defaultAnnotations={annotations} onAnnotationsCommit={onCommit} /></StrictMode>))
  const active = player as unknown as Player
  await act(async () => { mock.ready(active.getMediaElement()!); flushFrame() })
  await act(async () => host.querySelector('.raavl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(parseFloat(host.querySelector<HTMLElement>('.raavl-region')!.style.width)).toBeCloseTo(21)
  await act(async () => root!.unmount()); root = undefined
  expect(host.children).toHaveLength(0)
  expect(frames.size).toBe(0)
})

it('starts playback at a double-clicked position and removes the handler on disposal', async () => {
  const player = createPlayer()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  const view = mountWaveform(host, { player })
  flushFrame()
  const waveform = host.querySelector('.raavl-waveform')!
  waveform.dispatchEvent(new MouseEvent('dblclick', { clientX: 400, bubbles: true }))
  await Promise.resolve()
  expect(player.getCurrentTime()).toBe(4)
  expect(player.getSnapshot().playback).toBe('playing')
  player.pause()
  view.dispose()
  waveform.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  expect(player.getSnapshot().playback).toBe('paused')
  player.dispose()
})

it('ignores double-click playback before a source is ready and reports play failures through state', async () => {
  const player = createPlayer()
  const view = mountWaveform(host, { player })
  const waveform = host.querySelector('.raavl-waveform')!
  waveform.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  expect(mock.play).not.toHaveBeenCalled()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  mock.play.mockRejectedValueOnce(new Error('Playback blocked'))
  waveform.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await Promise.resolve(); await Promise.resolve()
  expect(player.getSnapshot().playback).toBe('paused')
  expect(player.getSnapshot().error).toBeTruthy()
  view.dispose(); player.dispose()
})

it('keeps annotation double-clicks separate from waveform playback', async () => {
  const test = await annotationView()
  host.querySelector('.raavl-region-body')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  expect(mock.play).not.toHaveBeenCalled()
  test.player.seek(3)
  test.viewport.dispatchEvent(new MouseEvent('dblclick', { clientX: 500, bubbles: true }))
  await Promise.resolve()
  expect(test.player.getSnapshot().playback).toBe('playing')
  expect(test.player.getCurrentTime()).toBe(3)
  test.cleanup()
})

function touchEvent(element: Element, name: string, x: number, y = 50, id = 1, primary = true) {
  const event = new MouseEvent(name, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: id }, pointerType: { value: 'touch' }, isPrimary: { value: primary },
  })
  element.dispatchEvent(event)
}
function tap(element: Element, x: number, y = 50) {
  touchEvent(element, 'pointerdown', x, y)
  touchEvent(element, 'pointerup', x, y)
}
async function touchView(drag: 'none' | 'seek' = 'none') {
  const player = createPlayer()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  const view = mountWaveform(host, { player, interaction: { drag } })
  flushFrame()
  const waveform = host.querySelector<HTMLElement>('.raavl-waveform')!
  waveform.hasPointerCapture = () => false
  return { player, view, waveform, cleanup: () => { view.dispose(); player.dispose() } }
}

it('seeks on touch taps and plays on a nearby double-tap without synthetic mouse events', async () => {
  const test = await touchView()
  tap(test.waveform, 400)
  expect(test.player.getCurrentTime()).toBe(4)
  expect(mock.play).not.toHaveBeenCalled()
  tap(test.waveform, 410)
  await Promise.resolve()
  expect(test.player.getCurrentTime()).toBeCloseTo(4.1)
  expect(test.player.getSnapshot().playback).toBe('playing')
  expect(mock.play).toHaveBeenCalledOnce()
  // Compatibility events from the same gesture must not seek or play twice.
  test.waveform.dispatchEvent(new MouseEvent('click', { clientX: 800, bubbles: true }))
  test.waveform.dispatchEvent(new MouseEvent('dblclick', { clientX: 800, bubbles: true }))
  expect(test.player.getCurrentTime()).toBeCloseTo(4.1)
  expect(mock.play).toHaveBeenCalledOnce()
  expect(test.waveform.style.touchAction).toBe('manipulation')
  test.cleanup()
})

it('requires taps to be close in time and position and excludes long presses', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const test = await touchView()
  tap(test.waveform, 200)
  now = 400
  tap(test.waveform, 200)
  tap(test.waveform, 500)
  expect(mock.play).not.toHaveBeenCalled()
  touchEvent(test.waveform, 'pointerdown', 500)
  now = 1000
  touchEvent(test.waveform, 'pointerup', 500)
  tap(test.waveform, 500)
  expect(mock.play).not.toHaveBeenCalled()
  test.cleanup()
})

it('allows touch scrubbing but does not treat drags or vertical scrolling as taps', async () => {
  const test = await touchView('seek')
  expect(test.waveform.style.touchAction).toBe('pan-y pinch-zoom')
  touchEvent(test.waveform, 'pointerdown', 100)
  expect(test.player.getCurrentTime()).toBe(0)
  touchEvent(test.waveform, 'pointermove', 500)
  expect(test.player.getCurrentTime()).toBe(5)
  touchEvent(test.waveform, 'pointerup', 500)
  tap(test.waveform, 500)
  expect(mock.play).not.toHaveBeenCalled()
  touchEvent(test.waveform, 'pointerdown', 500)
  touchEvent(test.waveform, 'pointermove', 500, 100)
  touchEvent(test.waveform, 'pointercancel', 500, 100)
  touchEvent(test.waveform, 'pointerup', 500, 100)
  tap(test.waveform, 500)
  expect(mock.play).not.toHaveBeenCalled()
  test.cleanup()
})

it('rejects multi-touch and clears cancelled or lost touch gestures', async () => {
  const test = await touchView()
  tap(test.waveform, 300)
  touchEvent(test.waveform, 'pointerdown', 300)
  touchEvent(test.waveform, 'pointerdown', 300, 50, 2, false)
  touchEvent(test.waveform, 'pointerup', 300, 50, 2, false)
  touchEvent(test.waveform, 'pointerup', 300)
  expect(mock.play).not.toHaveBeenCalled()
  for (const cancel of ['pointercancel', 'lostpointercapture']) {
    tap(test.waveform, 300)
    touchEvent(test.waveform, 'pointerdown', 300)
    touchEvent(test.waveform, cancel, 300)
    touchEvent(test.waveform, 'pointerup', 300)
    expect(mock.play).not.toHaveBeenCalled()
  }
  test.cleanup()
})

it('keeps touch annotation gestures separate and supports double-tap playback in selection mode', async () => {
  const test = await annotationView()
  const body = host.querySelector('.raavl-region-body')!
  tap(body, 300); tap(body, 300)
  expect(mock.play).not.toHaveBeenCalled()
  tap(test.viewport, 500); tap(test.viewport, 500)
  await Promise.resolve()
  expect(test.player.getCurrentTime()).toBe(0)
  expect(test.player.getSnapshot().playback).toBe('playing')
  test.cleanup()
})

import { mountTimeline } from '../src/timeline'
import { mountMinimap } from '../src/minimap'
import { createSnapper } from '../src/snapping'
it('synchronizes optional timeline/minimap with zoom, keyboard navigation and disposal', async () => {
  const player = createPlayer(); const loaded = player.setSource(source)
  mock.ready(player.getMediaElement()!, 100); await loaded
  const main = document.createElement('div'), ruler = document.createElement('div'), overview = document.createElement('div')
  host.append(main, ruler, overview)
  const view = mountWaveform(main, { player, viewport: { zoom: 100, follow: 'off' } }); flushFrame()
  const timeline = mountTimeline(ruler, { view }), minimap = mountMinimap(overview, { view, player })
  flushFrame()
  expect(view.getViewport()).toMatchObject({ start: 0, end: 10, duration: 100 })
  expect(ruler.querySelectorAll('.raavl-timeline-tick').length).toBeLessThan(16)
  const changed = vi.fn(), off = view.subscribeViewport(changed)
  const slider = overview.querySelector<HTMLElement>('.raavl-minimap-control')!
  slider.setPointerCapture = vi.fn(); slider.hasPointerCapture = () => false
  const event = (type: string, x: number) => { const value = new MouseEvent(type, { bubbles: true, clientX: x, button: 0 }); Object.defineProperty(value, 'pointerId', { value: 2 }); return value }
  slider.dispatchEvent(event('pointerdown', 500)); slider.dispatchEvent(event('pointermove', 600)); slider.dispatchEvent(event('pointerup', 600)); flushFrame()
  expect(view.getViewport().start).toBe(55)
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); flushFrame()
  expect(view.getViewport()).toMatchObject({ start: 90, end: 100 })
  expect(player.getCurrentTime()).toBe(0)
  expect(slider.getAttribute('aria-valuenow')).toBe('90')
  expect(ruler.querySelector('[data-time="90"]')).not.toBeNull()
  expect(changed).toHaveBeenCalled()
  view.update({ viewport: { zoom: 'fit' } }); flushFrame()
  expect(view.getViewport()).toMatchObject({ start: 0, end: 100 })
  view.dispose()
  expect(slider.getAttribute('aria-disabled')).toBe('true')
  expect(() => view.scrollTo(1)).toThrow()
  expect(() => mountTimeline(ruler, { view })).toThrow()
  expect(() => mountMinimap(overview, { view, player })).toThrow()
  off(); minimap.dispose(); minimap.dispose(); timeline.dispose(); player.dispose()
  expect(overview.childElementCount).toBe(0); expect(ruler.childElementCount).toBe(0); expect(frames.size).toBe(0)
})
it('exposes React view lifetimes without replacing the view on appearance changes', async () => {
  const views: Array<import('../src/dom').WaveformView | null> = []
  const onView = (view: import('../src/dom').WaveformView | null) => views.push(view)
  root = createRoot(host)
  await act(async () => root!.render(<Waveform source={source} onView={onView} />))
  const mounted = views.at(-1)!
  await act(async () => root!.render(<Waveform source={source} onView={onView} appearance={{ height: 200 }} />))
  expect(views.at(-1)).toBe(mounted)
  await act(async () => root!.unmount()); root = undefined
  expect(views.at(-1)).toBeNull(); expect(mounted.getViewport().disposed).toBe(true)
})
it('applies magnetic snapping to final pointer coordinates while excluding the moved annotation', () => {
  const store = createAnnotations({ document: annotations })
  const view = mountWaveform(host, { data: { version: 1, sourceId: 'demo', duration: 10, channels: [{ min: [-.5], max: [.5] }] }, annotations: store, snapAnnotation: createSnapper({ tolerancePixels: 10 }), viewport: { zoom: 100 } })
  flushFrame()
  const surface = host.querySelector<HTMLElement>('.raavl-waveform')!
  surface.setPointerCapture = vi.fn(); surface.hasPointerCapture = () => false
  const target = host.querySelector('.raavl-region-handle-end')!
  const pointerEvent = (type: string, x: number) => { const event = new MouseEvent(type, { bubbles: true, clientX: x, button: 0 }); Object.defineProperty(event, 'pointerId', { value: 1 }); return event }
  target.dispatchEvent(pointerEvent('pointerdown', 400))
  surface.dispatchEvent(pointerEvent('pointermove', 650)); surface.dispatchEvent(pointerEvent('pointerup', 695))
  expect(store.getSnapshot().document.regions[0].end).toBe(7)
  view.dispose(); store.dispose()
})

import { ModulesEditor } from '../examples/live/ModulesEditor'
it('runs the composed React modules example through Strict Mode, history and teardown', async () => {
  root = createRoot(host)
  await act(async () => root!.render(<StrictMode><ModulesEditor mode="react" /></StrictMode>))
  await act(async () => { mock.ready(mock.load.mock.contexts.at(-1) as HTMLMediaElement, 12); flushFrame() })
  const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent === text)!
  await act(async () => button('Rename opening').click())
  expect(host.textContent).toContain('Undo steps: 1')
  await act(async () => button('Undo').click())
  expect(host.textContent).toContain('Redo steps: 1')
  expect(host.querySelectorAll('.raavl-minimap')).toHaveLength(1)
  await act(async () => root!.unmount()); root = undefined
  expect(frames.size).toBe(0); expect(host.childElementCount).toBe(0)
})
