# Phase 3 checkpoint — annotation workflow

## Delivered

- Serializable regions and explicit point markers, source-bound documents,
  deep validation, immutable snapshots, and JSON parsing/export helpers.
- Uncontrolled stores and controlled documents with revision-aware proposals.
- DOM overlays with drag/move/resize, temporary range selection, marker movement,
  locks, channel targeting, basic grid snapping, and length constraints.
- Keyboard movement/resizing/deletion, focus preservation, and an accessible list.
- Vanilla DOM label slots and React-owned portal content.
- React controlled, default-owned, and borrowed-store modes with Strict Mode cleanup.
- Best-effort media-element range playback and looping, separate from selection.
- Interactive vanilla/React annotation editor with inspector, controlled rejection,
  source switching, localStorage save/load, JSON import/export, and range playback.

## Validation

`npm run check`: TypeScript checks, 26 tests, ESM library/declaration build, and
production example build.

New automated coverage includes document round-trips, invalid JSON/metadata,
locks, atomic constraints, annotations before duration, controlled acceptance and
rejection, one commit per gesture, external-revision gesture cancellation,
selection-to-region creation, source mismatch hiding, keyboard controls, custom
React label portals, default-owned Strict Mode cleanup, handle focus restoration,
and range playback/loop timer cleanup.

Browser checks confirmed vanilla keyboard resizing and controlled rejection,
React selection-to-region creation, custom labels, localStorage save/load, JSON
refresh/export content, and source switching that hides/restores annotations.
The tests use mocked media and Canvas APIs; browser checks supplement rather than
replace them. No sample-accurate playback, full cross-browser, or large-scale
performance guarantee is made.

Two issues found during verification were fixed: clicking a handle now focuses
it for keyboard editing, and React-owned annotation stores detach from the view
before disposal. Both have regression tests.

## Review and limitations

Start at `http://127.0.0.1:4173/#annotations/react` or use the
Annotation editor navigation item. Toggle framework and ownership, and uncheck
Accept edits to inspect controlled rejection. The library never persists audio.

The implemented API is documented in [ANNOTATIONS.md](ANNOTATIONS.md).
Bounds use rejection/reporting, not silent document clamping. Overlap is allowed.
Per-frame preview callbacks, overlap policies, annotation virtualization,
collision-avoiding labels, and drag edge auto-scroll are not implemented.
Undo/redo, advanced snapping, and optional modules remain later work. Browser,
accessibility, and scaling audits belong to Phase 4.

## Commit milestones

- `7b56022`: annotation stores, editable overlays, React integration, and tests.
- `cac98ac`: editor milestone with persistence controls, range playback, focus/cleanup
  fixes, and the interactive annotation demo.
- The documentation checkpoint updates the README, API guide, examples, and roadmap.

Phase 3 is complete. Phase 4 has not started and requires user instruction.
