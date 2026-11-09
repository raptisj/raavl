'use client';

import type { CSSProperties, ReactNode } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import type { CodeSnippetProps } from '../../examples/live/CodeSnippet';

function TokenContents({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <span className="shiki example-code-tokens" style={style}>{children}</span>;
}

const options = {
  themes: { light: "github-light", dark: "github-dark" },
  components: { pre: TokenContents },
};

export function HighlightedCode({ code, language, ...props }: CodeSnippetProps) {
  return (
    <pre {...props}>
      <DynamicCodeBlock code={code} lang={language} options={options} />
    </pre>
  );
}
