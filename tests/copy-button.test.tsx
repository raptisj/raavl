import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { CopyButton } from '../examples/live/CopyButton'

it('replaces the copy label for two seconds and restarts the timer on another copy', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(async () => root.render(<CopyButton code="example code" />))
    const button = host.querySelector('button')!
    expect(button.textContent).toBe('Copy code')
    await act(async () => button.click())
    expect(writeText).toHaveBeenCalledWith('example code')
    expect(button.textContent).toBe('Copied')
    await act(async () => vi.advanceTimersByTime(1000))
    await act(async () => button.click())
    await act(async () => vi.advanceTimersByTime(1999))
    expect(button.textContent).toBe('Copied')
    await act(async () => vi.advanceTimersByTime(1))
    expect(button.textContent).toBe('Copy code')
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await act(async () => button.click())
    expect(button.textContent).toBe('Copy code')
    expect(host.querySelector('[role=status]')?.textContent).toContain('Select the code')
  } finally {
    await act(async () => root.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})
