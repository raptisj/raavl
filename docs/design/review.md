# Phase 1 review checkpoint

## Recommended decisions

1. Use a fresh architecture and working name `ravl`; do not promise WaveSurfer
   API/plugin compatibility. Confirm the final public package name before publishing.
2. Use light DOM with optional theme CSS and Canvas waveform drawing.
3. Use factory functions and pure data transformations; allow small internal mutable
   buffers and resource adapters where they make browser work efficient.
4. Use one implementation with vanilla and React entry points, built together.
5. Treat source readiness, playback buffering, waveform readiness, and first draw
   as separate observable facts.
6. Make annotations source-bound plain data. Default to rejecting invalid bounds,
   rather than silently correcting persisted coordinates.
7. Start with HTML media playback and document range precision limits. Defer
   sample-accurate playback and advanced audio processing.

## Acceptance scenarios for implementation

| Area | Required observable result | Phase |
| --- | --- | --- |
| Styling | Theme change redraws colors without refetching or restarting media | 2 |
| Loading | A slow source A cannot overwrite B after B is selected | 2 |
| Failure isolation | Invalid peaks produce a waveform error while valid audio plays | 2 |
| Cancellation | Every superseded operation settles; no stale completion events | 2 |
| Ownership | Disposing a borrowed media view leaves caller media intact | 2 |
| React | Color changes and parent rerenders preserve playback and controller identity | 2 |
| React lifecycle | Strict Mode remounts leave no duplicate listeners or orphaned playback | 2 |
| Rendering | Playhead animation does not rerender unrelated React controls | 2 |
| SSR | Import and server render need no window/document; hydration is stable | 2 |
| Accessibility | Seeking works with keyboard and has visible focus | 2 |
| Region timing | Regions supplied before duration retain intended coordinates | 3 |
| Controlled data | Drag generates one commit; rejecting it restores committed geometry | 3 |
| Conflicts | External document update cancels an active gesture predictably | 3 |
| Persistence | Valid JSON round-trips without DOM references or lost metadata | 3 |
| Source switch | Old annotations never appear over a different source | 3 |
| Scale | Publish memory, interaction latency, and React render measurements | 4 |

## Measurements to establish before performance claims

Use short local audio, a multi-hour asset with supplied peaks, many simultaneous
players, and a dense annotation document. Record fixture sizes and device/browser
versions. Measure source-to-playable latency separately from waveform-to-visible
latency, peak/decoded-buffer memory, drag latency, and React render counts.
Compare against a pinned upstream version, with equivalent settings. No claim
of being faster than WaveSurfer is made in Phase 1.

## Decisions intentionally deferred

- Exact default duration-mismatch tolerance: initial proposal is in `api.md`.
- Browser support matrix and measurable performance budgets: establish using
  actual implementation and fixtures, not invented benchmark numbers.
- Multi-resolution peak storage/server format and optional worker strategy.
- Precision Web Audio backend, recording, spectrograms, and multitrack features.
- Final packaging, release policy, license choice, and public package name.

## Phase 1 completion

Architecture and paired workflows are ready for review. The browser page is a
runnable design viewer, not a functional audio prototype. It uses no external
dependencies and executes none of the proposed library imports. Phase 2 must
wait for explicit user instruction.

### Verification record

- `npm run check` passed: JavaScript syntax and generated workflow guide consistency.
- The example server successfully started on localhost port 4173.
- Browser visual/interaction checks remain unverified: the in-app browser timed
  out while attaching. A subsequent HTTP smoke check was blocked by the sandbox;
  its escalation request was interrupted before a result was obtained.
- No audio playback or library behavior has been tested, because those features
  are intentionally not implemented in Phase 1.
