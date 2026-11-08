# ravl

A proposed waveform player and annotation toolkit with ordinary DOM styling,
a framework-independent functional core, and first-class React integration.

**Status: Phase 1 — API design for review. No library is implemented yet.**
`ravl` is a working name; package names and API signatures are proposals.

## Review the design

- [Architecture and public contract](docs/design/api.md)
- [Paired vanilla and React workflows](docs/design/workflows.md)
- [Acceptance criteria and review decisions](docs/design/review.md)
- [Phases and progress](docs/ROADMAP.md)
- [Runnable browser examples](examples/README.md)

Each phase ends with a review checkpoint. Work on the next phase starts only
after the user requests it. Git commits record smaller milestones within a phase.

## Local browser preview

Requires Node.js 22 or newer. No installation or dependencies are needed.

```sh
npm run examples
```

Open http://127.0.0.1:4173. The Phase 1 preview displays the proposed workflows;
it does not play audio or run the proposed package imports. Actual player
examples will be added as the implementation becomes available.
