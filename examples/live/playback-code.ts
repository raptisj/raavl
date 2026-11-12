import { defaultPlaybackOptions, playbackStyles } from "./playback-example";
import type { CodeMode, CodeScene, ExampleCodeOptions } from "./snippets";
import { exampleThemeCss, stylesheetCode } from "./example-theme";
import { playbackIcons } from "../../src/dom/playback-icons";

export function playbackCode(
  scene: CodeScene,
  mode: CodeMode,
  options: ExampleCodeOptions,
) {
  const { dark = false } = options;
  const config = JSON.stringify(options.playback ?? defaultPlaybackOptions(dark), null, 2);
  const secondaryConfig = JSON.stringify(options.secondaryPlayback ?? defaultPlaybackOptions(dark), null, 2);
  const css = stylesheetCode(playbackStyles + exampleThemeCss(dark));
  if (scene === "external" && options.detached) {
    if (mode === "react") return `${css}

export default function ExternalAudio() {
  return <div className="example-app playback-app">
    <style>{css}</style>
    <audio src="/demo-a.wav" controls loop />
  </div>
}`;
    return `// HTML: <div id="audio-example"></div>
${css}
const host = document.querySelector('#audio-example')
host.className = 'example-app playback-app'
const style = document.createElement('style')
style.textContent = css
const audio = document.createElement('audio')
audio.src = '/demo-a.wav'
audio.controls = audio.loop = true
host.append(style, audio)`;
  }
  const source = "{ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }";
  const peaks = scene === "peaks" || scene === "external";
  const peaksData = options.badPeaks ? "{ ...peaks, sourceId: 'wrong-asset' }" : "peaks";
  if (mode === "react") {
    const initial = scene === "file" || peaks ? "null" : source;
    return `import { useEffect, useMemo, useState } from 'react'
import { AudioPlayer, type AudioPlayerWaveformOptions } from 'raavl/react'
import type { Source, WaveformData } from 'raavl'
import 'raavl/styles.css'

const waveform: AudioPlayerWaveformOptions = ${config}
${scene === "dual" ? `const secondaryWaveform: AudioPlayerWaveformOptions = ${secondaryConfig}\n` : ""}
${css}

export default function AudioExample() {
  const [source, setSource] = useState<Source | null>(${initial})
${scene === "url" ? "  const [url, setUrl] = useState('/demo-a.wav')\n" : ""}${scene === "external" ? "  const [media, setMedia] = useState<HTMLAudioElement | null>(null)\n" : ""}${peaks ? `  const [peaks, setPeaks] = useState<WaveformData | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    fetch('/demo-a.json', { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load demo peaks')
        return response.json()
      })
      .then(setPeaks)
      .catch(error => { if (error.name !== 'AbortError') console.error(error) })
    return () => abort.abort()
  }, [])
  const prepared = useMemo<Source | null>(() => ${scene === "external"
    ? "peaks && media ? { kind: 'media', id: 'demo-a', element: media, waveform: { kind: 'peaks', data: peaks } } : null, [peaks, media])"
    : `peaks ? { kind: 'url', id: 'demo-a', url: '/demo-a.wav', waveform: { kind: 'peaks', data: ${peaksData} } } : null, [peaks])`}
` : ""}  return <div className="example-app playback-app">
    <style>{css}</style>
${scene === "url" ? `    <form className="source-form" onSubmit={event => {
      event.preventDefault()
      setSource({ kind: 'url', id: url, url })
    }}>
      <label htmlFor="audio-url">Audio URL</label>
      <div>
        <input id="audio-url" value={url} onChange={event => setUrl(event.target.value)} required />
        <button className="primary">Load audio</button>
      </div>
      <p>Remote decoding requires CORS access. The included WAV is served locally.</p>
    </form>
` : ""}${scene === "file" ? `    <label className="file-drop">Choose a local audio file
      <input type="file" accept="audio/*" onChange={event => {
        const file = event.target.files?.[0]
        if (file) setSource({ kind: 'file', id: crypto.randomUUID(), file })
      }} />
      <span>{source?.kind === 'file' && source.file instanceof File
        ? source.file.name : 'MP3, WAV, OGG, or another format your browser supports'}</span>
    </label>
` : ""}${scene === "external" ? '    <audio ref={setMedia} src="/demo-a.wav" controls loop />\n' : ""}    <AudioPlayer source={${peaks ? "prepared" : "source"}}
      waveform={{ ...waveform, interaction: { drag: 'seek' }, 'aria-label': '${scene === "file" ? "Your recording" : "Sequence A · warm arpeggio"} waveform' }}
      controls={{ playbackRate: true, loop: true }}
      onError={console.error} aria-label="${scene === "file" ? "Your recording" : "Sequence A · warm arpeggio"}" />
${scene === "dual" ? `    <AudioPlayer source={{ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }}
      waveform={{ ...secondaryWaveform, interaction: { drag: 'seek' }, 'aria-label': 'Sequence B · bright arpeggio waveform' }}
      controls={{ playbackRate: true, loop: true }}
      onError={console.error} aria-label="Sequence B · bright arpeggio" />
` : ""}  </div>
}`;
  }

  return `import { createPlayer, mountWaveform, mountMuteButton, mountLoopButton } from 'raavl'
import 'raavl/styles.css'

// HTML: <div id="audio-example"></div>
const waveform = ${config}
${scene === "dual" ? `const secondaryWaveform = ${secondaryConfig}\n` : ""}
${css}
const host = document.querySelector('#audio-example')
host.className = 'example-app playback-app'
const style = document.createElement('style')
style.textContent = css
host.append(style)
${scene === "url" ? `host.insertAdjacentHTML('beforeend', '<form class="source-form"><label for="audio-url">Audio URL</label><div><input id="audio-url" value="/demo-a.wav" required><button class="primary">Load audio</button></div><p>Remote decoding requires CORS access. The included WAV is served locally.</p></form>')
` : ""}${scene === "file" ? `host.insertAdjacentHTML('beforeend', '<label class="file-drop">Choose a local audio file<input type="file" accept="audio/*"><span>MP3, WAV, OGG, or another format your browser supports</span></label>')
` : ""}${scene === "external" ? `const media = document.createElement('audio')
media.src = '/demo-a.wav'
media.controls = media.loop = true
host.append(media)
` : ""}
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const rest = String(total % 60).padStart(2, '0')
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + rest : minutes + ':' + rest
}
function mountPlayer(label, options = waveform) {
  const root = document.createElement('div')
  root.className = 'raavl-player'
  root.setAttribute('aria-label', label)
  root.innerHTML = \`
    <div data-waveform></div>
    <div class="raavl-controls" role="group" aria-label="Playback controls">
      <input class="raavl-seek" type="range" min="0" max="1" step="0.1" value="0" aria-label="Seek audio" disabled>
      <div class="raavl-toolbar">
        <button class="raavl-button raavl-play-pause raavl-play-pause-icon-button" aria-label="Play audio" disabled>
          <svg class="raavl-play-pause-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${playbackIcons.play}"></path></svg>
        </button>
        <output class="raavl-time" aria-label="Playback time" aria-live="off">0:00 / 0:00</output>
        <span data-mute></span>
        <input class="raavl-volume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume" disabled>
        <select class="raavl-playback-rate" aria-label="Playback speed" disabled>
          <option value="0.75">0.75×</option><option value="1" selected>1×</option>
          <option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
        </select>
        <span data-loop></span>
      </div>
    </div>
    <div class="raavl-status" role="status"></div>
  \`
  host.append(root)
  const find = selector => root.querySelector(selector)
  const player = createPlayer()
  const view = mountWaveform(find('[data-waveform]'), {
    player, ...options, interaction: { drag: 'seek' }, label: label + ' waveform',
  })
  const seek = find('.raavl-seek')
  const play = find('.raavl-play-pause')
  const playIcon = play.querySelector('path')
  const volume = find('.raavl-volume')
  const rate = find('.raavl-playback-rate')
  const status = find('.raavl-status')
  const report = error => { status.textContent = error.message; status.setAttribute('role', 'alert') }
  const mute = mountMuteButton(find('[data-mute]'), { player, onError: report })
  const loop = mountLoopButton(find('[data-loop]'), { player, onError: report })
  function command(operation) {
    try { Promise.resolve(operation()).catch(report) }
    catch (error) { report(error) }
  }
  function renderTime() {
    const time = player.getCurrentTime()
    const duration = player.getSnapshot().duration
    seek.value = Math.min(duration, Math.max(0, time))
    seek.setAttribute('aria-valuetext', formatTime(time) + ' of ' + formatTime(duration))
    find('.raavl-time').textContent = formatTime(time) + ' / ' + formatTime(duration)
  }
  function render() {
    const state = player.getSnapshot()
    const ready = state.source === 'ready'
    const playing = state.playback === 'playing' || state.playback === 'buffering'
    const pending = state.playback === 'starting'
    for (const control of [play, volume, rate]) control.disabled = !ready
    play.disabled ||= pending
    playIcon.setAttribute('d', playing ? '${playbackIcons.pause}' : '${playbackIcons.play}')
    play.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio')
    play.dataset.playing = String(playing)
    play.dataset.buffering = String(state.playback === 'buffering')
    play.setAttribute('aria-busy', String(pending || state.playback === 'buffering'))
    seek.disabled = !ready || state.duration <= 0
    seek.max = state.duration || 1
    volume.value = state.volume
    volume.setAttribute('aria-valuetext', Math.round(state.volume * 100) + '%')
    rate.value = state.playbackRate
    status.setAttribute('role', state.error ? 'alert' : 'status')
    status.textContent = state.error ? 'Audio error: ' + state.error.message
      : state.waveformError ? 'Waveform unavailable: ' + state.waveformError.message + '. Audio playback may still work.'
      : state.source === 'loading' ? 'Loading audio…'
      : state.playback === 'buffering' ? 'Buffering audio…'
      : pending ? 'Starting playback…'
      : state.waveform === 'fetching' || state.waveform === 'decoding' ? 'Preparing waveform…'
      : state.source === 'idle' ? 'No audio loaded.' : ''
    renderTime()
  }
  play.onclick = () => command(() => {
    const state = player.getSnapshot()
    return state.playback === 'playing' || state.playback === 'buffering' ? player.pause() : player.play()
  })
  seek.oninput = () => command(() => player.seek(Number(seek.value)))
  volume.oninput = () => command(() => player.setVolume(Number(volume.value)))
  rate.onchange = () => command(() => player.setPlaybackRate(Number(rate.value)))
  const off = player.subscribe(render)
  const offTime = player.subscribeTime(renderTime)
  render()
  return {
    player,
    dispose() {
      offTime()
      off()
      mute.dispose()
      loop.dispose()
      view.dispose()
      player.dispose()
      root.remove()
    },
  }
}
const primary = mountPlayer('${scene === "file" ? "Your recording" : "Sequence A · warm arpeggio"}')
${peaks ? `const response = await fetch('/demo-a.json')
if (!response.ok) throw new Error('Unable to load demo peaks')
const peaks = await response.json()
await primary.player.setSource(${scene === "external" ? "{ kind: 'media', id: 'demo-a', element: media, waveform: { kind: 'peaks', data: peaks } }" : `{ kind: 'url', id: 'demo-a', url: '/demo-a.wav', waveform: { kind: 'peaks', data: ${peaksData} } }`}).catch(console.error)
` : scene === "file" ? `host.querySelector('input[type="file"]').onchange = event => {
  const file = event.target.files?.[0]
  if (!file) return
  host.querySelector('.file-drop span').textContent = file.name
  primary.player.setSource({ kind: 'file', id: crypto.randomUUID(), file }).catch(console.error)
}
` : `await primary.player.setSource(${source}).catch(console.error)
`}${scene === "url" ? `host.querySelector('form').onsubmit = event => {
  event.preventDefault()
  const url = host.querySelector('#audio-url').value
  primary.player.setSource({ kind: 'url', id: url, url }).catch(console.error)
}
` : ""}${scene === "dual" ? `const secondary = mountPlayer('Sequence B · bright arpeggio', secondaryWaveform)
await secondary.player.setSource({ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }).catch(console.error)
` : ""}
// Call when removing the app.
function dispose() {
  primary.dispose()
${scene === "dual" ? "  secondary.dispose()\n" : ""}  host.replaceChildren()
}`;
}
