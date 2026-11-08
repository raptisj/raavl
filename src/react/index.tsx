import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type HTMLAttributes } from 'react'
import { createPlayer } from '../player'
import { mountWaveform, type Appearance, type Interaction, type Viewport, type WaveformView } from '../dom'
import type { Player, PlayerSnapshot, RavlError, Source } from '../core/types'

const noopSubscribe = () => () => {}
export function usePlayerState<T>(player: Player | null, selector: (state: PlayerSnapshot | null) => T): T {
  const readers = useMemo(() => {
    let previous: PlayerSnapshot | null | undefined
    let selected: T
    const server = selector(null)
    return {
      client: () => {
        const snapshot = player?.getSnapshot() ?? null
        if (snapshot !== previous) { selected = selector(snapshot); previous = snapshot }
        return selected
      },
      server: () => server,
    }
  }, [player, selector])
  return useSyncExternalStore(player?.subscribe ?? noopSubscribe, readers.client, readers.server)
}
export function usePlayerTime(player: Player | null): number {
  return useSyncExternalStore(player?.subscribeTime ?? noopSubscribe, player?.getCurrentTime ?? (() => 0), () => 0)
}

type CommonProps = Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'children'> & {
  appearance?: Appearance
  viewport?: Viewport
  interaction?: Interaction
  themeVersion?: string | number
  onError?: (error: RavlError) => void
  onPlayer?: (player: Player | null) => void
  onDraw?: () => void
}
export type WaveformProps = CommonProps & ({ source?: Source | null; player?: never } | { player: Player; source?: never })

/** Owned players are allocated after commit; supplying player opts into borrowed ownership. */
export const Waveform = forwardRef<Player | null, WaveformProps>(function Waveform({ source, player: borrowed, appearance, viewport, interaction, themeVersion, onError, onPlayer, onDraw, ...html }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const view = useRef<WaveformView | null>(null)
  const [owned, setOwned] = useState<Player | null>(null)
  const callbacks = useRef({ onError, onPlayer, onDraw })
  useEffect(() => { callbacks.current = { onError, onPlayer, onDraw } })
  const seen = useRef(new WeakSet<Error>())
  const report = useCallback((error: RavlError) => {
    if (error.code === 'CANCELLED' || seen.current.has(error)) return
    seen.current.add(error); callbacks.current.onError?.(error)
  }, [])
  const player = borrowed ?? owned
  // Like a DOM ref, this is null until the committed owned player exists.
  useImperativeHandle(ref, () => player!, [player])
  useEffect(() => {
    if (borrowed) return
    const instance = createPlayer()
    setOwned(instance)
    return () => instance.dispose()
  }, [borrowed])
  useEffect(() => {
    if (!player || player.getSnapshot().source === 'disposed' || !container.current) return
    const mounted = mountWaveform(container.current, { player, onDraw: () => callbacks.current.onDraw?.() })
    view.current = mounted
    callbacks.current.onPlayer?.(player)
    const off = player.subscribe(() => {
      const state = player.getSnapshot()
      if (state.error) report(state.error)
      if (state.waveformError) report(state.waveformError)
    })
    return () => { off(); mounted.dispose(); if (view.current === mounted) view.current = null; callbacks.current.onPlayer?.(null) }
  }, [player, report])

  // Compare scalar descriptor fields and large immutable inputs by identity.
  // An inline { kind: 'url', id, url } does not recreate the controller/load.
  const descriptor = useMemo(() => source, [
    source?.kind, source?.id, source?.revision,
    source?.kind === 'url' ? source.url : undefined,
    source?.kind === 'url' ? source.request : undefined,
    source?.kind === 'file' ? source.file : undefined,
    source?.kind === 'media' ? source.element : undefined,
    source?.waveform?.kind,
    source?.waveform?.kind === 'peaks' ? source.waveform.data : undefined,
  ])
  useEffect(() => {
    if (borrowed || !player || player.getSnapshot().source === 'disposed') return
    if (!descriptor) { player.clearSource(); return }
    const abort = new AbortController()
    void player.setSource(descriptor, { signal: abort.signal }).catch(report)
    return () => abort.abort()
  }, [player, borrowed, descriptor, report])
  useEffect(() => {
    view.current?.update({
      appearance: { style: appearance?.style, height: appearance?.height, barWidth: appearance?.barWidth, barGap: appearance?.barGap, normalize: appearance?.normalize },
      viewport: { zoom: viewport?.zoom, follow: viewport?.follow },
      interaction: { seek: interaction?.seek, drag: interaction?.drag },
      label: html['aria-label'] ?? 'Audio waveform',
    })
  }, [player, appearance?.style, appearance?.height, appearance?.barWidth, appearance?.barGap, appearance?.normalize, viewport?.zoom, viewport?.follow, interaction?.seek, interaction?.drag, html['aria-label']])
  useEffect(() => { view.current?.refreshTheme() }, [player, themeVersion])
  return <div {...html} ref={container} />
})
