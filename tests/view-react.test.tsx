import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Waveform, usePlayerState } from '../src/react'
import { createPlayer } from '../src/player'
import { mountWaveform } from '../src/dom'
import type { Player, Source } from '../src/core/types'
import { mockMedia } from './media'

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
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform() {}, fillRect() {}, drawImage() {} } as unknown as CanvasRenderingContext2D)
})
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; host.remove(); vi.unstubAllGlobals() })
const source: Source = { kind: 'url', id: 'demo', url: '/demo.wav', waveform: { kind: 'none' } }
function flushFrame() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0)) }

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
  expect(host.querySelectorAll('.ravl-waveform')).toHaveLength(1)
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
  const viewport = host.querySelector<HTMLElement>('.ravl-waveform')!
  Object.defineProperty(viewport, 'clientWidth', { value: 1000 })
  viewport.setPointerCapture = vi.fn(); viewport.releasePointerCapture = vi.fn(); viewport.hasPointerCapture = () => false
  flushFrame()
  return { player, store, view, viewport, onCommit, cleanup: () => { view.dispose(); store.dispose(); player.dispose() } }
}
it('previews dragging without commits, commits once on release, and keeps selection separate', async () => {
  const test = await annotationView()
  const body = host.querySelector('.ravl-region-body')!
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
it('reverts rejected controlled drags and cancels gestures on an external revision', async () => {
  const test = await annotationView(true)
  pointer(host.querySelector('.ravl-region-body')!, 'pointerdown', 200)
  pointer(test.viewport, 'pointermove', 400); pointer(test.viewport, 'pointerup', 400)
  expect(test.onCommit).toHaveBeenCalledOnce()
  expect(host.querySelector<HTMLElement>('.ravl-region')!.style.left).toBe('20%')
  test.onCommit.mockClear()
  pointer(host.querySelector('.ravl-region-body')!, 'pointerdown', 200); pointer(test.viewport, 'pointermove', 300)
  test.store.setControlled({ value: { ...annotations, regions: [{ ...annotations.regions[0], start: 1 }] }, revision: 1, onCommit: test.onCommit })
  pointer(test.viewport, 'pointerup', 300)
  expect(test.onCommit).not.toHaveBeenCalled()
  expect(host.querySelector<HTMLElement>('.ravl-region')!.style.left).toBe('10%')
  test.cleanup()
})
it('edits region boundaries with the keyboard without seeking playback, and hides annotations on source switch', async () => {
  const test = await annotationView()
  host.querySelector('.ravl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(test.store.getSnapshot().document.regions[0].end).toBeCloseTo(4.1)
  expect(test.player.getCurrentTime()).toBe(0)
  const ready = test.player.setSource({ ...source, id: 'different' }); mock.ready(test.player.getMediaElement()!); await ready
  flushFrame()
  expect(host.querySelector<HTMLElement>('.ravl-annotations')!.hidden).toBe(true)
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
  await act(async () => host.querySelector('.ravl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(onCommit.mock.calls[0][0].regions[0].end).toBeCloseTo(4.1)
  expect(host.querySelector<HTMLElement>('.ravl-region')!.style.width).toBe('20%')
})

it('focuses a clicked resize handle and preserves focus after committing a keyboard edit', async () => {
  const test = await annotationView()
  const handle = host.querySelector<HTMLElement>('.ravl-region-handle-end')!
  pointer(handle, 'pointerdown', 400); pointer(test.viewport, 'pointerup', 400)
  expect(document.activeElement).toBe(handle)
  handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(document.activeElement?.classList.contains('ravl-region-handle-end')).toBe(true)
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
  await act(async () => host.querySelector('.ravl-region-handle-end')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(onCommit).toHaveBeenCalledOnce()
  expect(parseFloat(host.querySelector<HTMLElement>('.ravl-region')!.style.width)).toBeCloseTo(21)
  await act(async () => root!.unmount()); root = undefined
  expect(host.children).toHaveLength(0)
  expect(frames.size).toBe(0)
})

it('starts playback at a double-clicked position and removes the handler on disposal', async () => {
  const player = createPlayer()
  const ready = player.setSource(source); mock.ready(player.getMediaElement()!); await ready
  const view = mountWaveform(host, { player })
  flushFrame()
  const waveform = host.querySelector('.ravl-waveform')!
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
  const waveform = host.querySelector('.ravl-waveform')!
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
  host.querySelector('.ravl-region-body')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
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
  const waveform = host.querySelector<HTMLElement>('.ravl-waveform')!
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
  const body = host.querySelector('.ravl-region-body')!
  tap(body, 300); tap(body, 300)
  expect(mock.play).not.toHaveBeenCalled()
  tap(test.viewport, 500); tap(test.viewport, 500)
  await Promise.resolve()
  expect(test.player.getCurrentTime()).toBe(0)
  expect(test.player.getSnapshot().playback).toBe('playing')
  test.cleanup()
})
