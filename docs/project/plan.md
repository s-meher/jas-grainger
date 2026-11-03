# JAS NOVA project plan

Planning baseline: 2026-11-02. Status entries describe inspected source, not a new
test run. Weeks are relative estimates from kickoff with three workstreams;
they are not dates, assigned staff, or a clinical release commitment.

## Product goal and intended progression

**Hand-tracked 3D anatomy, built on barehands.** Hold a 3D heart (the example
organ) in your bare hands, cut it open, point at a structure and hear what it
is, then work a sourced pathology case. The clinician-facing target is Chrome
and a webcam, without a headset, controllers, or an application installation.

The long-term purpose is to help doctors understand a patient's anatomy before
and during surgery. Deliver that progression in distinct stages:

1. Reliable generic-organ education and sourced case exploration.
2. Patient-scan research prototype with verifiable geometry and reviewed
   segmentations; retrospective/de-identified evaluation first.
3. Validated preoperative workflow under an agreed intended use.
4. Separately evaluated intraoperative reference workflow. Real-time surgical
   navigation, tracking anatomy that deforms, and registration to a live patient
   are not implied by displaying a preoperative scan.

The current repository remains education/research only. The goal does not itself
establish clinical safety, regulatory status, or permission to use patient data.
See [validation strategy](../validation/strategy.md).

"Nothing to install" describes the target end-user experience. Today developers
run a Python localhost server and the browser loads CDN dependencies. Data
conversion needs a provisioned service or operator environment. Delivery and
offline behavior are explicit work items, not capabilities already shipped.

## Source plan and changes to it

The [original task map](project_task_map.md) is preserved byte-for-byte. Its
SHA-256 at import is `C70BD032CCB9622D01B01ED65CB90A6063797F0086FE1E84F1561E8B663DE85B`.
Retain the original task IDs below so existing assignments can be carried over.

| Source suggestion | Working interpretation |
| --- | --- |
| Build a fresh scene, camera, gestures, clipping and raycast layer | Verify and extend the imported NOVA implementation first; avoid duplicating it. |
| Liver/vessels/tumors datasets | Keep the generic heart regression fixture; use liver as the first scan-derived vertical slice. No claim of heart scan ingestion yet. |
| React/Vite, FastAPI/Flask, AMI.js | Candidate choices, not approved migrations. Decide through an ADR after a focused prototype. |
| DICOM sanitizer by renaming files and sorting tags | Separate path safety from de-identification; reconstruct spatial geometry using orientation/position, not filenames or InstanceNumber alone. |
| Normalize every scan to 1 mm | Choose target grid per dataset and record its transform; resampling is optional and must preserve physical coordinates and labels. |
| Smooth/decimate until fast | Establish geometric tolerances and preserve thin vessels before trading accuracy for speed. |
| Eight weeks | Research-MVP planning estimate only; clinical readiness is outside that estimate. |

### Candidate datasets from the supplied map

| Candidate | Planned use | Entry condition |
| --- | --- | --- |
| 3D-IRCADb-01 (DICOM) | Exercise series reconstruction and scan/mask handling in 1.1. | Confirm access, actual package layout, labels, license and permitted evaluation use in G1. |
| MSD Task03 Liver (NIfTI) | First liver image/mask path for 1.2-1.6. | Inspect actual image/label geometry and available structure classes; do not infer missing labels. |
| MSD Task08 HepaticVessel (NIfTI) | Additional vessel-focused ingestion and geometry fixtures. | Separate patients/series stay separate; confirm labels and permissions before use. |

These are user-supplied candidates, not downloaded or approved datasets. Keep
tests self-contained with synthetic fixtures while access/review is pending.

## Baseline inventory

