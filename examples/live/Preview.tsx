import type { ReactNode } from "react";
import { usePageTheme } from "./usePageTheme";
import { exampleThemeCss } from "./example-theme";

export function Preview({ children }: { children: ReactNode }) {
  const dark = usePageTheme() === "dark";
  return (
    <section className="example-preview" aria-label="Preview">
      <h4 className="example-section-title">Preview</h4>
      <div className="library-preview">
        <div className="example-app">
          {children}
          <style>{exampleThemeCss(dark)}</style>
        </div>
      </div>
    </section>
  );
}
