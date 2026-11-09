export const scenes = [
  ['url', '01', 'URL playback', 'Load audio, then click or drag its waveform to seek.'],
  ['file', '02', 'Your audio file', 'Open audio from your computer. Nothing is uploaded.'],
  ['peaks', '03', 'Precomputed peaks', 'Supplied waveform data, without browser audio decoding.'],
  ['external', '04', 'Existing media', 'A waveform attached to an audio element owned by this page.'],
  ['dual', '05', 'Two players', 'Independent sources, positions, volume, and lifecycles.'],
  ['styling', '06', 'Style & interaction', 'Try JSON themes, drawing geometry, colors, and live playback controls.'],
  ['annotations', '07', 'Annotation editor', 'Create, resize, label, and persist regions and markers.'],
  ['scale', '08', 'Scale lab', 'Measure a two-hour waveform and 10,000 editable annotations.'],
  ['modules', '09', 'Optional modules', 'Timeline, minimap, undo/redo, and magnetic snapping.'],
  ['soundcloud', '10', 'SoundCloud-style player', 'Gray and orange gradients, hover highlighting, time badges, and click-to-play interaction.'],
] as const
export type Scene = typeof scenes[number][0]
export type Mode = 'vanilla' | 'react'
export type Route = { scene: Scene | null; mode: Mode }
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/')
  const [scene, mode] = parts[0] === 'demos' ? parts.slice(1) : parts
  return { scene: scenes.some(([id]) => id === scene) ? scene as Scene : null, mode: mode === 'react' ? 'react' : 'vanilla' }
}

// Old documentation bookmarks lead to the single Fumadocs reference.
export function legacyDocumentationPath(hash: string): string | null {
  const [section, topic] = hash.replace(/^#/, '').split('/')
  if (section !== 'docs') return null
  if (topic === 'agents' || topic === 'skills') return '/docs/skills'
  const pages = ['quickstart', 'sources', 'player', 'waveform', 'react', 'annotations', 'modules', 'styling', 'interactions', 'errors']
  return pages.includes(topic) ? `/docs/${topic}` : '/docs'
}
