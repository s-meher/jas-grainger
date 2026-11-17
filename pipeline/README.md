# pipeline/: Phase 2 offline data pipeline (tasks 1.4–1.6)

Labeled scan → `jas-bundle/1` folder ([ADR 0002](../docs/decisions/0002-bundle-manifest-and-patient-space.md)).

```bash
python3 -m venv ~/.venvs/jas && ~/.venvs/jas/bin/pip install -r pipeline/requirements.txt
~/.venvs/jas/bin/python -m pipeline.build --phantom --out media/models/phantom --created 2026-11-04T00:00:00Z
export JAS_DATA_ROOT=".../My Drive/NOVA-data"      # see datasets/README.md
~/.venvs/jas/bin/python -m pipeline.build --dataset msd-liver --case liver_39 --out media/local/liver_39
~/.venvs/jas/bin/python -m pipeline.verify_bundle media/local/liver_39
~/.venvs/jas/bin/python -m pytest pipeline/tests -q
```

| Module | Role |
| --- | --- |
| `canonical.py` | `CanonicalImage`: the only input contract (labels + voxel→RAS mm affine). Phase 1 produces it. |
| `io_dicom.py` | 1.1: safe zip/dir reading, series selection, slice-geometry audit (sort by position, reject gaps/mixed/duplicates), LPS→RAS affine, de-identification report (counts only). |
| `ircadb.py` | 1.1: an IRCADb patient → one label volume (masks aligned to the CT grid, names normalized, overlap precedence). |
| `vtk_ref.py` | 1.1/G2: distance from our meshes to IRCAD's own reference meshes. |
| `io_nifti.py` | 1.2: NIfTI pair → `CanonicalImage` with an explicit sform/qform policy, unit check and mask alignment. |
| `resample.py` | 1.3: optional resampling with the physical box kept (nearest for labels, linear for intensities). |
| `surfaces.py` | 1.4: marching cubes per label, vertices in world mm, outward normals, empty labels reported. |
| `optimize.py` | 1.5: topology-preserving decimation, then Taubin smoothing, each gated by two-way displacement, volume and topology QA. |
| `export.py` | 1.6: GLB (+ original), optional NRRD, `anatomy.json`, `manifest.json`. |
| `verify_bundle.py` | 1.6/1.8: schema, hashes, revision, GLB nodes, and agreement between labels, meshes and sidecar. |
| `anatomy_catalog.py` | 1.8: stable-label display names, aliases and sourced general anatomy references pending review. |
| `phantom.py` | Synthetic asymmetric phantom with known landmarks (the committed fixture). |
| `build.py` | CLI. Refuses to write real-scan output anywhere tracked (only `artifacts/`, `data/`, `media/local/`). |
| `fetch_datasets.py` | Checks the shared Drive copy against `datasets/manifest.csv`. |

Decisions: [Phase 2 decision log](../docs/decisions/phase2-decision-log.md) D-P2-03, -05, -06, -07.
Evidence: [2026-11-04 run record](../docs/validation/2026-11-04-1-4-1-6-surface-bundle.md).

Phase 3 scan exports add a `scan.label_value` for each present structure and
source-backed `teaching_reference` entries where the dataset label has a
catalog mapping. Empty labels remain in the manifest. General anatomy text
awaits human review in the reference field and stays separate from the
existing reviewed `teach` field. The synthetic fixture and earlier bundles
remain compatible. Rebuild a local scan bundle to add this metadata.
