// @vitest-environment node
import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Waveform } from '../src/react'
import { createPlayer } from '../src'
import { Examples } from '../examples/live/Examples'
import { scenes } from '../examples/live/routes'
import { usePageTheme } from '../examples/live/usePageTheme'

it('imports, constructs an idle controller, and renders a stable wrapper without DOM globals', () => {
  expect(typeof window).toBe('undefined')
  const player = createPlayer()
  expect(player.getSnapshot().source).toBe('idle')
  expect(renderToString(<Waveform source={{ kind: 'url', id: 'a', url: '/a' }} aria-label="Audio" />)).toBe('<div aria-label="Audio"></div>')
  player.dispose()
})

it('renders the single examples gallery during SSR and links to Fumadocs', () => {
  const html = renderToString(<Examples />)
  for (const [scene] of scenes) expect(html).toContain(`href="#demos/${scene}/vanilla"`)
  expect(html).toContain('href="/docs"')
  expect(html).not.toContain('href="#docs/')
  expect(html).not.toContain('aria-label="Documentation"')
})

it('renders the page-theme hook without accessing browser globals during SSR', () => {
  function ThemeProbe() { return <span>{usePageTheme()}</span> }
  expect(typeof document).toBe('undefined')
  expect(renderToString(<ThemeProbe />)).toBe('<span>light</span>')
})
