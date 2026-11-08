import { failure, finite, validateWaveform } from '../core/data'
import type { Player, WaveformData } from '../core/types'

export type Appearance = { style?: 'line' | 'bars'; height?: number; barWidth?: number; barGap?: number; normalize?: boolean }
export type Viewport = { zoom?: number | 'fit'; follow?: 'off' | 'visible' | 'center' }
export type Interaction = { seek?: 'click' | 'off'; drag?: 'none' | 'seek' }
export type ViewOptions = {
  appearance?: Appearance
  viewport?: Viewport
  interaction?: Interaction
  label?: string
  onDraw?: () => void
} & ({ player: Player; data?: never } | { data: WaveformData; player?: never })
export type ViewUpdate = Pick<ViewOptions, 'appearance' | 'viewport' | 'interaction' | 'label' | 'onDraw'> & { data?: WaveformData }
export type WaveformView = { update(options: ViewUpdate): void; refreshTheme(): void; dispose(): void }

const defaults = {
  appearance: { style: 'line', height: 160, barWidth: 2, barGap: 1, normalize: false } as Required<Appearance>,
  viewport: { zoom: 'fit', follow: 'visible' } as Required<Viewport>,
  interaction: { seek: 'click', drag: 'none' } as Required<Interaction>,
}
function merge<T extends object>(base: T, patch: Partial<T> | undefined, fallback: T): T {
  const next = { ...base }
  for (const key of Object.keys(patch ?? {}) as Array<keyof T>) next[key] = patch![key] ?? fallback[key]
  return next
}

