# raavl documentation and examples site

The single public site uses Next.js App Router, Fumadocs UI, Fumadocs MDX, and
Tailwind CSS. It has its own dependencies and lockfile. The library keeps its
existing Vite build; examples are components within this site.

## Develop

Use **Node.js 22.22+ or Node.js 24 LTS**. Fumadocs' watcher dependency requires
at least Node 22.22 on the 22.x line.

```sh
# From the repository root
npm --prefix docs ci
npm run docs:dev
```

Open the address printed by the development server:

- `/`: landing page with a small listening demo.
- `/docs`: the single documentation reference, authored in `content/docs/`.
- `/docs/skills`: the integration skill, prompt, installation tabs, and instruction preview.
- `/examples`: the single gallery with all ten detailed playgrounds and builder.

`npm run examples` is a compatibility alias for `npm run docs:dev`; both start
this same site on port 3000. `npm run examples:build` aliases `docs:build`.

```sh
npm run docs:typecheck
npm --prefix docs run test:skills
npm run docs:build
```

Development and production builds use Next.js 16's default bundler, Turbopack.
Its root is the repository root so the playground can import the real library
from `../src`.

The production build exports static files to `docs/out/`. Search runs in the
browser against a generated index; no database, API keys, or search service are
required. The `app/api/search` route is evaluated at build time, not deployed as
a server function.

## Verify locally

With the development server running, check:

- The landing page keeps the sage/cream palette on desktop and mobile.
- The navigation/sidebar theme switch offers Light, Dark, and System. Check
  the landing page, docs, Skills page, search dialog, and full gallery in both
  modes. The choice should persist after reload; System follows the OS setting.
- Switch themes during playback: CSS-owned waveforms and minimaps redraw with
  the new colors while audio, position, and annotations remain intact. Selected
  waveform JSON presets retain their own palette independently of the site.
- The bundled audio plays and pauses. Click/drag the waveform and use its
  Left/Right, Shift+Left/Right, and Home/End keyboard controls to seek.
- Volume, speed, restart, opening a local audio file, and returning to the demo
  work. Local audio stays in the browser.
- The landing demo's Theme selector offers Follow site, Sage, Studio, Neon, and
  Paper. Presets update waveform colors and appearance during playback without
  resetting position; Follow site restores the page's light or dark palette.
- The agent prompt and AI menu links use the public domain in `lib/site-config.mjs`, including on local and preview deployments.
- The Skills page switches between Codex, Cursor, and Claude Code install
  commands, copies the selected command, and expands the full skill preview.
- `/skill.md` downloads as `SKILL.md`; `/skills/raavl-integrate/SKILL.md` has
  identical content, and `/skills/raavl-integrate/agents/openai.yaml` is available.
- The old `/docs/agents` and `/markdown/agents/content.md` URLs still resolve to
  the maintained Skills page and its Markdown.
- React/JavaScript example tabs switch by click and arrow keys.
- `/docs` and direct URLs such as `/docs/quickstart` load, mobile navigation
  opens, and search returns results for terms such as `peaks` and `themes`.
- `/examples` lists all ten playgrounds. Open styling, annotations, optional
  modules, and scale. Switch code tabs and verify the controls still work.
- `/examples#demos/soundcloud/vanilla` and its React tab show gray/orange gradients,
  hover highlighting, and time badges. Click to seek and toggle playback; Space
  plays/pauses and arrow keys seek. The complete theme and CSS are in each snippet.
- Deep links such as `/examples#demos/modules/react` open their intended example.
  Documentation links from the gallery go to `/docs`.
- Copy Markdown and the Open menu work on every docs page. The menu includes
  the page's GitHub source, View as Markdown, ChatGPT, Claude, and
  Cursor; AI prompts reference the canonical public page URL.
  `/llms.txt`, `/llms-full.txt`, and
  `/markdown/quickstart/content.md` return readable text.
- The browser console has no hydration errors or failed asset requests. Editing
  an MDX page or a playground component updates the preview.

Stop the development server, then run `npm run docs:typecheck` and
`npm run docs:build` from the repository root. The build must report Turbopack
and finishes by verifying all exported docs pages, Markdown/index parity,
internal content links, search data, the examples gallery, shared audio assets,
skill-source parity, and compatibility aliases. Output is `docs/out/`.

For library regression checks, install the root dependencies with `npm ci`,
then run `npm run check` from the repository root.

## Edit content

