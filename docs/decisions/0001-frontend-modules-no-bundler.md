# ADR 0001: Frontend modules without a bundler or framework

- **Status:** proposed
- **Date:** 2026-11-05
- **Tasks:** 3.1 (and 3.2, 3.3 as the first modules built under it)
- **Deciding reviewers:** UI + Graphics owners
- **Map:** [docs/architecture/modules.md](../architecture/modules.md)

## Context
The source task map suggested React/Vite. The repo is the barehands board:
one `stage.html` with an inline module, an import map pinning three.js and
MediaPipe, and a medical layer in `js/medical/*.js` reached through optional
hooks. plan.md 3.1 asks for module boundaries to be documented on this
baseline, and for a bundler or framework to be chosen only with migration
evidence.

## Options
1. Migrate to React + Vite. This would mean rewriting upstream stage.html,
   giving up clean merges of barehands gesture fixes, and adding a build step
   for every contributor and for the Windows setup.
2. Add a bundler only, keeping vanilla JS. It would give minification and
   offline packaging, but nothing in Phase 1 needs it.
3. **Keep native ES modules + import map**, with one module per capability
   behind optional hooks.

## Decision (proposed)
Option 3. Phase 1 added four modules (`interaction`, `camera`, `tracking`,
`track-worker`). It needed no build step and no change to how the page loads,
and every module is testable from node (`tests/test_*.mjs`) or headless
Chrome (`tests/test_tracker_browser.py`).

## Consequences
- The page still loads three.js and MediaPipe from CDNs. Offline use and pinned
  local copies are G4, and that is the point at which a bundler would earn its
  place. Revisit this ADR then.
- There is no type checking. Pure functions plus the node suites carry that load.

## Evidence
`feat/phase1-m1`: 4 new modules, 0 build configuration. Node suites: 54 + 56
checks. Browser suite: 18 checks. See
[the Phase 1 run record](../validation/2026-11-05-phase1.md).
