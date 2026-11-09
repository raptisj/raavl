# raavl

An ergonomic TypeScript audio waveform player and annotation toolkit for
JavaScript and React, with reliable playback, customizable waveforms, and
ordinary DOM styling.

## Install

```sh
npm install raavl
```

Use the [quickstart](docs/content/docs/quickstart.mdx) to build your first player
with JavaScript or React. React 19 and React DOM 19 are optional peers for the
`raavl/react` adapter. Import `raavl/styles.css` once for the default waveform
styles, or supply your own CSS tokens.

## Documentation

- [Introduction](docs/content/docs/index.mdx)
- [Quickstart](docs/content/docs/quickstart.mdx)
- [Styling and themes](docs/content/docs/styling.mdx)
- [Annotations](docs/content/docs/annotations.mdx)
- [Skills for coding agents](docs/content/docs/skills.mdx)

The site includes a live player and ten interactive examples, plus Markdown
pages, `/llms.txt`, and `/llms-full.txt` for coding agents. The public domain is
configured once in [`docs/lib/site-config.mjs`](docs/lib/site-config.mjs).

## Develop

Use Node.js 24 LTS (or Node.js 22.22+) and run from the repository root:

```sh
npm ci
npm --prefix docs ci
npm run docs:dev
```

Open the address printed by the development server. The Next.js/Fumadocs site
in `docs/` serves the homepage, documentation, Skills page, and examples gallery.
The gallery imports the library source directly. Run `npm run build` to build
the library itself.

Documentation is authored in `docs/content/docs/`; shared examples live in
`examples/live/`. See [site development and testing](docs/README.md) and
[hosting](docs/HOSTING.md) for contributor and deployment instructions.

## Checks

Run all commands from the repository root. Install the docs dependencies with
`npm --prefix docs ci` for site commands, and the root dependencies with `npm ci`
for library commands.

| Command | Purpose |
| --- | --- |
| `npm run docs:dev` | Start the complete site on port 3000 |
| `npm run examples` | Alias for the same site; no separate examples server |
| `npm run docs:typecheck` | Typecheck the site and shared example components |
| `npm --prefix docs run test:skills` | Run skill publication, command, URL, and alias tests |
| `npm run docs:build` | Build the static site with Turbopack and verify the export |
| `npm run examples:build` | Alias for `npm run docs:build` |
| `npm run check:docs` | Run the site typecheck, skill tests, build, and export verification |
| `npm run check` | Run the library typecheck, tests, and build |

Stop the dev server before running production build checks. Skill downloads are
prepared automatically before site development, typechecking, and building.
To check that generated skill files match their source without updating them:

```sh
node docs/scripts/prepare-skills.mjs --check
```

`docs/out/` contains the static site ready for hosting. The examples and landing
player share the single set of original synthetic fixtures in `docs/public/`;
regenerate them with `node scripts/generate-fixtures.mjs`.

[PRODUCT.md](PRODUCT.md) is the internal feature inventory and contributor source
map. Historical proposals in `docs/design/` may exceed the implemented API.
