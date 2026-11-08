// @vitest-environment node
import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Waveform } from '../src/react'
import { createPlayer } from '../src'

it('imports, constructs an idle controller, and renders a stable wrapper without DOM globals', () => {
  expect(typeof window).toBe('undefined')
  const player = createPlayer()
  expect(player.getSnapshot().source).toBe('idle')
  expect(renderToString(<Waveform source={{ kind: 'url', id: 'a', url: '/a' }} aria-label="Audio" />)).toBe('<div aria-label="Audio"></div>')
  player.dispose()
})
