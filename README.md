# 🌊 raavl

raavl is an ergonomic TypeScript audio waveform player and annotation toolkit
for JavaScript and React, with reliable playback and customizable waveforms.
The name is inspired by Maurice **Ravel**.

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

## Develop

Use Node.js 24 LTS (or Node.js 22.22+) and run from the repository root:

```sh
npm ci
npm --prefix docs ci
npm run docs:dev
```

## Checks

Run all commands from the repository root. Install the docs dependencies with
`npm --prefix docs ci` for site commands, and the root dependencies with `npm ci`
for library commands.

| Command                             | Purpose                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `npm run docs:dev`                  | Start the complete site on port 3000                                |
| `npm run examples`                  | Alias for the same site; no separate examples server                |
| `npm run docs:typecheck`            | Typecheck the site and shared example components                    |
| `npm --prefix docs run test:skills` | Run skill publication, command, URL, and alias tests                |
| `npm run docs:build`                | Build the static site with Turbopack and verify the export          |
| `npm run examples:build`            | Alias for `npm run docs:build`                                      |
| `npm run check:docs`                | Run the site typecheck, skill tests, build, and export verification |
| `npm run check`                     | Run the library typecheck, tests, and build                         |

Stop the dev server before running production build checks. Skill downloads are
prepared automatically before site development, typechecking, and building.
To check that generated skill files match their source without updating them:

```sh
node docs/scripts/prepare-skills.mjs --check
```
