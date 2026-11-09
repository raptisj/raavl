import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Layers3,
  MousePointer2,
} from "lucide-react";
import { AgentPrompt } from "@/components/agent-prompt";
import { AudioPlayground } from "@/components/audio-playground";
import { QuickExample } from "@/components/quick-example";
import { PlaygroundModeProvider } from "@/components/playground-mode";

export default function Home() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> AUDIO VISUALIZATION TOOLKIT
          </p>
          <h1>Highly interactive, customizable waveforms, with less wiring</h1>
          <p className="hero-description">
            An ergonomic audio toolkit with reliable playback and fully
            customizable waveforms. Simple APIs, accessible controls, and a look
            that’s yours.
          </p>
          <div className="hero-actions">
            <Link className="button-primary" href="/docs">
              Start building <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a className="text-link" href="#playground">
              Give it a listen <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className="hero-agent">
          <AgentPrompt />
          <p className="agent-note">
            Prefer to do it yourself?{" "}
            <Link href="/docs/quickstart">
              Follow the quickstart{" "}
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      <PlaygroundModeProvider>
        <section
          className="playground-section"
          id="playground"
          aria-labelledby="playground-title"
        >
          <div className="section-heading">
            <h2 id="playground-title">How it feels</h2>
          </div>
          <div className="playground-stage">
            <AudioPlayground />
            <div className="stage-footnote">
              <MousePointer2 size={13} aria-hidden="true" /> Mouse, touch, and
              keyboard. All welcome.
            </div>
          </div>
          <p className="examples-link">
            <Link className="text-link" href="/examples">
              Explore examples <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
        </section>

        <section
          className="integration-section"
          aria-labelledby="integration-title"
        >
          <div className="integration-copy">
            <p className="eyebrow">IT'S THE LITTLE THINGS</p>
            <h2 id="integration-title">Easy to wire up. Yours to shape.</h2>
            <p>
              Connect playback through clear methods and observable state. Use
              JavaScript or React, bring your own controls, and style the waveform
              to fit your application.
            </p>
            <ul className="principles">
              <li>
                <Braces size={19} aria-hidden="true" />
                <span>
                  <strong>Less state plumbing.</strong>Play, pause, seek, and
                  subscribe to changes without keeping a second playback state in
                  sync.
                </span>
              </li>
              <li>
                <MousePointer2 size={19} aria-hidden="true" />
                <span>
                  <strong>Style it where you work.</strong>Use CSS tokens,
                  reusable themes, and drawing options to control colors, bars,
                  spacing, and rounded corners.
                </span>
              </li>
              <li>
                <Layers3 size={19} aria-hidden="true" />
                <span>
                  <strong>Add features as you need them.</strong>Start with
                  playback. Add editable regions, markers, a timeline, or a
                  minimap as your interface grows.
                </span>
              </li>
            </ul>
            <div className="flex gap-4">
              <Link className="text-link" href="/docs/quickstart">
                Quickstart
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              <Link
                className="text-link"
                href="/llms.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs for agents <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <QuickExample />
        </section>
      </PlaygroundModeProvider>

      <footer className="landing-footer">
        <Link className="footer-brand" href="/">
          raavl
        </Link>
        <div>
          <a href="https://github.com/raptisj/raavl">
            GitHub <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          <Link href="/docs">Documentation</Link>
        </div>
      </footer>
    </main>
  );
}
