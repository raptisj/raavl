import { expect, it } from 'vitest'
import { legacyDocumentationPath, parseRoute } from '../examples/live/routes'

it('opens the examples gallery by default', () => {
  expect(parseRoute('')).toEqual({ scene: null, mode: 'vanilla' })
  expect(parseRoute('#demos')).toEqual(parseRoute(''))
})
it('keeps existing playground bookmarks working with their selected code', () => {
  expect(parseRoute('#annotations/react')).toEqual(parseRoute('#demos/annotations/react'))
  expect(parseRoute('#scale/vanilla')).toEqual(parseRoute('#demos/scale/vanilla'))
})
it('sends legacy documentation bookmarks to the canonical Fumadocs pages', () => {
  expect(legacyDocumentationPath('#docs/waveform')).toBe('/docs/waveform')
  expect(legacyDocumentationPath('#docs/start')).toBe('/docs')
  expect(legacyDocumentationPath('#docs/unknown')).toBe('/docs')
  expect(legacyDocumentationPath('#docs/agents')).toBe('/docs/skills')
  expect(legacyDocumentationPath('#demos/modules/react')).toBeNull()
})
it('safely falls back for unknown playground routes', () => {
  expect(parseRoute('#demos/unknown')).toEqual(parseRoute(''))
  expect(parseRoute('#url/unknown')).toEqual({ scene: 'url', mode: 'vanilla' })
})