| Capability | Source evidence | Remaining work |
| --- | --- | --- |
| Chrome board and MediaPipe hand tracking | `stage.html` | Camera/lighting/occlusion studies; worker separation is not implemented. |
| Three.js model staging and manipulation | `stage.html`, `js/medical/core.js` | Patient bundle adapter and stable coordinate transforms. |
| Cut planes, caps, isolate/hide, labels, x-ray | `js/medical/render.js`, `gesture.js` | Verify scan-derived meshes; true volume/MPR is new. |
| Pointing and structure lookup | `js/medical/core.js` | Calibration, depth ambiguity and error feedback. |
| 16-part generic heart with sidecar | `media/models/heart/` | Not derived from a patient's scan. |
| Sourced pathology case and examiner workflow | `cases/`, `pathology/`, `review/`, `skills/examiner/` | Browser case-session UI and independent content review for new cases. |
| Narration helper | `bin/narrate.sh` | macOS `say`; browser TTS is new work. |
| Local server and validated command/state interfaces | `server.py`, `schemas/verbs.md` | Ingestion jobs, patient package lifecycle, deployment controls. |
| Acceptance suites | `tests/` | Historical 2026-10-24 run: 54 gesture + 77 contract checks, two validators and visual suite passed. New data-specific tests remain. |

## Workstreams and responsibility

Names below are roles, not people already assigned.

| Role | Owns | Reviews with |
| --- | --- | --- |
| Coder 1 / Data & backend | ingestion, segmentation inputs, geometry, bundle manifest, provenance | Graphics engineer and qualified imaging reviewer |
| Coder 2 / Graphics | model/volume rendering, slicing, picking, coordinate chain, resource disposal | Data engineer and clinician reviewer |
| Coder 3 / Interaction & UI | tracking, gestures, browser speech, accessibility, case-session UI | Graphics engineer and representative users |
| Clinical/imaging reviewer (to appoint) | anatomy correctness, intended use, segmentation acceptance, evaluation | Clinical lead and engineering owners |
| Version-control manager | branch/PR guidance, integration evidence, reproducible repository state | Change author and requested reviewers |

## Delivery milestones

| Milestone | Indicative window | Exit evidence |
| --- | --- | --- |
| M0: baseline and agreements | Before week 1 | Baseline tests, representative target hardware, named reviewers, dataset access and acceptance criteria recorded. |
| M1: correct ingestion and existing-board baseline | Weeks 1-2 | Synthetic geometry fixtures; deterministic scan-to-world mapping; existing heart still works. |
| M2: scan-derived liver vertical slice | Weeks 3-4 | Reviewed liver + available vessel/tumor masks -> GLB + manifest -> browser, all in one coordinate frame. |
| M3: slicing, volume and reliable selection | Weeks 5-6 | Surface cut vs true volume distinguished; slice/mesh alignment checks; explicit selection confidence and calibration. |
| M4: browser interaction and research MVP | Weeks 7-8 | In-browser speech, case UX, degraded-tracking behavior, performance and repeat-load evidence. |
| M5: preoperative evaluation | Separate plan after M4 | Locked release, agreed clinical validation protocol, privacy/deployment review and sign-offs. |
| M6: intraoperative evaluation | Separate plan after M5 | Operating-room simulation and workflow evaluation; separate evidence for any registration/navigation claims. |

Critical path: G0/G1 -> 1.1/1.2 -> 1.3 -> 1.4/1.8 -> 1.6 -> 2.3/2.4 ->
2.5/2.6/2.7 -> interaction integration -> G5 -> M4. Generic-heart UX work can
proceed while ingestion is being built; dataset access can block M2.

## Task register: source IDs retained

Status: **New** = not implemented; **Extend** = reuse exists but task incomplete;
**Verify** = baseline implementation exists and needs acceptance evidence.
Every row remains open until its exit condition has a linked PR/test record.

### Phase 1 / M1

