# Browser examples

## Run locally

From the repository root, with Node.js 22+:

```sh
npm run examples
```

Open http://127.0.0.1:4173. Stop with Ctrl+C. To change the port:

```sh
PORT=4174 npm run examples
```

No dependency installation, build, credentials, remote service, or audio download
is required. The server binds only to localhost and serves an explicit file list.

## What works now

The Phase 1 page lets you choose seven workflows, switch between vanilla and React
API sketches, copy snippets, and read their behavioral contracts. It links to the
full design and review checklist. Hash links preserve a workflow/framework choice.

**The sketches are not executable library demos.** `ravl` imports are proposed;
no package is implemented or installed. Placeholder variables stand for app UI,
audio data, and persistence. The page clearly marks this boundary.

Phase 2 adds real browser audio demos. Phase 3 adds runnable annotation editors.
Keep this folder as the entry point throughout implementation.

## Maintain the review material

Edit `workflows.js`, then run `npm run docs:workflows` to regenerate the paired
Markdown guide. `npm run check` checks syntax and that both views stay in sync.

Manual review: switch every workflow/framework; copy a snippet; reload a hash
link; navigate with the keyboard; resize to a narrow viewport; follow each design
link. Browser clipboard permission can fail; the text remains selectable.
