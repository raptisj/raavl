export const scenes = [
  ['url', '01', 'URL playback', 'Load audio, then click or drag its waveform to seek.'],
  ['file', '02', 'Your audio file', 'Open audio from your computer. Nothing is uploaded.'],
  ['peaks', '03', 'Precomputed peaks', 'Supplied waveform data, without browser audio decoding.'],
  ['external', '04', 'Existing media', 'A waveform attached to an audio element owned by this page.'],
  ['dual', '05', 'Two players', 'Independent sources, positions, volume, and lifecycles.'],
  ['styling', '06', 'Style & interaction', 'Change the appearance while audio keeps playing.'],
  ['annotations', '07', 'Annotation editor', 'Create, resize, label, and persist regions and markers.'],
  ['scale', '08', 'Scale lab', 'Measure a two-hour waveform and 10,000 editable annotations.'],
] as const
export const topics = [
  ['start', 'Getting started'], ['sources', 'Sources & peaks'], ['player', 'Player API'],
  ['waveform', 'Waveform options'], ['react', 'React API'], ['annotations', 'Annotations'],
  ['styling', 'Styling'], ['interactions', 'Touch & keyboard'], ['errors', 'State & errors'],
] as const
export type Scene = typeof scenes[number][0]
export type Topic = typeof topics[number][0]
export type Mode = 'vanilla' | 'react'
export type Route = { page: 'demos'; scene: Scene | null; mode: Mode } | { page: 'docs'; topic: Topic }
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/')
  if (parts[0] === 'docs') return { page: 'docs', topic: topics.some(([id]) => id === parts[1]) ? parts[1] as Topic : 'start' }
  const [scene, mode] = parts[0] === 'demos' ? parts.slice(1) : parts
  return { page: 'demos', scene: scenes.some(([id]) => id === scene) ? scene as Scene : null, mode: mode === 'react' ? 'react' : 'vanilla' }
}
