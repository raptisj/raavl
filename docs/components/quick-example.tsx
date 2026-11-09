'use client';

import { useState } from 'react';
import { CopyButton } from './copy-button';

const code = {
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
  React: `import { Waveform } from 'raavl/react';
import 'raavl/styles.css';

export function AudioWaveform() {
  return <Waveform
    source={{
      kind: 'url', id: 'my-audio', url: '/audio.mp3',
    }}
    interaction={{ drag: 'seek' }}
    onError={console.error}
    aria-label="Audio waveform"
  />;
}`,
};

export function QuickExample() {
  const [mode, setMode] = useState<keyof typeof code>('React');
  return <div className="quick-example"><div className="example-toolbar"><div role="tablist" aria-label="Example framework" onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'React' : event.key === 'End' ? 'JavaScript' : mode === 'React' ? 'JavaScript' : 'React';
    setMode(next);
    document.getElementById(`tab-${next}`)?.focus();
  }}>{(['React', 'JavaScript'] as const).map(value => <button key={value} id={`tab-${value}`} type="button" role="tab" tabIndex={mode === value ? 0 : -1} aria-selected={mode === value} aria-controls="quick-code" onClick={() => setMode(value)}>{value}</button>)}</div><CopyButton text={code[mode]} /></div><pre id="quick-code" role="tabpanel" aria-labelledby={`tab-${mode}`} tabIndex={0}><code>{code[mode]}</code></pre></div>;
}
