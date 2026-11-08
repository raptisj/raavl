import { useEffect, useRef, useState } from 'react'

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      if (!mounted.current) return
      if (timer.current !== null) clearTimeout(timer.current)
      setError('')
      setCopied(true)
      timer.current = setTimeout(() => {
        setCopied(false)
        timer.current = null
      }, 2000)
    } catch {
      if (mounted.current) setError('Select the code below to copy it.')
    }
  }
  return <>
    <button type="button" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy code'}</button>
    {error && <span role="status">{error}</span>}
  </>
}
