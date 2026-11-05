# 2026-11-04: tasks 1.4–1.6 surface bundle pipeline

Scope: Phase 2 PR B (`feat/data/1-4-1-6-surface-bundle`). This is an
education/research prototype run on public, de-identified CT. It is not a
clinical evaluation. All tolerances are **placeholders** until G2 sets them.

## Environment

- macOS 26.6.2, Apple arm64, Python 3.11.4, in a virtualenv outside the repo.
- Packages are pinned in `pipeline/requirements.txt`: numpy 2.4.6,
  scikit-image 0.26.0, trimesh 5.2.0, fast-simplification 0.2.0,
  nibabel 5.4.2, pynrrd 1.1.3.
- Data comes from the shared `NOVA-data` Drive through `JAS_DATA_ROOT`. Input
  label hashes are recorded in each manifest under `provenance.input_hashes`.

## Checks performed

| Check | Command | Result |
| --- | --- | --- |
| Unit and acceptance tests (synthetic only) | `~/.venvs/jas/bin/python -m pytest pipeline/tests -q` | 28 passed |
| Phantom sidecar against its GLB | `python3 schemas/validate.py media/models/phantom/anatomy.json media/models/phantom/model.glb` | OK, 0 warnings |
| Phantom bundle integrity | `python -m pipeline.verify_bundle media/models/phantom` (also run by the build) | bundle OK |
| Reproducible fixture | test `test_committed_fixture_is_current_and_valid` | revision `e98a3dec87b3…` rebuilt identically |
| Real case: MSD `liver_39` | `python -m pipeline.build --dataset msd-liver --case liver_39 --out media/local/liver_39` | bundle OK, ~9 s |
| Real case: MSD `hepaticvessel_424` | same, with `msd-hepaticvessel` | bundle OK, ~2 s |

The tests cover these geometry properties on the asymmetric phantom, which
is anisotropic (0.8/2.0/0.8 mm), axis-permuted and mirrored (det < 0):
- the tumour centre lands within 0.8 mm of its world landmark
- the L-arm stays on patient right (no mirroring)
- extents along the 2 mm axis are in true mm
- normals point outward
- mesh volume is within 10% of voxel volume
- the 1-voxel vessel stays a closed tube
- an empty label is reported, not generated

The tests also cover these QA-gate and integrity properties:
- over-smoothing is rejected
- the thin vessel is not smoothed away
- decimation keeps watertightness and the Euler number
- tampered assets, edited manifests, escaping paths and missing files are all rejected
- the NRRD header carries the affine
- real-data output into tracked `media/` is refused

## Real-case QA summary (non-sensitive aggregates only; bundles not committed)

| Case | Spacing mm | Structure | Voxel volume ml | Faces in → out | Max displacement mm | ΔV % | Watertight | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| liver_39 | 1.0 × 1.0 × 1.0 | liver | 2992.4 | 534,314 → 171,664 | 0.0 | 0.0 | yes | 80k budget not reached (topology kept); smoothing exceeded bound, so unsmoothed |
| liver_39 | | liver_tumor | 349.0 | 92,242 → 80,000 | 0.94 | 0.18 | yes | — |
| hepaticvessel_424 | 0.732 × 0.732 × 1.5 | hepatic_vessel | 27.9 | 77,328 → 77,328 | 0.0 | 0.0 | yes | smoothing would change volume >5%, so unsmoothed |
| hepaticvessel_424 | | liver_tumor | 30.2 | 23,152 → 23,152 | 0.63 | 1.0 | yes | — |

GLB sizes: liver_39 4.5 MB optimized (11.3 MB original); hepaticvessel_424 1.8 MB.

## Not exercised

- IRCADb DICOM cases. Reading DICOM series is task 1.1 (Phase 1), and the
  comparison against IRCAD's reference VTK meshes waits for it.
- Browser loading of these bundles. That is PR D (2.3/2.4); `.nrrd` serving is PR C (1.7).
- Imaging-reviewer acceptance of the tolerances (G2), and segmentation review
  beyond "dataset reference labels".
- Runtime suites (`tests/test_contract.py`, `test_visual.py`, `test_gesture.mjs`).
  No runtime file changed in this PR.
