"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";
import { HighlightedCode } from "./highlighted-code";
import { usePlaygroundMode } from "./playground-mode";

const code = {
  playback: {
    JavaScript: `import { createPlayer, mountWaveform } from 'raavl';
import 'raavl/styles.css';

const player = createPlayer();
const view = mountWaveform(container, {
  player,
  interaction: { drag: 'seek' },
});

await player.setSource({
  kind: 'url', id: 'my-audio', url: '/audio.mp3',
});
// Bind your controls to player.play(), pause(), seek().
// On teardown: view.dispose(); player.dispose();`,
    React: `import { AudioPlayer } from 'raavl/react';
import 'raavl/styles.css';

export function AudioPlayback() {
  return <AudioPlayer
    source={{ kind: 'url', id: 'my-audio', url: '/audio.mp3' }}
    waveform={{ interaction: { drag: 'seek' } }}
    controls={{ playbackRate: true, loop: true }}
    aria-label="Audio player"
  />;
}`,
  },
  regions: {
    JavaScript: `import { createPlayer, mountWaveform, createAnnotations } from 'raavl';
import 'raavl/styles.css';

const player = createPlayer();
const annotations = createAnnotations({
  document: {
    version: 1, sourceId: 'my-audio', markers: [],
    regions: [{ id: 'intro', start: 2, end: 5, label: 'Introduction' }],
  },
  rules: { minLength: 0.1 },
});
const view = mountWaveform(container, {
  player, annotations,
  interaction: { drag: 'select' },
  annotationRules: { minLength: 0.1 },
});
await player.setSource({
  kind: 'url', id: 'my-audio', url: '/audio.mp3',
});

// Drag a region to move it; drag its edges to resize.
// Connect your editing controls:
// view.createRegionFromSelection(crypto.randomUUID(), 'New region');
// annotations.updateRegion('intro', { label: 'Opening' });
// void player.playRange(annotations.getSnapshot().document.regions[0]).catch(console.error);
// annotations.remove('intro');

// On teardown: view.dispose(); annotations.dispose(); player.dispose();`,
    React: `import { useState } from 'react';
import type { AnnotationDocument } from 'raavl';
import { Waveform } from 'raavl/react';
import 'raavl/styles.css';

const initial: AnnotationDocument = {
  version: 1, sourceId: 'my-audio', markers: [],
  regions: [{ id: 'intro', start: 2, end: 5, label: 'Introduction' }],
};

export function AudioRegions() {
  const [annotations, setAnnotations] = useState({ value: initial, revision: 0 });
  return <Waveform
    source={{ kind: 'url', id: 'my-audio', url: '/audio.mp3' }}
    annotations={annotations.value}
    annotationsRevision={annotations.revision}
    onAnnotationsCommit={(value, change) => {
      setAnnotations(current => change.baseRevision === current.revision
        ? { value, revision: current.revision + 1 }
        : current);
    }}
    interaction={{ drag: 'select' }}
    annotationRules={{ minLength: 0.1 }}
    onSelectionChange={range => console.log('Selection', range)}
    onAnnotationSelect={id => console.log('Selected region', id)}
    onError={console.error}
    aria-label="Editable audio regions"
  />;
}`,
  },
};

const frameworks = ["React", "JavaScript"] as const;

export function QuickExample() {
  const { mode } = usePlaygroundMode();
  const [framework, setFramework] =
    useState<(typeof frameworks)[number]>("React");
  const snippet = code[mode][framework];

  return (
    <div className="quick-example">
      <div className="example-toolbar">
        <div
          role="tablist"
          aria-label="Example framework"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "React"
                : event.key === "End"
                  ? "JavaScript"
                  : framework === "React"
                    ? "JavaScript"
                    : "React";
            setFramework(next);
            document.getElementById(`tab-${next}`)?.focus();
          }}
        >
          {frameworks.map((value) => (
            <button
              key={value}
              id={`tab-${value}`}
              type="button"
              role="tab"
              tabIndex={framework === value ? 0 : -1}
              aria-selected={framework === value}
              aria-controls="quick-code"
              onClick={() => setFramework(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <CopyButton text={snippet} />
      </div>
      <HighlightedCode
        code={snippet}
        language={framework === "React" ? "tsx" : "js"}
        id="quick-code"
        role="tabpanel"
        aria-labelledby={`tab-${framework}`}
        tabIndex={0}
      />
    </div>
  );
}
