// @vitest-environment node
import { expect, it } from 'vitest'
import { parseTheme, waveformThemes } from '../src/themes'
import catalog from '../src/themes/presets.json'

it('loads all initial themes from the JSON catalog without browser globals', () => {
  expect(typeof window).toBe('undefined')
  expect(Object.keys(waveformThemes)).toEqual(Object.keys(catalog))
  for (const [id, theme] of Object.entries(waveformThemes)) {
    expect(theme).toEqual(parseTheme(catalog[id as keyof typeof catalog]))
    expect(parseTheme(JSON.stringify(theme))).toEqual(theme)
    expect(Object.isFrozen(theme.appearance)).toBe(true)
    expect(Object.isFrozen(theme.colors)).toBe(true)
  }
  expect(waveformThemes.neon.appearance?.barRadius).toBeGreaterThan(0)
  expect(waveformThemes.paper.appearance?.lineWidth).toBeGreaterThan(waveformThemes.sage.appearance!.lineWidth!)
})

it('copies input rather than freezing or retaining mutable application config', () => {
  const input = { version: 1, name: 'Custom', appearance: { height: 220 }, colors: { wave: '#123456' } }
  const theme = parseTheme(input)
  input.appearance.height = 100
  input.colors.wave = '#ffffff'
  expect(theme.appearance?.height).toBe(220)
  expect(theme.colors?.wave).toBe('#123456')
})

it('treats explicit undefined optional fields like omitted JSON fields', () => {
  const theme = parseTheme({ version: 1, name: 'Partial', appearance: { height: undefined, lineWidth: undefined }, colors: { progress: undefined } })
  expect(theme.appearance).toEqual({})
  expect(theme.colors).toEqual({})
  expect(theme).toEqual(parseTheme(JSON.stringify(theme)))
})

it('copies and deeply freezes serializable waveform gradients without DOM globals', () => {
  const gradient = { type: 'linear-gradient', stops: [{ offset: 0, color: '#f50' }, { offset: 1, color: '#fa8' }] }
  const theme = parseTheme({ version: 1, name: 'Gradient', colors: { wave: '#666', progress: gradient } })
  gradient.stops[0].color = '#000'
  const paint = theme.colors!.progress!
  expect(typeof paint).toBe('object')
  if (typeof paint === 'string') throw new Error('Expected a gradient')
  expect(paint.axis).toBe('vertical')
  expect(paint.stops[0].color).toBe('#f50')
  expect(Object.isFrozen(paint)).toBe(true)
  expect(Object.isFrozen(paint.stops)).toBe(true)
  expect(Object.isFrozen(paint.stops[0])).toBe(true)
  expect(parseTheme(JSON.stringify(theme))).toEqual(theme)
})

it.each([
  { type: 'radial-gradient', stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] },
  { type: 'linear-gradient', axis: 'diagonal', stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] },
  { type: 'linear-gradient', stops: [] },
  { type: 'linear-gradient', stops: [{ offset: 0, color: '#000' }] },
  { type: 'linear-gradient', stops: [{ offset: -.1, color: '#000' }, { offset: 1, color: '#fff' }] },
  { type: 'linear-gradient', stops: [{ offset: 0, color: '#000' }, { offset: NaN, color: '#fff' }] },
  { type: 'linear-gradient', stops: [{ offset: .8, color: '#000' }, { offset: .2, color: '#fff' }] },
  { type: 'linear-gradient', stops: [{ offset: 0, color: '' }, { offset: 1, color: '#fff' }] },
  { type: 'linear-gradient', stops: [{ offset: 0, color: '#000', typo: true }, { offset: 1, color: '#fff' }] },
])('rejects malformed gradient paints: %j', progress => {
  expect(() => parseTheme({ version: 1, name: 'Invalid', colors: { progress } })).toThrow(expect.objectContaining({ code: 'INVALID_DATA' }))
})

it('keeps DOM color tokens as CSS strings', () => {
  expect(() => parseTheme({ version: 1, name: 'Invalid', colors: { background: { type: 'linear-gradient', stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] } } })).toThrow()
})

it.each([
  'bad JSON', null, [], { version: 2, name: 'Future' }, { version: 1, name: ' ' },
  { version: 1, name: 'Typo', colours: {} },
  ...[
    { height: -1 }, { height: '160' }, { lineWidth: 0 }, { lineWidth: Infinity },
    { barWidth: 0 }, { barGap: -1 }, { barRadius: null }, { amplitude: 0 },
    { cursorWidth: 21 }, { borderRadius: -1 }, { normalize: 'true' }, { style: 'dots' },
    { lineThickness: 3 }, { splitChannels: 'true' },
  ].map(appearance => ({ version: 1, name: 'Invalid', appearance })),
  ...[null, [], { wave: '' }, { wave: 42 }, { unknown: '#fff' }].map(colors => ({ version: 1, name: 'Invalid', colors })),
])('rejects invalid theme config with a structured view error: %j', input => {
  expect(() => parseTheme(input)).toThrow(expect.objectContaining({ code: 'INVALID_DATA', stage: 'view' }))
})
