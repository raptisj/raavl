# Changelog

## 0.1.2

### Added

- Search annotations by label, ID, or time in a scrollable picker. Overlap chips open the picker with just the regions at that spot. Choosing a region brings it into view and raises it above its neighbors. While editing, the other regions are dimmed.
- Use **Play region** in the editor to preview the current range, including unsaved start and end changes. On touch screens, use the **−** and **+** buttons to adjust either time by 0.1 seconds.

### Changed

- Annotation badges stay on one row. When more than four badges are present or they do not fit, the row shows a count button that opens the picker, plus the selected badge when available.
- Touch swipes scroll the waveform or page. To create a region on touch screens, tap to place the playhead, then use **Create region at playhead** and adjust the draft with the editor fields or inline resize handles. Dragging to create a range or move a region or marker uses a mouse or pen. Region resize handles still support touch.
- Lock and unlock annotations through the store. The built-in editors still allow relabeling locked annotations.
- Post-publish npm verification waits longer between retries to allow time for registry propagation.

### Fixed

- Adding a second finger during a touch resize cancels the edit without saving it. Resizing works again after both fingers are lifted.
- Restore annotation badges when the inline editor is disabled during region creation.

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
