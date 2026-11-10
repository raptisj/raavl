import { useEffect, useRef, useState } from 'react'
import { createPlayer, mountWaveform, type Player, type RaavlError } from 'raavl'
import { Waveform, usePlayerState, usePlayerTime } from 'raavl/react'
import type { Mode } from './routes'
import { soundcloudSource, soundcloudStyles, soundcloudTheme, soundcloudTime } from './soundcloud'

const selectState = (state: ReturnType<Player['getSnapshot']> | null) => state

function VanillaCanvas({ onPlayer, onError }: {
  onPlayer: (player: Player | null) => void
  onError: (error: RaavlError) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const player = createPlayer()
    const view = mountWaveform(container.current!, {
      player, theme: soundcloudTheme,
      interaction: { seek: 'click', drag: 'none' },
      label: 'SoundCloud-style waveform. Arrow keys seek; Space plays or pauses.',
    })
    onPlayer(player)
    const off = player.subscribe(() => {
      const state = player.getSnapshot()
      if (state.waveformError) onError(state.waveformError)
      if (state.error) onError(state.error)
    })
    void player.setSource(soundcloudSource).catch(error => {
      if (error.code !== 'CANCELLED') onError(error)
    })
    return () => { off(); view.dispose(); player.dispose(); onPlayer(null) }
  }, [onPlayer, onError])
  return <div ref={container} />
}

export function SoundCloudPlayer({ mode }: { mode: Mode }) {
  const [player, setPlayer] = useState<Player | null>(null)
  const [error, setError] = useState<RaavlError | null>(null)
  const hover = useRef<HTMLDivElement>(null)
  const state = usePlayerState(player, selectState)
  const time = usePlayerTime(player)
  function togglePlayback() {
    if (!player || state?.source !== 'ready') return
    if (state.playback === 'playing' || state.playback === 'buffering') player.pause()
    else void player.play().catch(setError)
  }
  return <>
    <style>{soundcloudStyles}</style>
    <div className="sc-demo">
      <div className="sc-waveform" onClick={togglePlayback}
        onKeyDown={event => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          togglePlayback()
        }}
        onPointerMove={event => {
          if (!hover.current) return
          const bounds = event.currentTarget.getBoundingClientRect()
          hover.current.style.width = `${Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))}px`
        }}>
        {mode === 'react' ? <Waveform source={soundcloudSource} theme={soundcloudTheme}
          onPlayer={setPlayer} onError={setError}
          interaction={{ seek: 'click', drag: 'none' }}
          aria-label="SoundCloud-style waveform. Arrow keys seek; Space plays or pauses." />
          : <VanillaCanvas onPlayer={setPlayer} onError={setError} />}
        <span className="sc-time" aria-hidden="true">{soundcloudTime(time)}</span>
        <span className="sc-duration" aria-hidden="true">{soundcloudTime(state?.duration ?? 0)}</span>
        <div className="sc-hover" ref={hover} aria-hidden="true" />
      </div>
    </div>
    <p className="helper">Click the waveform to seek and play or pause. Arrow keys seek; Space plays or pauses. Audio: Bach · classical.</p>
    {error && <p role="alert">{error.message}</p>}
  </>
}
