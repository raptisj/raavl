// Standalone app examples matching the UI inside each Preview.
import { soundcloudStyles, soundcloudTheme } from "./soundcloud";
import { annotationCode, type AnnotationCodeOptions } from "./annotation-code";
import { playbackCode } from "./playback-code";
import type { PlaybackCodeOptions } from "./playback-example";
import { exampleThemeCss, stylesheetCode } from "./example-theme";
import { modulesCode } from "./modules-code";

function soundcloudCode(mode: CodeMode, dark = false): string {
  const shared = `const theme = parseTheme(${JSON.stringify(soundcloudTheme, null, 2)})
${stylesheetCode(soundcloudStyles + exampleThemeCss(dark))}
const source = { kind: 'url'${mode === 'react' ? ' as const' : ''}, id: 'bach-classical', url: '/bach_classical.mp3' }
const formatTime = (seconds${mode === 'react' ? ': number' : ''}) => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')
`;
  if (mode === "vanilla")
    return `import { createPlayer, mountWaveform, parseTheme } from 'raavl'
import 'raavl/styles.css'

// HTML: <div id="soundcloud"></div>
${shared}
const style = document.createElement('style')
style.textContent = css
document.head.append(style)
const container = document.querySelector('#soundcloud')
container.className = 'example-app'
container.innerHTML = '<div class="sc-demo"><div class="sc-waveform"><div class="sc-canvas"></div><span class="sc-time">0:00</span><span class="sc-duration">0:00</span><div class="sc-hover"></div></div></div>'
const waveform = container.querySelector('.sc-waveform')
const time = container.querySelector('.sc-time')
const duration = container.querySelector('.sc-duration')
const hover = container.querySelector('.sc-hover')
const player = createPlayer()
const view = mountWaveform(container.querySelector('.sc-canvas'), {
  player, theme, interaction: { seek: 'click', drag: 'none' },
  label: 'SoundCloud waveform. Arrow keys seek; Space plays or pauses.',
})
const off = player.subscribe(() => {
  const state = player.getSnapshot()
  duration.textContent = formatTime(state.duration)
  if (state.error || state.waveformError) console.error(state.error || state.waveformError)
})
const offTime = player.subscribeTime(() => { time.textContent = formatTime(player.getCurrentTime()) })
function toggle() {
  const state = player.getSnapshot()
  if (state.source !== 'ready') return
  if (state.playback === 'playing' || state.playback === 'buffering') player.pause()
  else player.play().catch(console.error)
}
waveform.onclick = toggle
waveform.onkeydown = event => {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  toggle()
}
waveform.onpointermove = event => {
  const bounds = waveform.getBoundingClientRect()
  hover.style.width = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) + 'px'
}
await player.setSource(source).catch(console.error)

// On teardown:
function dispose() {
  waveform.onclick = waveform.onkeydown = waveform.onpointermove = null
  offTime(); off(); view.dispose(); player.dispose()
  container.replaceChildren(); style.remove()
}`;
  return `import { useRef, useState } from 'react'
import { parseTheme, type Player } from 'raavl'
import { Waveform, usePlayerState, usePlayerTime } from 'raavl/react'
import 'raavl/styles.css'

${shared}
export default function SoundCloudPlayer() {
  const [player, setPlayer] = useState<Player | null>(null)
  const hover = useRef<HTMLDivElement>(null)
  const state = usePlayerState(player, state => state)
  const time = usePlayerTime(player)
  function toggle() {
    if (!player || state?.source !== 'ready') return
    if (state.playback === 'playing' || state.playback === 'buffering') player.pause()
    else player.play().catch(console.error)
  }
  return <>
    <style>{css}</style>
    <div className="example-app"><div className="sc-demo">
      <div className="sc-waveform" onClick={toggle}
        onKeyDown={event => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          toggle()
        }}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (!hover.current) return
          hover.current.style.width = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)) + 'px'
        }}>
        <Waveform source={source} theme={theme} onPlayer={setPlayer}
          interaction={{ seek: 'click', drag: 'none' }} onError={console.error}
          aria-label="SoundCloud waveform. Arrow keys seek; Space plays or pauses." />
        <span className="sc-time" aria-hidden="true">{formatTime(time)}</span>
        <span className="sc-duration" aria-hidden="true">{formatTime(state?.duration ?? 0)}</span>
        <div className="sc-hover" ref={hover} aria-hidden="true" />
      </div>
    </div></div>
  </>
}`;
}
export type CodeMode = "vanilla" | "react";
export type CodeScene =
  | "url"
  | "file"
  | "peaks"
  | "external"
  | "dual"
  | "styling"
  | "annotations"
  | "scale"
  | "modules"
  | "soundcloud";

export type ExampleCodeOptions = {
  dark?: boolean;
  playback?: PlaybackCodeOptions;
  secondaryPlayback?: PlaybackCodeOptions;
  detached?: boolean;
  badPeaks?: boolean;
  annotations?: AnnotationCodeOptions;
  modules?: { zoom: number | "fit"; magnetic: boolean };
  scale?: { zoom: number | "fit"; dense: boolean };
};

export function exampleCode(scene: CodeScene, mode: CodeMode, options: ExampleCodeOptions = {}): string {
  if (scene === "soundcloud") return soundcloudCode(mode, options.dark);
  if (scene === "modules") return modulesCode(mode, options.modules, options.dark);
  if (scene === "scale") return scaleCode(mode, options.scale, options.dark);
  if (scene === "annotations") return annotationCode(mode, options.annotations, options.dark);
  return playbackCode(scene, mode, options);
}

function scaleCode(mode: CodeMode, settings: ExampleCodeOptions["scale"], dark = false) {
  const fixture = `const count = 720000
const data${mode === 'react' ? ': WaveformData' : ''} = {
  version: 1, sourceId: 'scale', duration: 7200,
  channels: [0, 1].map(channel => {
    const min = new Float32Array(count), max = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const amplitude = 0.1 + 0.8 * Math.abs(Math.sin(i * 0.017 + channel))
      min[i] = -amplitude; max[i] = amplitude
    }
    return { min, max }
  }),
}
const annotations = createAnnotations({ document: {
  version: 1, sourceId: 'scale', markers: [],
  regions: Array.from({ length: 10000 }, (_, i) => ({
    id: 'region-' + i, label: 'Phrase ' + (i + 1), start: i * 0.72, end: i * 0.72 + 0.5,
  })),
} })`;
  const options = `{ data, annotations: ${settings?.dense === false ? "null" : "annotations"}, viewport: ${JSON.stringify({ zoom: settings?.zoom ?? 100 })} }`;
  const css = stylesheetCode(exampleThemeCss(dark));
  if (mode === "vanilla")
    return `import { mountWaveform, createAnnotations } from 'raavl'
import 'raavl/styles.css'

${fixture}
${css}

// HTML: <div id="waveform"></div>
const host = document.querySelector('#waveform')
host.className = 'example-app'
const style = document.createElement('style')
style.textContent = css
host.append(style)
const view = mountWaveform(host, ${options})
// On teardown: view.dispose(); annotations.dispose()`;
  return `import { useEffect, useRef } from 'react'
import { mountWaveform, createAnnotations, type WaveformData } from 'raavl'
import 'raavl/styles.css'

${css}

// The data-only benchmark mounts the shared DOM engine in a React effect.
export default function ScaleExample() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
${fixture
  .split("\n")
  .map((line) => "    " + line)
  .join("\n")}
    const view = mountWaveform(host.current!, ${options})
    return () => { view.dispose(); annotations.dispose() }
  }, [])
  return <div className="example-app"><style>{css}</style><div ref={host} /></div>
}`;
}
