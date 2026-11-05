# Architecture decision log

Use `NNNN-short-title.md` for a consequential technical decision. Include status
(proposed/accepted/superseded), date, task IDs, context, options, decision,
consequences, evidence and the deciding reviewers. Link a superseding ADR rather
than rewriting the historical decision. A proposed design is not accepted code.

## Initial decision queue

| Suggested ID | Decision to make | Current default |
| --- | --- | --- |
| 0001 | Frontend modules and optional build system | Keep current vanilla-JS/barehands runtime; no framework migration selected. |
| 0002 | Patient-space/bundle schema and export axes | Preserve explicit physical transforms; agree schema and tolerances in G2. |
| 0003 | Volume/MPR loader and rendering approach | Prototype before selecting a library/shader. |
| 0004 | Ingestion execution and private asset delivery | Separate data conversion from browser delivery; current localhost server is development-only. |
| 0005 | Tracking worker and scheduling | Measure worker prototype vs current main-thread behavior. |
| 0006 | Browser speech and offline dependencies | Explicit voice/privacy/offline requirements before selecting fallback. |

These are decision topics, not six accepted ADRs. Add actual records as their
implementation spikes establish evidence.

## Records

| ID | Title | Status |
| --- | --- | --- |
| [0001](0001-frontend-modules-no-bundler.md) | Frontend modules without a bundler or framework | proposed |
| [0002](0002-bundle-manifest-and-patient-space.md) | Bundle manifest and patient-space export axes | proposed |
| [0005](0005-tracking-worker.md) | Hand tracking on the main thread vs in a worker | proposed (main-thread default until measured on target hardware) |

Phases 1 and 2 log each smaller choice as a decision tree:
[Phase 1](phase1-decision-log.md) · [Phase 2](phase2-decision-log.md).
