import { useSyncExternalStore } from 'react'

const readTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light'
const serverTheme = () => 'light' as const

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// The site changes CSS immediately; Canvas views must explicitly re-read colors.
export function usePageTheme() {
  return useSyncExternalStore(subscribe, readTheme, serverTheme)
}
