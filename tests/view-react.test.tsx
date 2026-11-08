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
