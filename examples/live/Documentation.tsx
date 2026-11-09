import { type ReactNode, useState } from 'react'
import { CodeBlock } from './CodeBlock'
import { exampleCode } from './snippets'
import { topics, type Topic, type Mode } from './routes'

type Row = readonly [string, string, string]
function Reference({ rows, label = 'API reference' }: { rows: readonly Row[]; label?: string }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={label}><table><caption>{label}</caption><thead><tr><th>Name</th><th>Type / default</th><th>Usage</th></tr></thead><tbody>{rows.map(([name, type, description]) => <tr key={name}><th scope="row"><code>{name}</code></th><td><code>{type}</code></td><td>{description}</td></tr>)}</tbody></table></div>
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="doc-section"><h3>{title}</h3>{children}</section>
}
function Usage({ scene = 'url' }: { scene?: Parameters<typeof exampleCode>[0] }) {
  const [mode, setMode] = useState<Mode>('vanilla')
  return <><div className="frameworks code-switch" role="group" aria-label="Usage framework">{(['vanilla', 'react'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'vanilla' ? 'Vanilla JS' : 'React'}</button>)}</div><CodeBlock key={mode} code={exampleCode(scene, mode)} label={`${mode === 'vanilla' ? 'JavaScript' : 'React JSX'} usage`} /></>
}
const appearance: Row[] = [
  ['style', "'line' | 'bars' · 'line'", 'Envelope or vertical bars.'],
  ['height', 'number · 160', 'Waveform height in CSS pixels, from 24 to 2000.'],
  ['barWidth', 'number · 2', 'Bar width in CSS pixels, from 0.5 to 100.'],
  ['barGap', 'number · 1', 'Space between bars in CSS pixels, from 0 to 100.'],
  ['normalize', 'boolean · false', 'Scale waveform amplitudes to fill the available height.'],
]
const viewport: Row[] = [
  ['zoom', "'fit' | number · 'fit'", 'Fit the duration to the container, or use 0.01–10,000 CSS pixels per second.'],
  ['follow', "'off' | 'visible' | 'center' · 'visible'", 'Control automatic scrolling during playback.'],
]
const interaction: Row[] = [
  ['seek', "'click' | 'off' · 'click'", 'Enable click/tap and keyboard seeking. Selection mode suppresses click/tap seeking.'],
  ['drag', "'none' | 'seek' | 'select' · 'none'", 'Disable dragging, scrub the playhead, or drag a time selection for annotations.'],
]
const annotationOptions: Row[] = [
  ['annotations', 'AnnotationStore | ControlledAnnotations | null', 'Attach a store or a controlled document. Null detaches annotations.'],
  ['snapAnnotation', '(time, context) => number', 'Optional pointer snap function; import createSnapper from ravl/snapping. Keyboard edits retain the grid step.'],
  ['annotationRules', 'AnnotationRules', 'Constraints for interactive edits; see Annotations.'],
  ['renderRegionLabel', '(region) => HTMLElement | { element, dispose }', 'Provide a DOM label and optional cleanup callback. React uses a ReactNode instead.'],
  ['onSelectionChange', '(Selection) => void', 'Receive { start, end } in seconds, or null when the selection clears.'],
  ['onAnnotationSelect', '(id: string | null) => void', 'Receive the selected region/marker ID.'],
  ['onAnnotationError', '(RavlError) => void', 'Report rejected annotation operations. React reports these through onError.'],
]
function Content({ topic }: { topic: Topic }) {
  switch (topic) {
    case 'start': return <>
      <p>ravl separates playback, waveform rendering, and annotations. Use the DOM API in any framework, or the React adapter with the same player underneath.</p>
      <Section title="Run this checkout"><p>This is a local development package and is not published to npm. Requires Node.js 22.12+; the React adapter uses React 19 and React DOM 19.</p><CodeBlock label="Terminal" code={'npm ci\nnpm run examples\n\n# Build before consuming this checkout as a local package\nnpm run build'} /><p>The examples run at <a href="http://127.0.0.1:4173">localhost:4173</a>. In this checkout they resolve imports to the source. In your application, link the built local package using your package manager.</p></Section>
      <Section title="Your first waveform"><p>Provide a container and player in JavaScript, or a source to the React component. Replace the sample audio URL with your own asset. The demo assets are served only by this playground.</p><Usage /></Section>
      <Section title="Package entry points"><Reference rows={[
        ['ravl', 'Main API', 'createPlayer, mountWaveform, waveform helpers, annotation helpers, and public types.'],
        ['ravl/core', 'Data & types', 'createPeaks, validateWaveform, and player/source/waveform types.'],
        ['ravl/dom', 'DOM renderer', 'mountWaveform and DOM view types.'],
        ['ravl/react', 'React adapter', 'Waveform, usePlayerState, usePlayerTime, useAnnotations, and WaveformProps.'],
        ['ravl/regions', 'Annotations', 'Stores, validation, serialization, snapTime, validateRules, and annotation types.'],
        ['ravl/styles.css', 'Optional stylesheet', 'Default waveform theme, annotation labels, handles, focus styles, and list styling.'],
      ]} /></Section>
      <Section title="Lifecycle"><p>Dispose each DOM view and each player you create, and call unsubscribe functions when leaving a page. Disposing a view does not dispose its player. React cleans up its own player and view on unmount; a player supplied through the player prop remains yours. Never pass both player and source.</p><a href="#demos">Explore all nine playgrounds →</a></Section>
    </>
    case 'sources': return <>
      <p>Call <code>player.setSource(source, {'{ signal }'})</code> to load audio. The promise resolves when metadata is available; waveform preparation has a separate state. Replacing a source cancels the previous load.</p>
      <Section title="Source descriptors"><Reference rows={[
        ['id', 'string · required', 'Stable asset identity. Must match supplied peaks and annotations.'],
        ['revision', 'string · optional', 'Revision of this asset. Use a new revision when its contents change.'],
        ["kind: 'url'", '{ url, request?, waveform? }', 'Load an audio URL. request is a RequestInit for waveform fetching. Cross-origin waveform decoding requires CORS access.'],
        ["kind: 'file'", '{ file: Blob, waveform? }', 'Load a File or Blob. The player manages and revokes its object URL.'],
        ["kind: 'media'", '{ element: HTMLMediaElement, waveform }', 'Borrow an application-owned audio/video element. Supply peaks or none; decoding is unavailable on this path.'],
      ]} /></Section>
      <Section title="Waveform input"><Reference rows={[
        ["{ kind: 'decode' }", 'Default for URL/file', 'Fetch and decode audio to generate peaks in the browser.'],
        ["{ kind: 'peaks', data }", 'WaveformData', 'Use precomputed min/max buckets without decoding audio for visualization.'],
        ["{ kind: 'none' }", 'No waveform', 'Prepare playback without generating visualization data.'],
      ]} /><Usage scene="peaks" /></Section>
      <Section title="WaveformData"><Reference rows={[
        ['version', '1', 'Schema version.'], ['sourceId', 'string', 'Must match the source id.'], ['sourceRevision', 'string · optional', 'Match the source revision when provided.'],
        ['duration', 'number', 'Positive finite duration in seconds describing the audio.'],
        ['channels', 'Array<{ min, max }>', 'One entry per channel with equal-length, nonempty min/max arrays of uniform time buckets.'],
        ['min / max', 'Float32Array | readonly number[]', 'Finite samples between −1 and 1, with min ≤ max in each bucket. Treat all buffers as immutable.'],
        ['validateWaveform(data)', 'WaveformData', 'Validate shape and values; returns the input or throws INVALID_DATA.'],
        ['createPeaks(buffer, sourceId, sourceRevision?)', 'WaveformData', 'Generate at most 24,000 min/max buckets per channel from a decoded AudioBuffer-compatible object.'],
      ]} /><p>JSON peaks can use ordinary number arrays. A source identity or duration mismatch affects waveform loading independently of audio playback.</p></Section>
      <Section title="Application-owned media"><Usage scene="external" /><p>Detaching a view or disposing its player leaves the borrowed media element owned by the application. Use its native controls or keep a separate application reference.</p></Section>
    </>
    case 'player': return <>
      <p><code>createPlayer()</code> returns an independent player with no constructor options. Loading and playback methods return promises; handle their rejections.</p>
      <Reference rows={[
        ['setSource(source, options?)', 'Promise<void>', 'Load a Source. options.signal accepts an AbortSignal.'], ['clearSource()', 'void', 'Cancel pending work and clear the current asset.'],
        ['play()', 'Promise<void>', 'Start/resume playback once the source is ready. Call from a user gesture.'], ['pause()', 'void', 'Pause playback.'],
        ['playRange({ start, end, loop? })', 'Promise<void>', 'Play a time range in seconds. Bounds must lie within duration and end must exceed start.'],
        ['seek(seconds)', 'void', 'Seek to a nonnegative finite time, capped at the audio duration.'], ['seekFraction(fraction)', 'void', 'Seek with a fraction from 0 to 1.'],
        ['setVolume(volume)', 'void', 'Volume from 0 to 1.'], ['setMuted(muted)', 'void', 'Mute or unmute.'], ['setPlaybackRate(rate)', 'void', 'Speed multiplier from 0.25 to 4.'], ['setLoop(loop)', 'void', 'Loop the full recording. Use playRange for a region loop.'],
        ['getSnapshot()', 'PlayerSnapshot', 'Read source, waveform, playback, settings, and errors.'], ['subscribe(listener)', '() => void', 'Subscribe to snapshot changes; returns an unsubscribe function.'],
        ['getCurrentTime()', 'number', 'Read playback position in seconds.'], ['subscribeTime(listener)', '() => void', 'Subscribe to playback-time updates separately from snapshot state.'],
        ['getMediaElement()', 'HTMLMediaElement | null', 'Access the active media element when present.'], ['dispose()', 'void', 'Release owned resources and cancel work. Safe to call repeatedly.'],
      ]} />
      <Section title="Respond to playback state"><CodeBlock code={`const off = player.subscribe(() => {
  const state = player.getSnapshot()
  playButton.disabled = state.source !== 'ready'
  playButton.textContent = state.playback === 'playing' ? 'Pause' : 'Play'
  if (state.error) console.error(state.error)
  if (state.waveformError) console.error(state.waveformError)
})
const offTime = player.subscribeTime(() => {
  clock.textContent = player.getCurrentTime().toFixed(1)
})
// On teardown: off(); offTime(); player.dispose()`} /></Section>
    </>
    case 'waveform': return <>
      <p><code>mountWaveform(container, options)</code> mounts a light-DOM canvas waveform. Supply exactly one of <code>player</code> or <code>data</code>. The data-only path renders without audio playback.</p>
      <Reference rows={[
        ['player', 'Player', 'Borrow a player; mutually exclusive with data.'], ['data', 'WaveformData', 'Render static/precomputed data; mutually exclusive with player.'],
        ['appearance', 'Appearance', 'Drawing settings listed below.'], ['viewport', 'Viewport', 'Zoom and follow settings.'], ['interaction', 'Interaction', 'Seeking and selection settings.'],
        ['label', "string · 'Audio waveform'", 'Accessible name for the waveform.'], ['onDraw', '() => void', 'Called after drawing; useful for measurement.'], ...annotationOptions,
      ]} />
      <Section title="Appearance"><Reference rows={appearance} /></Section>
      <Section title="Viewport"><Reference rows={viewport} /></Section>
      <Section title="Interaction"><Reference rows={interaction} /><p>Double-click or double-tap starts playback on the waveform background. Annotation controls retain their editing gestures.</p></Section>
      <Section title="Returned WaveformView"><Reference rows={[
        ['update(options)', 'void', 'Patch appearance, viewport, interaction, label, onDraw, data, or annotation options. Nested drawing/viewport/interaction settings merge with existing values.'],
        ['refreshTheme()', 'void', 'Re-read computed canvas colors after a CSS theme change.'],
        ['getViewport()', 'ViewportSnapshot', 'Cached source, duration, visible start/end, CSS width, pixelsPerSecond, and disposed flag.'], ['subscribeViewport(callback)', 'unsubscribe function', 'Observe changed viewport snapshots. Initial geometry is published after the first draw.'], ['scrollTo(seconds)', 'void', 'Pan to a nonnegative start time; clamps at the end without seeking audio.'],
        ['getSelection()', '{ start, end } | null', 'Read the selected time range in seconds.'], ['clearSelection()', 'void', 'Clear the current time selection.'], ['createRegionFromSelection(id, label?)', 'void', 'Commit the current time selection as a region. Requires an annotation store.'], ['dispose()', 'void', 'Remove the view and listeners while leaving its borrowed player alive.'],
      ]} /><Usage scene="styling" /></Section>
    </>
    case 'react': return <>
      <p>Import <code>Waveform</code> and hooks from <code>ravl/react</code>. The adapter mounts the shared DOM engine and manages its owned resources after commit.</p>
      <Section title="Waveform props"><Reference rows={[
        ['source', 'Source | null', 'Create an owned player and load this source. Mutually exclusive with player. Null clears the source.'],
        ['player', 'Player', 'Borrow an existing player instead of supplying source. You own its lifecycle.'],
        ['ref', 'Ref<Player | null>', 'Access the player after commit; null before mount and after cleanup.'],
        ['appearance / viewport / interaction', 'Appearance / Viewport / Interaction', 'Same options and defaults as the DOM renderer.'],
        ['themeVersion', 'string | number', 'Change to refresh computed canvas colors without replacing the player.'], ['onView', '(WaveformView | null) => void', 'Attach optional visual modules in an effect; null signals teardown.'], ['snapAnnotation', 'AnnotationSnapper', 'Memoize a createSnapper function for magnetic pointer edits.'], ['onPlayer', '(Player | null) => void', 'Observe attachment and cleanup of the active player.'], ['onError', '(RavlError) => void', 'Receive source, waveform, playback, and annotation errors. Cancellation is filtered.'], ['onDraw', '() => void', 'Called after each draw.'],
        ['annotations', 'AnnotationDocument', 'Controlled document. Requires annotationsRevision and onAnnotationsCommit.'], ['annotationsRevision', 'number', 'Controlled revision; advance when accepting an edit or supplying an external update.'],
        ['defaultAnnotations', 'AnnotationDocument', 'Initial document for an internal, uncontrolled store.'], ['annotationStore', 'AnnotationStore', 'Borrow an existing store. Choose exactly one annotation ownership mode.'],
        ['snapAnnotation', '(time, context) => number', 'Optional pointer snap function; import createSnapper from ravl/snapping. Keyboard edits retain the grid step.'],
  ['annotationRules', 'AnnotationRules', 'Minimum/maximum region length and snap interval.'], ['onAnnotationsCommit', '(document, change) => void', 'Observe uncontrolled commits or accept/reject controlled proposals.'], ['onSelectionChange', '(Selection) => void', 'Time selection changes.'], ['onAnnotationSelect', '(string | null) => void', 'Selected annotation identity.'],
        ['renderRegionLabel', '(Region) => ReactNode', 'Render custom labels through React portals.'], ['HTML attributes', 'HTMLAttributes<HTMLDivElement>', 'className, style, aria-label, and other ordinary div attributes. children is not supported.'],
      ]} /></Section>
      <Section title="Hooks"><Reference rows={[
        ['usePlayerState(player, selector)', 'Selected snapshot value', 'Subscribe to a selected value; use stable selectors for predictable caching. Accepts a nullable player.'],
        ['usePlayerTime(player)', 'number', 'Subscribe to current playback time independently of snapshot state.'], ['useAnnotations(store)', 'AnnotationSnapshot | null', 'Subscribe to an annotation store; returns null without a store and during server rendering.'],
      ]} /><Usage /></Section>
      <Section title="Controlled annotation usage"><CodeBlock label="React JSX" code={`import { useState } from 'react'
import { Waveform } from 'ravl/react'

// source and initialDocument describe the same asset and are defined outside.
function Editor({ source, initialDocument }) {
  const [state, setState] = useState({ value: initialDocument, revision: 0 })
  return <Waveform source={source}
    annotations={state.value}
    annotationsRevision={state.revision}
    interaction={{ drag: 'select' }}
    onAnnotationsCommit={(value, change) => {
      setState(current => change.baseRevision === current.revision
        ? { value, revision: current.revision + 1 } : current)
    }}
    onError={console.error} />
}`} /></Section>
    </>
    case 'annotations': return <>
      <p>Annotations are independent of the renderer and audio loading. Create a store before loading media; the document sourceId controls which asset displays the annotations.</p>
      <Section title="Document & constraints"><Reference rows={[
        ['AnnotationDocument', '{ version: 1, sourceId, regions, markers }', 'A source-bound JSON document. Both arrays are required.'],
        ['Region', '{ id, start, end, label?, channel?, locked?, metadata? }', 'Seconds with 0 ≤ start < end. channel is an optional nonnegative integer; metadata is finite JSON.'],
        ['Marker', '{ id, time, label?, locked?, metadata? }', 'A point in seconds with time ≥ 0. IDs are unique across regions and markers.'],
        ['AnnotationRules.minLength', 'number · 0', 'Minimum region length in seconds.'], ['AnnotationRules.maxLength', 'number · Infinity', 'Maximum region length in seconds; must be ≥ minLength.'], ['AnnotationRules.snap', 'number · 0', 'Snap interval in seconds; zero disables snapping. Applies to interactive edits, not imported coordinates.'],
        ['ControlledAnnotations', '{ value, revision, onCommit }', 'Parent-owned document with an explicit revision and commit callback.'], ['AnnotationChange', '{ operation, origin, ids, baseRevision }', 'operation: add/update/remove/replace. origin: api/pointer/keyboard. baseRevision identifies the proposed edit’s starting revision.'],
      ]} /><Usage scene="annotations" /></Section>
      <Section title="Store creation & methods"><p><code>createAnnotations({'{ document, rules? }'})</code> creates an uncontrolled store. Use <code>{'{ value, revision, onCommit, rules? }'}</code> for controlled state; call setControlled to accept a proposal with an advanced revision, or leave state unchanged to reject it.</p><Reference rows={[
        ['getSnapshot()', 'AnnotationSnapshot', 'Returns document, revision, duration (number or null), and invalidIds.'], ['subscribe(callback)', '() => void', 'Observe store state; returns unsubscribe.'], ['onCommit(callback)', '() => void', 'Observe committed document/change pairs; returns unsubscribe.'],
        ['addRegion(region, origin?)', 'void', 'Add a validated region; origin defaults to api.'], ['updateRegion(id, patch, origin?)', 'void', 'Patch region fields except id.'], ['addMarker(marker, origin?)', 'void', 'Add a validated marker.'], ['updateMarker(id, patch, origin?)', 'void', 'Patch marker fields except id.'], ['remove(id, origin?)', 'void', 'Remove a region or marker.'], ['replaceDocument(document)', 'void', 'Validate and replace the document.'], ['setControlled({ value, revision, onCommit })', 'void', 'Supply controlled state and revision; cancels stale gestures.'], ['setDuration(number | null)', 'void', 'Set known duration for bounds validation.'], ['dispose()', 'void', 'Release store subscriptions.'],
      ]} /></Section>
      <Section title="Validation & persistence"><Reference rows={[
        ['validateAnnotations(input, expectedSourceId?)', 'AnnotationDocument', 'Validate unknown input and copy/freeze the document; optionally require a source identity.'], ['parseAnnotations(text, expectedSourceId?)', 'AnnotationDocument', 'Parse JSON and validate. Throws INVALID_DATA for malformed data.'], ['stringifyAnnotations(document)', 'string', 'Validate and serialize the document as JSON.'], ['validateRules(rules?)', 'Required<AnnotationRules>', 'Validate constraints and fill defaults. Exported from ravl/regions.'], ['snapTime(time, interval)', 'number', 'Round a time to an interval; zero leaves it unchanged. Exported from ravl/regions.'],
      ]} /><CodeBlock code={`import { parseAnnotations, stringifyAnnotations } from 'ravl'

try {
  localStorage.setItem('annotations', stringifyAnnotations(store.getSnapshot().document))
  const saved = localStorage.getItem('annotations')
  if (saved) store.replaceDocument(parseAnnotations(saved, 'demo-a'))
} catch (error) {
  console.error('Unable to save or restore annotations', error)
}`} /></Section>
    </>
    case 'styling': return <>
      <p>Waveforms use ordinary DOM and CSS. Import <code>ravl/styles.css</code> for the default theme, or style the exposed classes yourself. Set variables on the waveform or a parent container.</p>
      <Reference rows={[
        ['--ravl-wave-color', '#9aafa7', 'Unplayed waveform color.'], ['--ravl-progress-color', '#285d50', 'Played waveform and playhead color.'], ['--ravl-focus-color', '#bd722e', 'Keyboard focus and selected annotation outline.'], ['--ravl-region-color', '#a67ce333', 'Region fill.'], ['--ravl-marker-color', '#b65d29', 'Marker color.'], ['--ravl-handle-color', '#8055ba / #8055ba88', 'Region border / resize handle fill.'], ['--ravl-selection-color', '#538ce644', 'Time selection overlay.'], ['--ravl-label-color', '#493165', 'Default region/marker label color.'], ['--ravl-annotation-list-height', '12rem', 'Maximum height of the scrollable annotation list.'],
      ]} />
      <Section title="Theme changes"><CodeBlock label="CSS" code={`.podcast-wave {
  --ravl-wave-color: #aecfc2;
  --ravl-progress-color: #277e67;
  --ravl-region-color: #a67ce333;
  --ravl-focus-color: #bd722e;
}`} /><p>After changing colors in JavaScript, call <code>view.refreshTheme()</code>. In React, change <code>themeVersion</code>. Appearance and zoom changes use view.update or component props.</p></Section>
      <Section title="DOM styling hooks"><p>Available classes include <code>.ravl-waveform</code>, <code>.ravl-surface</code>, <code>.ravl-wave</code>, <code>.ravl-progress</code>, <code>.ravl-cursor</code>, <code>.ravl-annotations</code>, <code>.ravl-selection</code>, <code>.ravl-region</code>, <code>.ravl-marker</code>, <code>.ravl-region-body</code>, <code>.ravl-region-handle</code>, <code>.ravl-region-label</code>, <code>.ravl-annotation-list</code>, <code>.ravl-annotation-pagination</code>, and <code>.ravl-annotation-status</code>. Selected annotations expose <code>data-selected="true"</code>.</p><a href="#demos/styling/vanilla">Try the styling playground →</a></Section>
    </>
    case 'interactions': return <>
      <p>The shared renderer handles mouse, touch, and keyboard input. React and Vanilla JavaScript have the same gestures.</p>
      <Reference rows={[
        ['Click / tap', 'Seek', 'Move to the selected time when seeking is enabled and drag is not select.'], ['Double-click / double-tap', 'Play', 'Start playback on the waveform background. In selection mode this preserves the playhead.'], ['Drag / touch scrub', "drag: 'seek'", 'Move the playhead horizontally. Touch scrubbing starts after movement exceeds the tap threshold.'], ['Drag selection', "drag: 'select'", 'Select a time range. Call createRegionFromSelection to commit it as a region.'],
        ['Vertical swipe / pinch', 'Scroll / zoom', 'Page scrolling and browser pinch zoom remain available on the waveform background. Annotation handles reserve touch gestures for editing.'], ['ArrowLeft / ArrowRight', 'Seek ±1s', 'Focus the waveform with Tab. Shift changes the step to 10 seconds.'], ['Home / End', 'Seek to bounds', 'Go to the beginning or end of the audio.'],
      ]} /><Section title="Touch recognition"><p>A double-tap requires two short taps within 350 ms and 24 CSS pixels. Movement beyond 10 pixels, a long press, multiple fingers, or pointer cancellation breaks the gesture. Synthesized mouse events are ignored briefly after touch to avoid duplicate playback.</p></Section>
      <Section title="Annotation editing"><p>Drag a region body to move it, its handles to resize, or a marker to reposition it. Arrow keys edit focused handles and markers; locked annotations cannot be edited. The list provides focusable controls as an alternative to manipulating the overlay. Annotation double-taps do not start playback.</p><a href="#demos/annotations/vanilla">Open the annotation editor →</a></Section>
    </>
    case 'modules': return <>
      <Section title="Separately imported features"><p>Use ravl/timeline, ravl/minimap, ravl/history, and ravl/snapping independently. The core entry does not import them. The <a href="#demos/modules/react">optional modules playground</a> runs the actual React or vanilla implementation selected by its code switch.</p></Section>
      <Section title="Timeline and minimap"><Reference rows={[
        ['mountTimeline(container, { view, minSpacing?, formatTime? })', '{ dispose() }', 'Renders visible ruler ticks; minimum spacing defaults to 80 CSS pixels. formatTime receives seconds.'],
        ['mountMinimap(container, { view, player | data, height?, label? })', '{ refreshTheme(), dispose() }', 'Full waveform overview; height defaults to 64. Drag or use arrows/Home/End to pan without seeking audio. Supply exactly one player or immutable data source matching the main view.'],
        ['Waveform.onView', '(WaveformView | null) => void', 'Capture the committed view, then mount accessories in an effect. Dispose accessories when that view changes.'],
      ]} /><p>Dispose accessories before their view. They never dispose the borrowed player. Disable playback-follow scrolling when manually panning. A data-only minimap is fixed to its supplied data; remount it when that data changes.</p></Section>
      <Section title="Immutable annotation history"><Reference rows={[
        ['createHistory(document, { limit?: 100 })', 'AnnotationHistory', 'Validated, frozen present/past/future snapshots. The limit bounds undo entries.'],
        ['recordHistory(history, acceptedDocument)', 'AnnotationHistory', 'Record accepted state only; no-op documents preserve identity. A divergent edit clears redo; a different source resets history.'],
        ['undoHistory(history) / redoHistory(history)', 'AnnotationHistory', 'Return new state without changing stores or playback. Empty traversal returns the input.'],
      ]} /><p>For controlled React, render history.present with a new revision and record only accepted proposals. With an external store, apply next.present first; advance history only if validation succeeds, and suppress history recording during restoration. This history stores full annotation documents, not audio or DOM.</p></Section>
      <Section title="Magnetic snapping"><Reference rows={[
        ['createSnapper(options)', 'AnnotationSnapper', 'Pass to snapAnnotation on a DOM view or React Waveform.'],
        ['tolerancePixels', 'number · 8', 'Maximum target distance in CSS pixels; converted at the current zoom.'],
        ['markers / regionBoundaries', 'boolean · true', 'Include other annotation coordinates; the moved annotation is excluded.'],
        ['playhead / targets', '() => number | null / () => readonly number[]', 'Read dynamic playhead or custom time targets in seconds.'],
        ['grid', 'number · 0', 'Optional magnetic grid interval. Outside tolerance, retain the unsnapped time.'],
      ]} /><p>Pointer edits only. Keyboard uses AnnotationRules.snap. Nearest target wins; equal distances use the earlier time. Region movement snaps its start; resizing snaps the edited boundary. Duration and length constraints take precedence. No automatic zero-crossing, beat detection, or audio analysis.</p></Section>
      <Section title="Usage"><Usage scene="modules" /></Section>
    </>
    case 'errors': return <>
      <p>Playback, audio loading, and waveform preparation have separate states. A waveform failure does not necessarily prevent audio playback.</p>
      <Section title="PlayerSnapshot"><Reference rows={[
        ['source', 'idle | loading | ready | error | disposed', 'Audio source lifecycle.'], ['sourceId', 'string | null', 'Active asset identity.'], ['playback', 'paused | starting | playing | buffering | ended', 'Playback lifecycle.'], ['waveform', 'idle | fetching | decoding | ready | error | cancelled', 'Visualization lifecycle.'], ['duration', 'number', 'Seconds.'], ['canPlay', 'boolean', 'Whether media is ready to play.'], ['volume / muted', 'number / boolean', 'Current audio settings.'], ['playbackRate / loop', 'number / boolean', 'Playback speed and full-recording looping.'], ['data', 'WaveformData | null', 'Current prepared waveform data.'], ['error / waveformError', 'RavlError | null', 'Audio/playback error and independent visualization error.'],
      ]} /></Section>
      <Section title="RavlError"><Reference rows={[
        ['code', 'ErrorCode', 'CANCELLED, DISPOSED, INVALID_DATA, NETWORK, DECODE, MEDIA, NOT_READY, DURATION_MISMATCH.'], ['stage', 'source | waveform | playback | lifecycle | view', 'Where the failure occurred.'], ['message / cause', 'Error fields', 'Human-readable message and optional underlying error.'], ['sourceId', 'string · optional', 'Asset associated with the failure.'], ['reason', 'superseded | aborted | disposed | cleared', 'Optional cancellation reason.'],
      ]} /><CodeBlock code={`try {
  await player.setSource(source, { signal: controller.signal })
} catch (error) {
  if (error.code !== 'CANCELLED') console.error(error)
}
// play() can reject if browser playback permission is denied.
playButton.onclick = () => player.play().catch(console.error)`} /><p>Ignore expected cancellation when a source is replaced or cleared. DOM option validation throws synchronously. In React, onError reports player and annotation failures.</p></Section>
    </>
  }
}
export function Documentation({ topic }: { topic: Topic }) {
  const title = topics.find(([id]) => id === topic)![1]
  return <>
    <section className="intro"><p className="eyebrow">Usage & API reference</p><h1>Documentation</h1><p>Everything you need to load audio, render waveforms, and build annotation tools.</p></section>
    <div className="workspace docs-workspace">
      <nav className="section-nav" aria-label="Documentation">{topics.map(([id, label]) => <a key={id} href={`#docs/${id}`} aria-current={id === topic ? 'page' : undefined}>{label}</a>)}</nav>
      <article className="documentation" key={topic}><h2>{title}</h2><Content topic={topic} /></article>
    </div>
  </>
}
