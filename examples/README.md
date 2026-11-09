# Shared interactive examples

All ten playgrounds are mounted once at `/examples` in the Fumadocs site. This
directory contains their source components; it is not a second application.

```sh
# From the repository root, using Node.js 24 LTS
npm --prefix docs ci
npm run docs:dev
```

Open [the gallery](http://127.0.0.1:3000/examples). `npm run examples` is a
compatibility alias for the same site and port. The sole documentation reference
is at `/docs`; there is no documentation renderer in this directory.

- `live/Examples.tsx`: gallery, playback scenarios, theme builder, and code panels.
- `live/VanillaWaveform.tsx`: the DOM API inside the shared React shell.
- `live/AnnotationEditor.tsx`: annotation creation, editing, and persistence.
- `live/ModulesEditor.tsx`: timeline, minimap, history, and snapping composition.
- `live/ScaleLab.tsx`: synthetic two-hour waveform and 10,000-region benchmark.
- `live/SoundCloudPlayer.tsx`: JavaScript and React SoundCloud-style players.
- `live/soundcloud.ts`: shared gradient theme, application CSS, and demo source.
- `live/snippets.ts`: copyable JavaScript and React examples.
- `live/routes.ts`: example hash routes and old documentation bookmark forwarding.
- `live/style.css`: styles scoped to `.examples-app` so site navigation and docs
  retain their own appearance.

Links use `/examples#demos/<scene>/<framework>`. Older scene-only hashes remain
supported on that page. The landing page's small player is a product preview;
the complete gallery and builder live only at `/examples`.

Audio and peak JSON are shared with the landing demo from `docs/public/`.
Regenerate them with `node scripts/generate-fixtures.mjs` from the repository
root. `workflows.js` contains historical API sketches used by the design notes;
it is not a runnable site or the implemented API reference.

See [site testing](../docs/README.md#verify-locally) for manual checks and
[PRODUCT.md](../PRODUCT.md#scale-limits-and-unimplemented-capabilities) for scale
measurements and browser limitations. `npm run check` verifies the library;
`npm run check:docs` verifies and builds the unified site into `docs/out/`.