- `content/docs/*.mdx`: public guides and API documentation.
- `content/docs/meta.json`: navigation order and section labels.
- `app/(home)/page.tsx`: landing page.
- `components/audio-playground.tsx`: real library integration and user controls.
- `app/global.css`: existing sage/cream palette and landing-page styles.
- `app/dark.css`: forest-green/sage dark palette and dark UI overrides; typography
  and light-mode styles stay in their existing files.
- `lib/source.ts`: shared content loader and Markdown rendering.
- `lib/site-config.mjs`: the public domain constant and absolute URL helper, shared by metadata, agent prompts, AI links, and Markdown/index output.
- `../examples/live/Examples.tsx`: the shared gallery and builder shell, mounted
  once by `app/(home)/examples/page.tsx`. The other components in that directory
  implement its individual playgrounds.
- `../examples/live/usePageTheme.ts`: observes the resolved HTML theme so the
  Canvas examples can refresh colors without replacing their player or source.

The playground imports `../src` through TypeScript aliases so it exercises the
current library without an npm release or a separate library build. Next.js
resolves browser React imports through its shared runtime. The docs
TypeScript configuration explicitly resolves types from its own installation,
so deployment does not require installing the root development dependencies.
The landing demo defaults to `public/bach_classical.mp3`, with a demo-sound
selector for `classical_guitar.mp3`, `beat.mp3`, and `outfoxing.mp3` from the same
directory. It decodes their waveforms in the browser, just like uploaded audio.
Playback and Regions tabs share the same player. Regions mode uses the library's
editable overlays and accessible annotation list, with application controls for
adding, naming, playing, and deleting ranges. Edits are kept per source in memory
when switching tabs or demo sounds.
The gallery examples use the original
synthetic audio and peak JSON in `public/demo-{a,b}.{wav,json}`. Regenerate those
fixtures with `node scripts/generate-fixtures.mjs` from the repository root.

Historical proposals under `design/` and the internal `PRODUCT.md` feature
inventory are not public documentation. Legacy top-level Markdown guides now
contain compatibility pointers to the canonical MDX pages; edit MDX only.
Only content included by the site and files under `public/` enter the export.

## Agent support

- `../skills/raavl-integrate/SKILL.md`: the single maintained integration workflow.
- `../skills/raavl-integrate/agents/openai.yaml`: optional Codex display metadata.
- `/docs/skills`: the human-facing Skills page; `/docs/agents` is a compatibility alias.
- `/skill.md` and `/skills/raavl-integrate/SKILL.md`: identical generated downloads.
- `/llms.txt`: generated documentation index.
- `/llms-full.txt`: generated full Markdown documentation.
- `/markdown/<slug>/content.md`: individual generated Markdown pages.
- Each docs page offers copy/read Markdown actions.
- The hero prompt uses the shared public URL, so copied links remain reachable
  when the prompt is copied from a local or preview deployment.

`scripts/prepare-skills.mjs` publishes only the skill and its Codex metadata from
the repository's `skills/` directory into `public/`. It runs before development,
typechecking, and building, and after dependency installation. Generated public
copies are ignored by Git; edit the canonical skill only. The on-page instruction
preview reads the same prepared file used by the downloads. API details stay in
MDX and are linked from the skill.

```sh
# Check generated files without modifying them
node docs/scripts/prepare-skills.mjs --check
```

The install commands use `npx skills add raptisj/ravl` and require the skill to
be pushed to a repository the installer can access. Before pushing, test with
`npx skills add /absolute/path/to/raavl --skill raavl-integrate` from a consuming
project. This installs agent instructions, not the raavl library. Actual discovery
and integration should be checked in each target agent; the automated tests
verify publication, links, commands, and aliases, not live agent sessions.

## Hosting

See [HOSTING.md](HOSTING.md) for Vercel settings and the distinction between
build-time access to the library source and publicly served output.

## Reference and scope

Inspired by [pg-workflows/apps/docs](https://github.com/SokratisVidros/pg-workflows/tree/main/apps/docs):
Next.js route groups, Fumadocs MDX/navigation, static search, a copyable agent
prompt, and text endpoints generated from the same source as the human docs.

That project uses a Bun workspace and Cloudflare Workers Static Assets, with a
GitHub Actions workflow for deployment. raavl retains npm and uses a standalone
docs application; neither a workspace migration nor Cloudflare infrastructure
is needed. Vercel can handle Git previews and production deployment directly.
