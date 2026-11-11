import type { ReactNode } from "react";

export function DemoSettings({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <section className="example-settings" aria-label="Demo settings">
      <h4 className="example-section-title">Demo settings</h4>
      <details className="demo-settings" open>
        <summary>{summary}</summary>
        {children}
      </details>
    </section>
  );
}
