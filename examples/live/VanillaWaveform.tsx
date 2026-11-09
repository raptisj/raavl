import { useEffect, useRef } from 'react'
import { createPlayer, mountWaveform, type Player, type Source, type WaveformView, type Appearance, type Viewport, type RavlError, type WaveformTheme } from '../../src'

// The demo shell uses React; this view exercises only the vanilla library API.
export function VanillaWaveform({ source, appearance, viewport, onPlayer, onError, themeVersion, theme }: {
  source: Source | null; appearance: Appearance; viewport: Viewport
  onPlayer: (player: Player | null) => void; onError: (error: RavlError) => void; themeVersion?: string; theme?: WaveformTheme
}) {
  const container = useRef<HTMLDivElement>(null)
  const player = useRef<Player | null>(null), view = useRef<WaveformView | null>(null)
  const callbacks = useRef({ onPlayer, onError })
  callbacks.current = { onPlayer, onError }
  useEffect(() => {
    const controller = createPlayer()
    const waveform = mountWaveform(container.current!, { player: controller, interaction: { drag: 'seek' } })
    player.current = controller; view.current = waveform
    callbacks.current.onPlayer(controller)
    const off = controller.subscribe(() => {
      const state = controller.getSnapshot()
      if (state.waveformError) callbacks.current.onError(state.waveformError)
      if (state.error) callbacks.current.onError(state.error)
    })
    return () => { off(); waveform.dispose(); controller.dispose(); player.current = null; view.current = null; callbacks.current.onPlayer(null) }
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    if (source) void player.current!.setSource(source, { signal: abort.signal }).catch(error => {
      if (error.code !== 'CANCELLED') callbacks.current.onError(error)
    })
    else player.current!.clearSource()
    return () => abort.abort()
  }, [source])
  useEffect(() => { view.current?.update({ theme, appearance, viewport }) }, [theme, appearance, viewport])
  useEffect(() => { view.current?.refreshTheme() }, [themeVersion])
  return <div ref={container} />
}
