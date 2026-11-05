# Datasets registry (metadata only — no images in Git)

This folder records **which** scans Phase 2 (M2) uses and **where** they live.
The scans themselves are never committed: this repository is public, the
project rules keep raw scans and derived patient assets out of Git
([AGENTS.md](../AGENTS.md), [version-control §3](../docs/development/version-control.md)),
the IRCADb license forbids publishing derivatives, and the set is several GB.
Why this choice: [decision log D-P2-01](../docs/decisions/phase2-decision-log.md#d-p2-01-where-the-datasets-live).

## Where the data lives

The team's shared Google Drive folder **`NOVA-data`** (ask the data owner for
access). With Google Drive for Desktop it mounts at, e.g.:

```text
~/Library/CloudStorage/GoogleDrive-<account>/My Drive/NOVA-data/      macOS
G:\My Drive\NOVA-data\                                                Windows (letter varies)
```

Point tools at it with one environment variable; nothing is copied into the repo:

```bash
export JAS_DATA_ROOT="$HOME/Library/CloudStorage/GoogleDrive-<account>/My Drive/NOVA-data"
python3 pipeline/fetch_datasets.py            # checks every case in manifest.csv is present
python3 pipeline/fetch_datasets.py --case liver_39 --case hepaticvessel_424
```

Unpack IRCADb zips only for the patients you work on, into the git-ignored
`data/` folder at the repo root (unpacked, all 20 patients are ~20 GB).
Conversion outputs go to the ignored `artifacts/`.

## Layout

| Folder | Cases | Format | Per-case files | Labels | License |
| --- | --- | --- | --- | --- | --- |
| `ircadb/3Dircadb1.N/` | 20 | DICOM, zipped | `PATIENT_DICOM.zip`, `MASKS_DICOM.zip` (one series per structure), `LABELLED_DICOM.zip`, `MESHES_VTK.zip` (IRCAD reference meshes), `liver_NN.jpg`, `LICENSE.txt` | per patient, see manifest; names not uniform | CC BY-NC-ND 4.0 |
| `msd-liver/liver_N/` | 10 | NIfTI | `image.nii.gz` (HU), `label.nii.gz` | `1` liver, `2` tumor | CC BY-SA 4.0 |
| `msd-hepaticvessel/hepaticvessel_N/` | 15 | NIfTI | `image.nii.gz`, `label.nii.gz` | `1` vessel, `2` tumor (no liver mask) | CC BY-SA 4.0 |

[`manifest.csv`](manifest.csv) is a verbatim copy of the Drive manifest (one row
per case: shape, voxel spacing, slice thickness, labels, tumor count/size,
`demo_pick`). It contains no pixel data or patient identifiers.

## Phase 2 working set

| Case | Use |
| --- | --- |
| `liver_39` | First real run: 1.0 mm isotropic, one large tumor; simplest geometry check. |
| `hepaticvessel_424` | Demo pick: tumor + vessels at 1.5 mm. CC BY-SA, but still kept out of Git under the repo's patient-derived-asset rule. |
| `3Dircadb1.13`, `3Dircadb1.8` | Demo picks: liver + vessels + tumours in **one** model. `python -m pipeline.build --dataset ircadb --case 3Dircadb1.13 --out media/local/ircadb_13`. It reads the zips in place, with nothing unpacked, and checks every surface against IRCAD's own reference meshes. |
| `liver_91` | Negative case: no tumor label — the pipeline must report it missing, not invent it. |

## Gotchas (from the Drive README; they drive the pipeline design)

- Voxels are not cubes (≈0.7 mm in-plane, 0.7–5 mm between slices). Always use
  the affine / `PixelSpacing` + `ImagePositionPatient`; never assume 1 mm.
- NIfTI and DICOM orientation differ; naive display mirrors MSD left↔right.
  Go through the affine (RAS) or `ImageOrientationPatient` — never an unlabeled flip.
- Sort DICOM slices by position along the slice normal, not filename.
- 5 mm `msd-hepaticvessel` cases are blocky; prefer ≤1.6 mm for demos.
- IRCADb structure names vary (`livertumor01…07`, `portalvein1`, `liverkyst`/
  `liverkyste`/`livercyst`, `venoussystem` vs `venacava`): map them to stable
  structure IDs in one place.

## Licenses and citation

- **3D-IRCADb-01** — CC BY-NC-ND 4.0. Internal work and demo display only;
  **never publish models or data derived from it** in this repository.
  Soler L. et al., *3D image reconstruction for comparison of algorithm
  database: a patient-specific anatomical and medical image database*, IRCAD, 2010.
- **Medical Segmentation Decathlon (Task03 Liver, Task08 HepaticVessel)** —
  CC BY-SA 4.0. Antonelli M. et al., *The Medical Segmentation Decathlon*,
  Nature Communications 13, 4128 (2022); Simpson A. et al., arXiv:1902.09063
  (2019). Hepatic vessel data: Memorial Sloan Kettering Cancer Center.

Sources for re-download: IRCADb
<https://www.ircad.fr/research/data-sets/liver-segmentation-3d-ircadb-01/>;
MSD public bucket `s3://msd-for-monai` (`Task03_Liver.tar`, `Task08_HepaticVessel.tar`).

These are public, de-identified research datasets used for an education and
research prototype. Nothing here is a clinical capability or validated
patient-specific workflow.
