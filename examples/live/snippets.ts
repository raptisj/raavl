// These snippets use the implemented public API, independently of the preview.
const source = `{ kind: 'url', id: 'demo-a', url: '/demo-a.wav' }`;
const appearance = `{ style: 'bars', height: 160, barWidth: 2, barGap: 1 }`;

export type CodeMode = 'vanilla' | 'react';
export type CodeScene = 'url' | 'file' | 'peaks' | 'external' | 'dual' | 'styling' | 'annotations' | 'scale';

export function exampleCode(scene: CodeScene, mode: CodeMode): string {
  if (scene === 'scale') return scaleCode(mode);
  const annotations = scene === 'annotations';
  const setup = scene === 'peaks' || scene === 'external'
    ? `const response = await fetch('/demo-a.json')\nif (!response.ok) throw new Error('Unable to load peaks')\nconst peaks = await response.json()\n`
    : '';
  const descriptor = scene === 'peaks'
    ? `{ kind: 'url', id: 'demo-a', url: '/demo-a.wav',\n  waveform: { kind: 'peaks', data: peaks } }`
    : scene === 'external'
      ? `{ kind: 'media', id: 'demo-a', element: media,\n  waveform: { kind: 'peaks', data: peaks } }`
      : source;
  const document = `{ version: 1, sourceId: 'demo-a',\n  regions: [{ id: 'intro', start: 0.5, end: 2.5, label: 'Introduction' }],\n  markers: [{ id: 'cue', time: 8, label: 'Cue' }] }`;
  if (mode === 'vanilla') return `import { createPlayer, mountWaveform${annotations ? ', createAnnotations, stringifyAnnotations' : ''} } from 'ravl'
import 'ravl/styles.css'

// HTML: <div id="waveform"></div><button id="play">Play</button>${scene === 'file' ? '\n// <input id="file" type="file" accept="audio/*" />' : ''}${scene === 'external' ? '\n// <audio id="audio" src="/demo-a.wav" controls></audio>' : ''}${scene === 'dual' ? '\n// <div id="second-waveform"></div><button id="second-play">Play B</button>' : ''}
${setup}${scene === 'external' ? "const media = document.querySelector('#audio')\n" : ''}${annotations ? `const annotations = createAnnotations({ document: ${document} })\n` : ''}const player = createPlayer()
const view = mountWaveform(document.querySelector('#waveform'), {
  player,
  appearance: ${appearance},
  interaction: { drag: '${annotations ? 'select' : 'seek'}' },${annotations ? "\n  annotations,\n  annotationRules: { snap: 0.25, minLength: 0.1 }," : ''}
})
${scene === 'file' ? `document.querySelector('#file').onchange = event => {
  const file = event.target.files?.[0]
  if (file) player.setSource({ kind: 'file', id: crypto.randomUUID(), file }).catch(console.error)
}` : `await player.setSource(${descriptor}).catch(console.error)`}
document.querySelector('#play').onclick = () => player.play().catch(console.error)
${scene === 'dual' ? `
const second = createPlayer()
const secondView = mountWaveform(document.querySelector('#second-waveform'), { player: second })
await second.setSource({ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }).catch(console.error)
document.querySelector('#second-play').onclick = () => second.play().catch(console.error)
` : ''}${scene === 'styling' ? `
// Update in response to your controls; playback continues.
view.update({ appearance: { style: 'line', height: 200 }, viewport: { zoom: 100, follow: 'center' } })
document.querySelector('#waveform').style.setProperty('--ravl-progress-color', '#277e67')
view.refreshTheme()
` : ''}${annotations ? `
const stopSaving = annotations.onCommit(value => {
  localStorage.setItem('ravl-annotations', stringifyAnnotations(value))
})
// After dragging a selection:
// view.createRegionFromSelection(crypto.randomUUID(), 'New region')
` : ''}
// On teardown${scene === 'external' ? ' (the application-owned audio keeps playing)' : ''}:
// view.dispose(); player.dispose()${scene === 'dual' ? '; secondView.dispose(); second.dispose()' : ''}${annotations ? '; stopSaving(); annotations.dispose()' : ''}`;

  return `import { ${scene === 'file' || scene === 'external' ? 'useState, ' : ''}useRef } from 'react'
import { Waveform } from 'ravl/react'
${annotations ? "import { stringifyAnnotations } from 'ravl'\n" : ''}import 'ravl/styles.css'

${setup}${scene !== 'file' && scene !== 'external' ? `const source = ${descriptor}\n` : ''}${annotations ? `const initialAnnotations = ${document}\n` : ''}
export default function AudioExample() {
  const player = useRef(null)${scene === 'dual' ? '\n  const second = useRef(null)' : ''}${scene === 'file' ? '\n  const [source, setSource] = useState(null)' : ''}${scene === 'external' ? `
  const [media, setMedia] = useState(null)
  const source = media ? ${descriptor} : null` : ''}
  return <>
${scene === 'file' ? `    <input type="file" accept="audio/*" aria-label="Choose audio" onChange={event => {
      const file = event.target.files?.[0]
      if (file) setSource({ kind: 'file', id: crypto.randomUUID(), file })
    }} />\n` : ''}${scene === 'external' ? '    <audio ref={setMedia} src="/demo-a.wav" controls />\n' : ''}    <Waveform
      ref={player}
      source={source}
      appearance={${appearance}}
      interaction={{ drag: '${annotations ? 'select' : 'seek'}' }}${scene === 'styling' ? `
      viewport={{ zoom: 100, follow: 'center' }}
      style={{ '--ravl-progress-color': '#277e67' }}
      themeVersion="#277e67"` : ''}${annotations ? `
      defaultAnnotations={initialAnnotations}
      annotationRules={{ snap: 0.25, minLength: 0.1 }}
      onAnnotationsCommit={value => {
        localStorage.setItem('ravl-annotations', stringifyAnnotations(value))
      }}` : ''}
      onError={console.error}
    />
    <button onClick={() => player.current?.play().catch(console.error)}>Play</button>${scene === 'dual' ? `
    <Waveform ref={second}
      source={{ kind: 'url', id: 'demo-b', url: '/demo-b.wav' }}
      onError={console.error} />
    <button onClick={() => second.current?.play().catch(console.error)}>Play B</button>` : ''}
  </>
}`;
}

function scaleCode(mode: CodeMode) {
  const fixture = `const count = 720000
const data = {
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
  const options = `{ data, annotations, viewport: { zoom: 100 } }`;
  if (mode === 'vanilla') return `import { mountWaveform, createAnnotations } from 'ravl'
import 'ravl/styles.css'

${fixture}

// HTML: <div id="waveform"></div>
const view = mountWaveform(document.querySelector('#waveform'), ${options})
// On teardown: view.dispose(); annotations.dispose()`;
  return `import { useEffect, useRef } from 'react'
import { mountWaveform, createAnnotations } from 'ravl'
import 'ravl/styles.css'

// The data-only benchmark mounts the shared DOM engine in a React effect.
export default function ScaleExample() {
  const host = useRef(null)
  useEffect(() => {
${fixture.split('\n').map(line => '    ' + line).join('\n')}
    const view = mountWaveform(host.current, ${options})
    return () => { view.dispose(); annotations.dispose() }
  }, [])
  return <div ref={host} />
}`;
}
