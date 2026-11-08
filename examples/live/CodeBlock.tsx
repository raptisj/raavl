import { CopyButton } from './CopyButton'

export function CodeBlock({ code, label = 'Code' }: { code: string; label?: string }) {
  return <div className="code-example">
    <div className="code-heading">
      <span>{label}</span>
      <CopyButton code={code} />
    </div>
    <pre tabIndex={0} aria-label={label}><code>{code}</code></pre>
  </div>
}
