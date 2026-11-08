import { expect, it } from 'vitest'
import { parseRoute } from '../examples/live/routes'

it('opens the examples gallery by default', () => {
  expect(parseRoute('')).toEqual({ page: 'demos', scene: null, mode: 'vanilla' })
  expect(parseRoute('#demos')).toEqual(parseRoute(''))
})
it('keeps existing playground bookmarks working with their selected code', () => {
  expect(parseRoute('#annotations/react')).toEqual(parseRoute('#demos/annotations/react'))
  expect(parseRoute('#scale/vanilla')).toEqual(parseRoute('#demos/scale/vanilla'))
})
it('resolves documentation topics and safely falls back for unknown routes', () => {
  expect(parseRoute('#docs/waveform')).toEqual({ page: 'docs', topic: 'waveform' })
  expect(parseRoute('#docs/unknown')).toEqual({ page: 'docs', topic: 'start' })
  expect(parseRoute('#demos/unknown')).toEqual(parseRoute(''))
  expect(parseRoute('#url/unknown')).toEqual({ page: 'demos', scene: 'url', mode: 'vanilla' })
})
