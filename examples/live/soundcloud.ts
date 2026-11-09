import { parseTheme, type Source } from '../../src'

export const soundcloudSource: Source = {
  kind: 'url', id: 'bach-classical', url: '/bach_classical.mp3',
}

// Serializable theme data: no private canvas access or custom renderer.
export const soundcloudTheme = parseTheme({
  version: 1,
  name: 'SoundCloud',
  appearance: {
    style: 'bars', height: 128, barWidth: 2, barGap: 1, barRadius: 0,
    cursorWidth: 0, borderRadius: 0, normalize: true,
  },
  colors: {
    background: '#ffffff', focus: '#ff5500',
    wave: {
      type: 'linear-gradient',
      stops: [
        { offset: 0, color: '#656666' },
        { offset: .5, color: '#656666' },
        { offset: .5, color: '#ffffff' },
        { offset: .515625, color: '#ffffff' },
        { offset: .515625, color: '#b1b1b1' },
        { offset: 1, color: '#b1b1b1' },
      ],
    },
    progress: {
      type: 'linear-gradient',
      stops: [
        { offset: 0, color: '#ee772f' },
        { offset: .5, color: '#eb4926' },
        { offset: .5, color: '#ffffff' },
        { offset: .515625, color: '#ffffff' },
        { offset: .515625, color: '#f6b094' },
        { offset: 1, color: '#f6b094' },
      ],
    },
  },
})

export const soundcloudStyles = `
.sc-demo { padding: 28px 20px; border: 1px solid #dedede; border-radius: 4px; background: #fff; color: #333; }
.sc-waveform { position: relative; cursor: pointer; isolation: isolate; }
.sc-hover { position: absolute; inset: 0 auto 0 0; z-index: 10; height: 100%; width: 0; pointer-events: none; mix-blend-mode: overlay; background: rgba(255,255,255,.5); opacity: 0; transition: opacity .2s ease; }
.sc-waveform:hover .sc-hover { opacity: 1; }
.sc-time, .sc-duration { position: absolute; z-index: 11; top: 50%; margin-top: -1px; transform: translateY(-50%); font: 11px/1.3 Arial,sans-serif; background: rgba(0,0,0,.75); padding: 2px; color: #ddd; pointer-events: none; font-variant-numeric: tabular-nums; }
.sc-time { left: 0; }
.sc-duration { right: 0; }
`

export const soundcloudTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
