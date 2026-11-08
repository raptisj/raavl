# Delivery roadmap

## Phase 1 — Public contract (complete)

Deliver architecture, source and lifecycle semantics, region ownership,
styling rules, paired vanilla/React workflows, and a runnable API review page.
Stop for review before implementing the library.

## Phase 2 — Foundation (complete; awaiting review)

Implement the core, HTML media playback, URL/File sources, provided waveform
data, Canvas rendering, light DOM styling, cleanup, and vanilla/React adapters.
Add browser examples for a URL, local file, precomputed waveform, externally
owned media, and two players. Check lifecycle and loading behavior.

Phase 2 results and verification: [checkpoint](PHASE-2.md).

## Phase 3 — Annotation workflow (not started)

Implement regions, markers, selection, controlled ownership, labels, keyboard
editing, and JSON persistence. Add paired annotation examples and validate
gesture commits, bounds policies, and source switching.

## Phase 4 — Robustness and scale

Benchmark long files and dense annotations; exercise interrupted loads,
repeated mounting, external media, browser differences, and memory ownership.
Add multi-resolution/worker optimizations where measurements justify them.
Publish measured budgets and supported-browser results.

## Phase 5 — Optional modules

Add timeline, minimap, undo/redo, and advanced snapping as separately imported
features. Evaluate recording and spectrograms separately. Multitrack mixing,
destructive audio editing, and compatibility with WaveSurfer plugins are not
initial deliverables.

## Checkpoint policy

- Commit coherent, reviewable milestones during each phase.
- Keep runnable examples and their instructions in `examples/`.
- Report changes, checks, limitations, and commit IDs at each checkpoint.
- Stop after each phase; explicit user instruction is required to continue.
