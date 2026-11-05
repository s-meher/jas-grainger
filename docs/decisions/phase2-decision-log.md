# Phase 2 decision log (decision trees)

Each Phase 2 (M2) choice is logged as a small decision tree. A tree shows the
question, the options considered, the criterion that ruled each option in or
out, and the leaf that was chosen. **Why trees:** if branches conflict at merge
time, the tree shows what each side meant to do, so the resolver can keep the
intent and not just one side's lines. Consequential, long-lived choices also
get an ADR (`NNNN-title.md`); this log links to it.

Entry format: ID · date · tasks · status (`proposed` until the owners'
review accepts it) · tree · evidence. Don't rewrite old entries. Add a new
entry that supersedes the old one and link the two.

---

## D-P2-01 Where the datasets live

2026-11-04 · tasks G1, 1.4–1.6 · proposed

```mermaid
flowchart TD
  Q{Where do the Phase 2 CT datasets live<br/>so the whole team can use them?}
  Q --> A[Commit scans to the repo]
  Q --> B[Git LFS in the repo]
  Q --> C[Shared Drive + registry in repo]
  A --> A1{Public repo? project rules?<br/>IRCADb license? size}
  A1 -->|public; AGENTS.md forbids raw scans;<br/>CC BY-NC-ND forbids published derivatives;<br/>~5 GB, 100 MB file cap| AX[Rejected]
  B --> B1{Same license/privacy rules;<br/>1 GB free LFS quota}
  B1 -->|still public; quota exceeded| BX[Rejected]
  C --> C1{Everyone gets access? Reproducible?}
  C1 -->|Drive shared with team;<br/>manifest.csv copy + presence checker in Git| CY[Chosen]
```

Result: `datasets/README.md`, `datasets/manifest.csv` (metadata only),
`pipeline/fetch_datasets.py`, data root set by `JAS_DATA_ROOT`. Evidence:
the checker reported 45/45 cases complete on 2026-11-04.

## D-P2-02 How Phase 2 work is split into PRs

2026-11-04 · tasks G8 · proposed

```mermaid
flowchart TD
  Q{One branch for all of Phase 2, or one per task group?}
  Q --> A[Single phase-2 branch]
  Q --> B[Per task group, from fresh origin/main]
  A --> A1{version-control.md: one task<br/>or cohesive group per PR}
  A1 -->|9 tasks across 3 roles = hard review,<br/>wide merge-conflict surface| AX[Rejected]
  B --> B1{Reviewable? Conflict surface?}
  B1 -->|5 PRs: A docs, B data 1.4-1.6,<br/>C data 1.7, D graphics 2.3-2.4, E UI 3.4-3.6;<br/>stacked PRs name their base| BY[Chosen]
```

## D-P2-03 Building on Phase 1 before it lands

2026-11-04 · tasks 1.2, 1.3, 1.4 · proposed

```mermaid
flowchart TD
  Q{1.4 needs Phase 1's canonical image<br/>array + affine, which isn't merged yet}
  Q --> A[Wait for Phase 1]
  Q --> B[Re-implement 1.1-1.3 in Phase 2]
  Q --> C[Code against a small interface;<br/>synthetic phantom + minimal NIfTI adapter]
  A -->|blocks M2 for weeks| AX[Rejected]
  B -->|duplicates teammates' tasks;<br/>guaranteed merge conflict| BX[Rejected]
  C --> C1{Can Phase 1 plug in later<br/>without changing 1.4-1.6?}
  C1 -->|yes: CanonicalImage is the only input;<br/>adapter marked placeholder, NIfTI only,<br/>no DICOM, no resampling| CY[Chosen]
```

## D-P2-04 Asset bundle contract

2026-11-04 · tasks 1.6, 2.3, 2.4 · proposed · ADR
[0002](0002-bundle-manifest-and-patient-space.md)

```mermaid
flowchart TD
  Q{How does a scan-derived model describe<br/>its geometry, assets and provenance?}
  Q --> A[Extend barehands-anatomy/1 in place]
  Q --> B[New versioned manifest next to the sidecar]
  A -->|system.md: do not silently change<br/>barehands-anatomy/1; heart must keep working| AX[Rejected]
  B --> B1{Existing viewer keeps working?}
  B1 -->|anatomy.json still emitted and validated;<br/>manifest jas-bundle/1 adds transforms,<br/>hashes, provenance, QA| BY[Chosen]
```

## D-P2-05 Coordinate frame and units of exported meshes

2026-11-04 · tasks 1.4, 1.6, 2.4, G2 · proposed · ADR
[0002](0002-bundle-manifest-and-patient-space.md)