| ID | Owner / status | Deliverable and acceptance | Depends on |
| --- | --- | --- | --- |
| 1.1 | Data / New | Safe archive extraction, series selection, de-identification report, slice geometry audit; reject ambiguous/mixed series. Renaming alone is not sanitization. | G0, G1 |
| 1.2 | Data / New | NIfTI loader returns array, affine, units and chosen qform/sform policy; tests cover permuted/flipped axes and mismatched masks. | G1 |
| 1.3 | Data / New | Optional resampling preserves physical bounds/landmarks and categorical labels; record grid, interpolation and transform. | 1.1 or 1.2 |
| 2.1 | Graphics / Verify | Existing scene and mouse fallback accepted on target Chrome/hardware with no generic-heart regression. | G0 |
| 2.2 | Graphics / Verify | Lighting preserves anatomical visibility across cut, isolated and translucent states; reference screenshots reviewed. | 2.1 |
| 3.1 | UI / Extend | Document module boundaries on current vanilla-JS baseline; choose a bundler/framework only through ADR and migration evidence. | G0 |
| 3.2 | UI / Extend | Prototype MediaPipe worker scheduling, transfer/backpressure and browser fallback; measure UI responsiveness before adopting. | 3.1 |
| 3.3 | UI / Extend | Existing webcam flow gains visible permission/denial/recovery states, camera selection and deliberate preview privacy controls. | 3.1 |

### Phase 2 / M2

| ID | Owner / status | Deliverable and acceptance | Depends on |
| --- | --- | --- | --- |
| 1.4 | Data / New | Marching-cubes surfaces from provided/reviewed segmentation masks, including empty/thin structures; vertices map to physical world coordinates. | 1.3 |
| 1.5 | Data / New | Preserve original mesh; bounded smoothing/decimation with displacement/volume/topology checks against approved tolerances. | 1.4, G2 |
| 1.6 | Data / New | GLB + optional NRRD + versioned manifest with hashes, transforms, units, provenance and reviewer state; loader rejects corrupt packages. | 1.4, 1.8, G2 |
| 1.7 | Data / Extend | Reuse `server.py` media boundary; evaluate isolated ingestion service only if needed; no arbitrary filesystem exposure. | 1.6, G1 |
| 2.3 | Graphics / Extend | Reuse GLTFLoader path; load all related liver structures under one patient/series parent and reject incompatible bundles. | 1.6, 2.1 |
| 2.4 | Graphics / Extend | One common view transform for volume and all meshes, with inverse back to millimeters; orientation marker and known-landmark tests. | 2.3 |
| 3.4 | UI / Verify | Existing pinch assessed with normalized hand-size metric, hysteresis and tracking-loss tests. | 3.3 |
| 3.5 | UI / Verify | Existing point detection assessed for ambiguity, occlusion and handedness with explicit feedback. | 3.3 |
| 3.6 | UI+Graphics / Verify | Existing rotation/scale/translation mapped through one interaction contract; mouse/keyboard fallback and reset remain usable. | 2.4, 3.4 |

### Phase 3 / M3

| ID | Owner / status | Deliverable and acceptance | Depends on |
| --- | --- | --- | --- |
| 1.8 | Data / Extend | Extend existing anatomy sidecar, stable structure IDs and citations for scan-derived structures; separate observed patient annotations from general teaching. | G1, G2 |
| 2.5 | Graphics / New | Volume/MPR spike chooses loader/shader through ADR; intensity calibration, orientation and slice/mesh overlap checked on known fixtures. | 1.6, 2.4 |
| 2.6 | Graphics / Extend | Reuse cut planes/caps; define cuts in patient coordinates; validate presets and volume alignment. Surface clipping is not tissue-density slicing. | 2.4, 2.5 |
| 2.7 | Graphics / Extend | Existing raycast returns stable structure ID, hit point and depth/occlusion context; no hit or ambiguous hit is explicit. | 2.3, 1.8 |
| 3.7 | UI+Graphics / Extend | Reuse armed cut gesture; test calibration, smoothing, lock/unlock and tracking-loss freeze. Webcam hand depth is a control input, not a physical distance measurement. | 2.6, 3.4 |
| 3.8 | UI+Graphics / Extend | Existing pointing mapped through mirrored video -> canvas -> NDC; test aspect ratios, resize and both hands. | 2.7, 3.5 |

