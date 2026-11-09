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

it.each([
  'bad JSON', null, [], { version: 2, name: 'Future' }, { version: 1, name: ' ' },
  { version: 1, name: 'Typo', colours: {} },
  ...[
    { height: -1 }, { height: '160' }, { lineWidth: 0 }, { lineWidth: Infinity },
    { barWidth: 0 }, { barGap: -1 }, { barRadius: null }, { amplitude: 0 },
    { cursorWidth: 21 }, { borderRadius: -1 }, { normalize: 'true' }, { style: 'dots' },
    { lineThickness: 3 },
  ].map(appearance => ({ version: 1, name: 'Invalid', appearance })),
  ...[null, [], { wave: '' }, { wave: 42 }, { unknown: '#fff' }].map(colors => ({ version: 1, name: 'Invalid', colors })),
])('rejects invalid theme config with a structured view error: %j', input => {
  expect(() => parseTheme(input)).toThrow(expect.objectContaining({ code: 'INVALID_DATA', stage: 'view' }))
})
