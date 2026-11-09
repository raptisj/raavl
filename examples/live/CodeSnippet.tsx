import type { HTMLAttributes } from 'react'

export type CodeSnippetProps = HTMLAttributes<HTMLPreElement> & {
  code: string
  language: 'js' | 'tsx'
}

// The documentation shell supplies its syntax highlighter. Standalone uses
// retain a readable fallback without depending on the documentation packages.
export function PlainCodeSnippet({ code, language, ...props }: CodeSnippetProps) {
  return <pre {...props}><code data-language={language}>{code}</code></pre>
}