```mermaid
flowchart TD
  Q{Which frame and unit are GLB vertices stored in?}
  Q --> A[Voxel indices]
  Q --> B[glTF convention: metres, +Y up]
  Q --> C[Patient world RAS+, millimetres]
  A -->|anisotropic voxels: squashed model,<br/>no real distances| AX[Rejected]
  B -->|needs a hidden axis swap + unit change;<br/>easy to mirror silently| BX[Rejected]
  C --> C1{Measurable? Mirroring detectable?}
  C1 -->|voxel spacing and affine applied once;<br/>manifest declares units=mm, axes=RAS;<br/>viewer scales via one stored transform + inverse| CY[Chosen]
```

Consequence: `anatomy.json` `axes` for exported bundles is
`{superior:+z, left:-x, anterior:+y}` (RAS+: +x is patient right).

## D-P2-06 Decimation algorithm, aggression and step order

2026-11-04 · tasks 1.5, G2 · proposed

```mermaid
flowchart TD
  Q{How do we cut face counts<br/>without breaking the surface?}
  Q --> A[trimesh.simplify_quadric_decimation default]
  Q --> B[fast_simplification agg=0, smooth THEN decimate]
  Q --> C[fast_simplification agg=0, decimate THEN smooth]
  A -->|phantom liver: 4 non-manifold edges,<br/>watertight lost, Euler 4 to 7| AX[Rejected by QA gate]
  B -->|liver_39: 534k to 529k faces only;<br/>smoothed surface resists collapse| BX[Rejected: no real reduction]
  C --> C1{Topology kept? Displacement within bound?}
  C1 -->|liver_39 liver 534k to 172k, Euler -46 kept, 0.0 mm;<br/>tumor 92k to 80k, 0.94 mm| CY[Chosen]
```

Open (needs G2): liver_39's liver stays above the 80k budget, because going
lower means removing small handles caused by voxel noise, and that is a
topology change. Taubin smoothing on the decimated liver exceeded the 1 mm
placeholder bound, so the liver ships unsmoothed. Whether a topology change
or more displacement is acceptable is an imaging-reviewer call, not a
performance call.

## D-P2-07 Where real-scan bundles are written

2026-11-04 · tasks 1.6, 1.7, G1 · proposed

```mermaid
flowchart TD
  Q{Where does build.py write bundles<br/>made from real scans?}
  Q --> A[media/models/ like the heart]
  Q --> B[artifacts/ only]
  Q --> C[ignored media/local/ + artifacts/ + data/]
  A -->|tracked path: one git add publishes<br/>patient-derived assets; IRCADb ND license| AX[Rejected]
  B -->|outside the media airlock:<br/>the board cannot stage it| BX[Rejected]
  C --> C1{Board can load it locally? Git can't see it?}
  C1 -->|inside the airlock, gitignored;<br/>build.py refuses any other in-repo path| CY[Chosen]
```

Only `media/models/phantom/` (synthetic) is committed.

## D-P2-09 How the board loads a scan bundle

2026-11-04 · tasks 2.3, 2.4 · proposed · ADR [0002](0002-bundle-manifest-and-patient-space.md)

```mermaid
flowchart TD
  Q{How does stage.html load a jas-bundle/1 GLB<br/>and keep true mm?}
  Q --> A[New bundle viewer / scene graph]
  Q --> B[Load as a plain GLB, check the manifest afterwards]
  Q --> C[Verify first, parse the verified bytes;<br/>reuse the existing whole-scene centre + fit]
  A -->|plan.md 2.3/2.4: extend, don't duplicate;<br/>would lose cut/isolate/label/explode| AX[Rejected]
  B -->|a tampered or partial model is already on screen<br/>when the check fails; second fetch can differ| BX[Rejected]
  C --> C1{One transform for all structures? Inverse exact?<br/>Plain models untouched?}
  C1 -->|existing code already centres gltf.scene once and fit-scales one group;<br/>mmToScene/sceneToMm via node matrices: 1.8e-15 mm round trip,<br/>tumour landmark 0.2 mm under a rotated pose; no manifest = null = upstream path| CY[Chosen]
```

Consequences:
- The stage.html change is limited to two marked hooks: the parse source and
  the bbox cache key, which now includes the manifest revision.
- The bundle code lives in `js/medical/bundle.js`.
- core.js's `onModelLoaded` attaches the transform.

## D-P2-08 and D-P2-10 (separate files)

These two were written on branches that didn't include this log, so they
live as standalone files to avoid append conflicts:
[D-P2-08 serving scan bundles](phase2/D-P2-08-asset-serving.md) ·
[D-P2-10 how 3.4–3.6 "Verify" is done](phase2/D-P2-10-gesture-verification.md).
