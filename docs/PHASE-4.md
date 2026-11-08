# Phase 4 — Robustness and scale

Implementation complete; stopped for review before Phase 5. Browser certification
is limited to the available Chromium runtime, as detailed below.

## Delivered

- Annotation overlays mount only for the visible time range. A focused or actively
  dragged annotation stays mounted when it leaves that range.
- The accessible annotation list has 100 entries per page. Choosing an offscreen
  entry scrolls to its region and focuses its keyboard-editable button. Invalid
  annotations remain available in the list for correction.
- Redraws retain unchanged list buttons, preserving focus and avoiding DOM churn.
  List height is customizable with `--ravl-annotation-list-height` (default 12rem).
- Detaching annotations releases custom label slots. Disposal removes subscriptions,
  animation frames, overlays, and lists while retaining application-owned stores.
- Pending play results are invalidated by pause, a newer play request, source
  replacement, and disposal. A late rejection cannot overwrite paused state.
- Reentrant disposal during source-loading or decoding notifications stops further
  resource preparation. Metadata callbacks check ownership after notifying callers.
- A runnable Scale lab uses the actual engine, synthetic two-hour stereo peaks,
  and 10,000 editable regions. It measures redraw latency and displays its browser,
  viewport, peak storage, canvas backing allocation, and DOM counts.

## Measurements and budgets

Measured in the local Vite development build on macOS, Chromium 156 (in-app
browser), DPR 2, waveform width 458 CSS pixels, height 160. Each browser run
excludes one warm-up redraw and reports 30 samples. Timings include waiting for
requestAnimationFrame; they are neither isolated CPU timings nor frame-rate
promises. Hardware, refresh rate, browser activity, production builds, and wider
viewports can change the results. These are single local runs, not lab averages.

| Scenario | Median | p95 | Maximum | Overlays / list rows |
| --- | ---: | ---: | ---: | ---: |
| 100 px/sec, 10,000 regions | 8.3 ms | 8.7 ms | 11.2 ms | 7 / 100 |
| Fit two hours, annotations off | 8.3 ms | 9.4 ms | 9.4 ms | 0 / 0 |
| Fit two hours, all regions visible | 17.8 ms | 28.7 ms | 53.9 ms | 10,000 / 100 |

Local acceptance target: p95 redraw latency below 16.7 ms for the first two
scenarios. Both pass on the measured setup. The dense overview exceeds that
budget; zoom in for editing or hide overlays for an overview. Overlapping regions
and very long regions can also keep many overlays visible. There is no silent
annotation count cap, spatial index, or aggregation into an overview heatmap.

A Node 22/jsdom regression fixture at 1,000 CSS pixels measured initial mounting
and first draw at **1,950.9 ms before**, **59.3 ms after viewport culling and
pagination**. That comparison used one run each and is not a browser paint metric.
The DOM changed from 10,000 overlays + 10,000 rows to 14 overlays + 100 rows.
Automated assertions enforce structural bounds, not unstable timing thresholds.

No worker or multi-resolution cache was added: supplied-peak fit redraws meet the
measured budget, while the dominant observed bottleneck was annotation DOM.
Peak validation, normalization, and document validation still scan their inputs;
annotation commits still copy/validate the document. Larger datasets may justify
indexes or workers after measurement.

## Memory and long-file ownership

The fixture has 720,000 min/max buckets per channel, two channels of Float32 data:
**11,520,000 bytes**. Its two viewport canvases use **2,344,960 backing bytes** on
the measured setup. These figures exclude DOM, JS objects, compositor copies,
GPU overhead, React, and application data; they are not measured total heap usage.
Canvas allocation follows viewport size and DPR (capped at 3), not recording length.

This is a long-duration supplied-peaks test, **not a two-hour audio decode test**.
For comparison, two-hour stereo PCM at 48 kHz needs about 2.76 GB in Float32 alone,
plus compressed bytes and decoder overhead. Use server/offline-generated peaks
and native streaming playback for large recordings. Local decoding still reads
and decodes the entire input. It has no memory ceiling or streaming decoder.
Aborted decode results are ignored and AudioContexts closed when decoding settles;
the browser's in-progress decode itself cannot be cancelled by this API.

Supplied arrays remain caller-owned and must be treated as immutable for the
lifetime of the view. Disposal releases library resources but does not clear
application references. Tests verify teardown ownership, not garbage-collector
heap reclamation. No global waveform cache or worker pool retains those arrays.

## Verification and browser results

`npm run check` passes: 29 tests, TypeScript, library/declaration build, and
production example build. Tests cover interrupted loads, stale decode completion,
Blob URL revocation, borrowed media ownership, late playback rejection, synchronous
subscriber disposal, React Strict Mode and SSR, controlled edits, and keyboard
editing. The scale test mounts/disposes 25 additional views and verifies zero
remaining scheduled frames, store subscriptions, or live custom label slots.
It also checks pagination, offscreen navigation/focus, and stable list identity.

| Runtime | Result |
| --- | --- |
| Chromium 156, macOS in-app browser | Scale benchmark, pagination, offscreen focus and keyboard move verified. Prior phases also exercised native audio playback, borrowed-media detachment and React annotations. |
| Node 22 + jsdom | Automated lifecycle, DOM, React, SSR and scale assertions pass; not a real rendering/audio engine. |
| Safari/WebKit, Firefox, iOS/Android | Not available in the connected browser inventory; not certified. |

Before a public release, run the same examples in each target browser and test:
URL/File decoding with the target codecs; abort during metadata/fetch/decode;
autoplay rejection; native audio continuing after detach; React remount while
playing; mouse/touch region resize; keyboard and screen-reader navigation;
background-tab range looping; zoom/scroll near the end of long recordings.
Native codecs, autoplay policy, timer throttling and maximum layout widths vary.
No universal codec, mobile, screen-reader, or sample-accurate playback claim is made.

## Reproduce

```sh
npm run examples
# Open http://127.0.0.1:4173/#scale/vanilla
# Run at 100 px/sec with regions, then Fit with regions off/on.
npx vitest run tests/scale.test.ts --silent=false --reporter=verbose
npm run check
```

The Scale lab intentionally uses the vanilla engine under either framework tab;
the separate annotation editor continues to exercise actual React ownership and
portals. Phase 5 optional modules remain unstarted.