/** Mount a light-DOM waveform. View disposal never disposes a borrowed player. */
export function mountWaveform(container: HTMLElement, options: ViewOptions): WaveformView {
  if (!container || Boolean(options.player) === Boolean(options.data)) throw failure('INVALID_DATA', 'view', 'Provide exactly one player or waveform data')
  let appearance = { ...defaults.appearance }, viewport = { ...defaults.viewport }, interaction = { ...defaults.interaction }
  let data = options.data ? validateWaveform(options.data) : options.player?.getSnapshot().data ?? null
  let label = options.label ?? 'Audio waveform'
  let onDraw = options.onDraw
  let disposed = false, frame = 0, width = 1, totalWidth = 1, duration = 0, normalization = 1
  let lastData: WaveformData | null = null
  let pointer: number | null = null
  let dirty = true
  const player = options.player
  const root = document.createElement('div')
  root.className = 'ravl-waveform'; root.dataset.ravlView = ''
  Object.assign(root.style, { position: 'relative', overflowX: 'auto', overflowY: 'hidden', width: '100%' })
  const surface = document.createElement('div'); surface.className = 'ravl-surface'
  Object.assign(surface.style, { position: 'relative', height: '100%' })
  const wave = document.createElement('canvas'), progress = document.createElement('canvas')
  wave.className = 'ravl-wave'; progress.className = 'ravl-progress'
  for (const canvas of [wave, progress]) {
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, { position: 'absolute', top: '0', pointerEvents: 'none' })
    surface.append(canvas)
  }
  const cursor = document.createElement('div'); cursor.className = 'ravl-cursor'
  Object.assign(cursor.style, { position: 'absolute', top: '0', bottom: '0', width: '2px', background: 'var(--ravl-progress-color, #285d50)', pointerEvents: 'none' })
  surface.append(cursor); root.append(surface); container.append(root)
  root.setAttribute('role', player ? 'slider' : 'img')
  if (player) { root.tabIndex = 0; root.setAttribute('aria-valuemin', '0'); root.setAttribute('aria-orientation', 'horizontal') }
  const context = wave.getContext('2d'), progressContext = progress.getContext('2d')
  if (!context || !progressContext) { root.remove(); throw failure('INVALID_DATA', 'view', 'Canvas 2D is unavailable') }
  const ctx = context, playedCtx = progressContext
  const request = () => { if (!disposed && !frame) frame = requestAnimationFrame(tick) }
  const invalidate = () => { dirty = true; request() }
  function draw() {
    width = Math.max(1, root.clientWidth)
    duration = player?.getSnapshot().duration || data?.duration || 0
    totalWidth = viewport.zoom === 'fit' ? width : Math.max(width, duration * viewport.zoom)
    surface.style.width = `${totalWidth}px`
    root.style.height = `${appearance.height}px`
    const ratio = Math.min(devicePixelRatio || 1, 3)
    for (const canvas of [wave, progress]) {
      canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(appearance.height * ratio)
      canvas.style.width = `${width}px`; canvas.style.height = `${appearance.height}px`
      canvas.style.left = `${root.scrollLeft}px`
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const style = getComputedStyle(root)
    ctx.fillStyle = style.getPropertyValue('--ravl-wave-color').trim() || '#9aafa7'
    if (data) {
      if (lastData !== data) {
        normalization = 0
        for (const channel of data.channels) for (let i = 0; i < channel.min.length; i++) normalization = Math.max(normalization, Math.abs(channel.min[i]), Math.abs(channel.max[i]))
        lastData = data
      }
      const scale = appearance.normalize ? 1 / (normalization || 1) : 1
      const height = appearance.height / data.channels.length
      const step = appearance.style === 'bars' ? appearance.barWidth + appearance.barGap : 1
      data.channels.forEach((channel, channelIndex) => {
        const center = height * (channelIndex + 0.5)
        // Draw only the viewport. Aggregate all buckets covered by a pixel/bar.
        for (let x = 0; x < width; x += step) {
          const start = Math.floor((root.scrollLeft + x) / totalWidth * channel.min.length)
          const end = Math.min(channel.min.length, Math.max(start + 1, Math.ceil((root.scrollLeft + x + step) / totalWidth * channel.min.length)))
          let lo = 0, hi = 0
          for (let j = start; j < end; j++) { lo = Math.min(lo, channel.min[j]); hi = Math.max(hi, channel.max[j]) }
          const top = center - hi * height * 0.45 * scale
          const bottom = center - lo * height * 0.45 * scale
          ctx.fillRect(x, top, appearance.style === 'bars' ? appearance.barWidth : 1, Math.max(1, bottom - top))
        }
      })
    } else { ctx.globalAlpha = 0.35; ctx.fillRect(0, appearance.height / 2, width, 1); ctx.globalAlpha = 1 }
    playedCtx.drawImage(wave, 0, 0)
    playedCtx.globalCompositeOperation = 'source-in'
    playedCtx.fillStyle = style.getPropertyValue('--ravl-progress-color').trim() || '#285d50'
    playedCtx.fillRect(0, 0, progress.width, progress.height)
    playedCtx.globalCompositeOperation = 'source-over'
    root.setAttribute('aria-label', label)
    if (player) {
      root.setAttribute('aria-valuemax', String(duration))
      root.setAttribute('aria-disabled', String(player.getSnapshot().source !== 'ready' || interaction.seek === 'off'))
    }
    onDraw?.()
  }
  function tick() {
    frame = 0
    if (disposed) return
    if (dirty) { dirty = false; draw() }
    const state = player?.getSnapshot()
    const time = player?.getMediaElement()?.currentTime ?? 0
    const x = duration ? time / duration * totalWidth : 0
    progress.style.clipPath = `inset(0 ${Math.max(0, width - (x - root.scrollLeft))}px 0 0)`
    cursor.style.left = `${x}px`; cursor.hidden = !player || !duration
    if (player) { root.setAttribute('aria-valuenow', String(time)); root.setAttribute('aria-valuetext', `${time.toFixed(1)} of ${duration.toFixed(1)} seconds`) }
    if (state?.playback === 'playing' && pointer === null) {
      if (viewport.follow === 'center') root.scrollLeft = x - width / 2
      else if (viewport.follow === 'visible' && (x < root.scrollLeft || x > root.scrollLeft + width - 10)) root.scrollLeft = Math.max(0, x - width * 0.15)
    }
    if (state?.playback === 'playing' || state?.playback === 'buffering') request()
  }
  const seekAt = (clientX: number) => {
    if (!player || player.getSnapshot().source !== 'ready') return
    const x = clientX - root.getBoundingClientRect().left + root.scrollLeft
    player.seekFraction(Math.max(0, Math.min(1, x / totalWidth)))
    request()
  }
  const click = (event: MouseEvent) => { if (interaction.seek === 'click') seekAt(event.clientX) }
  const down = (event: PointerEvent) => {
    if (!player || event.button !== 0 || interaction.drag !== 'seek' || player.getSnapshot().source !== 'ready') return
    pointer = event.pointerId; root.setPointerCapture(pointer); seekAt(event.clientX)
  }
  const move = (event: PointerEvent) => { if (event.pointerId === pointer) seekAt(event.clientX) }
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return
    if (root.hasPointerCapture(pointer)) root.releasePointerCapture(pointer)
    pointer = null
  }
  const key = (event: KeyboardEvent) => {
    if (!player || interaction.seek === 'off' || player.getSnapshot().source !== 'ready') return
    const now = player.getMediaElement()?.currentTime ?? 0
    const step = event.shiftKey ? 10 : 1
    const times: Record<string, number> = { ArrowRight: now + step, ArrowLeft: now - step, Home: 0, End: duration }
    if (event.key in times) { event.preventDefault(); player.seek(Math.max(0, Math.min(duration, times[event.key]))); request() }
  }
  root.addEventListener('click', click); root.addEventListener('keydown', key)
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move)
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('lostpointercapture', up)
  root.addEventListener('scroll', invalidate, { passive: true })
  const observer = new ResizeObserver(invalidate); observer.observe(root)
  const unsubscribe = player?.subscribe(() => {
    const next = player.getSnapshot().data
    if (next !== data || duration !== player.getSnapshot().duration) { data = next; dirty = true }
    if (player.getSnapshot().source === 'disposed') pointer = null
    request()
  })
  const unsubscribeTime = player?.subscribeTime(request)
  const view: WaveformView = {
    update(patch) {
      if (disposed) throw failure('DISPOSED', 'view', 'View has been disposed')
      const a = merge(appearance, patch.appearance, defaults.appearance)
      const v = merge(viewport, patch.viewport, defaults.viewport)
      const i = merge(interaction, patch.interaction, defaults.interaction)
      finite(a.height, 'Height', 24, 2000); finite(a.barWidth, 'Bar width', 0.5, 100); finite(a.barGap, 'Bar gap', 0, 100)
      if (v.zoom !== 'fit') finite(v.zoom, 'Zoom', 0.01, 10000)
      if (!['line', 'bars'].includes(a.style) || !['off', 'visible', 'center'].includes(v.follow) || !['click', 'off'].includes(i.seek) || !['none', 'seek'].includes(i.drag)) throw failure('INVALID_DATA', 'view', 'Unsupported view option')
      if (patch.data) {
        if (player) throw failure('INVALID_DATA', 'view', 'Player views receive data from the player')
        validateWaveform(patch.data)
      }
      appearance = a; viewport = v; interaction = i
      if (patch.data) data = patch.data
      if (patch.label !== undefined) label = patch.label
      if ('onDraw' in patch) onDraw = patch.onDraw
      root.style.touchAction = interaction.drag === 'seek' ? 'pan-y' : 'auto'
      invalidate()
    },
    refreshTheme: invalidate,
    dispose() {
      if (disposed) return
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); unsubscribe?.(); unsubscribeTime?.()
      root.removeEventListener('click', click); root.removeEventListener('keydown', key)
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up); root.removeEventListener('lostpointercapture', up)
      root.removeEventListener('scroll', invalidate); root.remove()
    },
  }
  try { view.update(options) } catch (error) { view.dispose(); throw error }
  return view
}