### Phase 4 / M4

| ID | Owner / status | Deliverable and acceptance | Depends on |
| --- | --- | --- | --- |
| 1.9 | Data / New | Reproducible ingestion job with explicit start, progress, cancellation, failure reasons, immutable output and review before publication; never auto-publish dropped files. | 1.1-1.8, G1 |
| 2.8 | Graphics / Extend | Antialiasing/highlight choices improve comprehension without hiding boundaries; performance and contrast comparisons reviewed. | 2.5-2.7 |
| 2.9 | Graphics / Verify | Load/switch/dispose stress test with memory traces and agreed bounds; no orphaned materials, textures or workers. | 2.3, 2.5 |
| 3.9 | UI / Extend | Case instructions, labels, active dataset/series/revision and review state visible; teaching/exam modes preserve answer isolation; pause/reset/fallback documented. | 1.8, 3.8 |
| 3.10 | UI / New | Browser speech names only reviewed sidecar text after dwell; debounce, cancel, mute/repeat, unavailable-voice and offline behavior tested. | 1.8, 3.8 |
| 3.11 | UI / Extend | Tune existing filters or compare EMA/One Euro; report latency/jitter tradeoff, calibrated thresholds and reacquisition behavior. | 3.2, 3.4-3.8 |

## Added cross-cutting tasks

| ID | Work | Acceptance / owner |
| --- | --- | --- |
| G0 | Baseline, intended-use and scope agreement | Record historical vs current test evidence, hardware and non-goals; all engineering leads + clinical lead. |
| G1 | Dataset and privacy boundary | Dataset access/license review; data kept outside public Git; test de-identification on metadata, filenames and burned-in pixels; approved input/output locations; Data + institutional privacy reviewer. |
| G2 | Geometry and segmentation contract | Known-distance/orientation phantom tests; segmentation source/reviewer state; tolerances chosen before optimization; Data + Graphics + imaging reviewer. |
| G3 | Tracking failure and control modes | Freeze/deselect on confidence loss, manual fallback, explicit arm/lock and visible stale state; UI + representative users. |
| G4 | Delivery/offline design | Compare localhost vs managed HTTPS delivery, private asset access, CDN removal, speech/network behavior and network-disabled test; engineering leads. |
| G5 | Measured research-MVP validation | Select numerical budgets on reference hardware at M0; measure frame time, tracking latency, asset size, memory, geometric error and task usability; all roles. |
| G6 | Preoperative clinical readiness | Intended-use, risk, privacy, cybersecurity, human-factors and regulatory assessment; approved evaluation and source-image comparison; clinical/institutional reviewers. |
| G7 | Intraoperative readiness | Camera/lighting/sterile-workflow simulation, safe pause/stale-display behavior, patient identity checks and fallback; no navigation/deformation claims without additional validation. |
| G8 | Versioned evidence and release | Issues/PR task IDs, ADRs, reproducible build/config, test records and release tag; Version-control manager + owners. |

## Next executable work

1. Appoint role owners and select target hardware/dataset permissions (G0/G1).
2. Re-run the existing baseline; record results under `docs/validation/`.
3. Define the bundle/coordinate contract and synthetic geometry fixtures (G2).
4. Implement 1.2 with a synthetic/de-identified fixture, then 1.3/1.4/1.6.
5. In parallel, prototype 3.10 on the existing generic heart and assess 3.3.

Create one GitHub Issue per deliverable when work is assigned. Use titles such
as `[1.2] Preserve NIfTI affine and mask alignment` and branch
`feat/data/1-2-nifti-loader`; link the PR and evidence back to the issue. This
document creates the plan, not the issue assignments or the clinical capability.
