# Host the documentation and examples site on Vercel

Yes. Import this Git repository into Vercel and create a project for the `docs`
application. It serves the landing page, `/docs`, and the complete `/examples`
gallery as one deployment.

## Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `docs` |
| Framework Preset | Next.js |
| Node.js Version | 24.x LTS (or 22.x at least 22.22) |
| Install Command | `npm --prefix .. ci && npm ci` |
| Build Command | `npm run build` |
| Output Directory | Framework default (Override off) |
| Environment variables | None required |

`docs/vercel.json` records the framework, install, and build settings.
Set Root Directory and Node.js Version in the Vercel dashboard. Leave the
Output Directory override off so the Next.js integration can read build
manifests from `.next` and publish the static export from `out`. If an existing
project has an Output Directory override of `out`, turn it off before redeploying.

In the **Root Directory** settings, enable **Include source files outside of the
Root Directory in the Build Step**. The install step installs root build tools as well as site dependencies.
Each site command builds the library into `../dist`; the player and stylesheet
consume that output through the documented public entry points. The
gallery imports the shared components from `../examples/live`. The build also
publishes the integration skill from `../skills/raavl-integrate`. These are
build-time inputs. Vercel only serves the generated `docs/out` site; this
setting does not make the repository or its source directories browsable.

Keep the complete repository connected for builds. Copying only the `docs/`
folder to a different repository also requires moving the shared example
components and replacing local build aliases with an installed raavl package.
The site builds the current checkout rather than downloading the library from npm.

## What becomes public

The landing page, `/docs` pages, `/examples` gallery and builder, built
JavaScript/CSS (including the player code), sample audio, search index, and
agent-readable text/Markdown endpoints, `/skill.md`, and the skill's optional
Codex metadata are public assets. Internal Markdown
files, `PRODUCT.md`, and tests are not emitted as standalone files.
No user-selected audio is uploaded;
the demo opens it inside the browser.

Client-side library code is necessarily delivered to browsers as compiled
JavaScript. Selecting a docs root is not a way to hide code that the playground
executes, but it does restrict the hosted application to the docs build output.

## Deploy

1. Push the completed docs changes to your connected Git repository.
2. Import the repository in Vercel with the settings above and deploy.
3. Check `/`, `/docs`, `/docs/skills`, `/examples`, `/skill.md`, `/api/search`,
   `/llms.txt`, `/llms-full.txt`, and `/markdown/quickstart/content.md` on the URL.
4. Try playback and seeking, a local audio file, the gallery's theme builder and
   annotation editor, mobile navigation, docs search, the skill preview and
   download, agent installation tabs, and copied URLs.
5. Connect the public domain configured in `lib/site-config.mjs`. Update its
   `siteUrl` constant and rebuild when changing domains. Metadata, copied
   prompts, AI links, and generated Markdown all use this value.

Vercel's Git integration can create preview deployments for pull requests and
production deployments from your chosen production branch. No separate deploy
workflow or hosting credential is needed in this repository.

## Static hosting alternatives

`npm run docs:build` produces ordinary static output. Other hosts can serve
`docs/out/` if they support extensionless HTML routes: `/docs/quickstart` should
resolve `docs/quickstart.html`, while text/Markdown asset paths stay unchanged.
Do not add an SPA catch-all that returns the landing page for missing docs.

Sources: [Vercel monorepo setup](https://vercel.com/docs/monorepos),
[Vercel Root Directory settings](https://vercel.com/docs/deployments/configure-a-build#root-directory),
and [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports).
