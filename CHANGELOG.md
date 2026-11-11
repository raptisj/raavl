# Changelog

## 0.1.1

### Added

- Built-in inline and modal editors for creating regions and editing region and marker labels and times. Draft edits preview on the waveform before saving.
- Playback actions toolbars for React (`ActionsToolbar`) and vanilla JavaScript (`mountActionsToolbar`) with play/pause, region playback and looping, a playback clock, and optional region creation at the playhead.
- Two-finger pinch-to-zoom on touch screens. Zoom centers on the midpoint between the fingers and can zoom back out to fit the recording.

### Changed

- Annotation editors automatically use a scrollable, zoomed waveform below 600 px. Set `viewport.zoom` to `"fit"` or a numeric value to override this behavior.
- Clicking or tapping a region selects it and seeks when click seeking is enabled. Double-clicking or double-tapping a region plays it once. If you relied on double-clicking or double-tapping the waveform background to start playback, use a play/pause control. Set `interaction.seek` to `"off"` to disable click and tap seeking, including in drag-selection mode.
- `AudioPlayer` shows the actions toolbar by default when annotation editing is enabled. Set `actions={false}` to restore the standard transport, or pass an explicit `controls` configuration to show additional controls alongside the toolbar. `PlayPauseButton` now renders icons by default. Pass custom children to show text.
- Updated the playground and live examples so the React and vanilla code snippets match the preview controls.

### Fixed

- Keep decoded waveform peaks when the browser revises the media duration. Seeking follows the current media duration.
- Keep horizontal scrolling inside the waveform when zoomed and clear the scroll offset when returning to fit.

## 0.1.0

Initial release.

- JavaScript audio playback, waveform rendering, and annotation stores.
- React waveform, complete player, composable controls, and headless hooks.
- Portable themes and optional timeline, minimap, history, and snapping modules.
- ESM entry points, TypeScript declarations, and an optional stylesheet.
