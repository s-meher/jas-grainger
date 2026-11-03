# Validation and release strategy

This is an engineering evaluation plan, not clinical guidance or a statement of
medical-device clearance. The existing code and README remain education-only.
The user-requested direction includes patient-specific preoperative and
intraoperative use; that requires additional evidence and qualified review.

## Stages and exit gates

| Stage | Permitted development scope | Evidence before progressing |
| --- | --- | --- |
| Educational baseline | Generic heart and sourced teaching cases | Existing gesture/contract/schema/visual checks plus manual webcam and content review. |
| Scan-derived research MVP | Synthetic or approved de-identified retrospective data | Correct series selection, de-identification review, image/mask alignment, coordinate chain, segmentation and mesh QA, reproducibility. |
| Preoperative evaluation | Defined intended users, indication and workflow under an approved evaluation | Clinical/imaging acceptance protocol, quantified geometry accuracy, source-image comparison, human-factors evidence, privacy/cybersecurity and applicable regulatory assessment. |
| Intraoperative evaluation | Separately scoped reference workflow under approved evaluation | OR simulation, camera/lighting/occlusion tests, pause/stale-state handling, patient/dataset confirmation, fallback workflow and clinical oversight. |

A display of a preoperative model is not real-time patient registration, surgical
navigation or deformation tracking. Add those claims only through separately
specified, implemented and validated subsystems. A PR merge or Git tag is a
software milestone, not permission for use in an operation.

## Required evidence families

- **Geometry:** synthetic asymmetric phantoms, known distances, affine round trips,
  mask/image alignment, slice ordering, duplicate/missing slices, anisotropic and
  oblique grids, flips, intensity calibration and volume/surface correspondence.
- **Segmentation/meshing:** qualified review against source images; per-structure
  surface displacement, topology/volume differences, missing thin vessels and
  bounded simplification. Agree numerical tolerances before measuring success.
- **Interaction:** representative users, both hands, camera aspect/resize/mirror
  mapping, lighting and occlusion, calibration, no-hand transitions, gesture-mode
  conflicts, false activations, time-to-selection and manual fallback.
- **Speech/content:** correct stable ID and citation provenance, dwell/debounce,
  cancellation, mute/repeat, unavailable speech and unverified content rejection;
  examiner answers stay isolated from teaching-case render data.
- **Reliability:** scene/bundle swaps, stale identity/revision, interrupted loads,
  memory/resource disposal, worker failures and network-disabled operation.
- **Data and deployment:** licensing/access rights, de-identification including
  metadata and burned-in identifiers, private storage/delivery, authorization,
  retention, dependency inventory and reproducible pinned environment.

Raw scans and patient-derived outputs never enter this public Git repository.
Record non-sensitive summaries and hashes of approved evidence; restricted
reports belong in the approved private evidence store. Git ignore rules help
avoid accidental staging but provide no access control or de-identification.

## Recording a run

Add a Markdown record under `docs/validation/` named for the date and task, e.g.
`2026-11-02-g0-baseline.md`, when a run actually occurs. Include commit SHA,
task IDs, hardware/OS/browser, dependency/config versions, exact commands,
fixtures/bundle hashes, pass/fail/skipped results, artifacts or restricted-store
references, deviations and reviewer. Never mark a skipped webcam test as passed.

The historical import tests were run on 2026-10-24; the planning documentation
does not re-run or extend those results. Test only what a change warrants:
documentation/skill changes need link/content/skill validation; runtime changes
need the relevant existing suites and new meaningful data/behavior checks.

## Release record

A release PR should identify intended use/stage, code/config/data revisions,
validation record, open limitations, reviewers and rollback target. Choose
research tags such as `research-v0.1.0` only after a release is approved. Name
preoperative and intraoperative release stages explicitly; do not inherit
readiness merely because an earlier educational suite passed.
