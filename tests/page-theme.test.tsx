import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePageTheme } from '../examples/live/usePageTheme'
import { VanillaWaveform } from '../examples/live/VanillaWaveform'
import type { Player, Source } from '../src'
import { mockMedia } from './media'

let host: HTMLDivElement, root: Root, style: HTMLStyleElement | undefined

beforeEach(() => {
  document.documentElement.className = ''
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  style?.remove()
  style = undefined
  document.documentElement.className = ''
  vi.unstubAllGlobals()
})

it('tracks resolved theme changes, ignores unrelated classes, and releases its observer', async () => {
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
  let renders = 0
  function Probe() { const theme = usePageTheme(); renders++; return <span>{theme}</span> }
  await act(async () => root.render(<Probe />))
  expect(host.textContent).toBe('light')
  const initial = renders
  await act(async () => { document.documentElement.classList.add('unrelated') })
  expect(renders).toBe(initial)
  await act(async () => { document.documentElement.classList.add('dark') })
  expect(host.textContent).toBe('dark')
  await act(async () => { document.documentElement.classList.remove('dark') })
  expect(host.textContent).toBe('light')
  await act(async () => root.render(null))
  expect(disconnect).toHaveBeenCalledOnce()
})

it('redraws CSS-owned canvas colors without reloading or stopping the audio', async () => {
  const media = mockMedia()
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++next; frames.set(id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600)
  const contexts: Array<{ fillStyle: string }> = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const context = { fillStyle: '', setTransform() {}, fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }
    contexts.push(context)
    return context as unknown as CanvasRenderingContext2D
  })
  style = document.createElement('style')
  style.textContent = '.raavl-waveform { --raavl-wave-color: #9aafa7; --raavl-progress-color: #285d50; } .dark .raavl-waveform { --raavl-wave-color: #567963; --raavl-progress-color: #a0d3ae; }'
  document.head.append(style)
  let player: Player | null = null
  const source: Source = { kind: 'url', id: 'demo', url: '/demo.wav', waveform: { kind: 'none' } }
  await act(async () => root.render(<VanillaWaveform source={source} appearance={{}} viewport={{}} onPlayer={value => { player = value }} onError={error => { throw error }} />))
  const active = player as unknown as Player
  media.ready(active.getMediaElement()!)
  await active.play()
  active.seek(3)
  const element = active.getMediaElement(), loads = media.load.mock.calls.length
  const flushFrame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)) }
  flushFrame()
  expect(contexts[0].fillStyle).toBe('rgb(154, 175, 167)')
  await act(async () => { document.documentElement.classList.add('dark') })
  flushFrame()
  expect(contexts[0].fillStyle).toBe('rgb(86, 121, 99)')
  expect(contexts[1].fillStyle).toBe('rgb(160, 211, 174)')
  expect(active.getMediaElement()).toBe(element)
  expect(active.getCurrentTime()).toBe(3)
  expect(active.getSnapshot().playback).toBe('playing')
  expect(media.load.mock.calls.length).toBe(loads)
  await act(async () => { document.documentElement.classList.remove('dark') })
  flushFrame()
  expect(contexts[0].fillStyle).toBe('rgb(154, 175, 167)')
  await act(async () => root.render(null))
  expect(active.getSnapshot().source).toBe('disposed')
  expect(frames.size).toBe(0)
})
