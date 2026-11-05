"""PLACEHOLDER for task 1.2 (Phase 1, other workstream): NIfTI -> CanonicalImage.

Only what 1.4 needs to run on the MSD cases before 1.2 merges. When the
real 1.2 loader lands, swap `load_nifti_pair` for it at the one call site
in pipeline/build.py and delete this file. Deliberately absent (they are
1.2/1.3's job): qform/sform conflict policy beyond nibabel's default,
reorientation, resampling, DICOM.

Policy used here: nibabel's `img.affine` (sform if its code > 0, else
qform), which is RAS+ mm by the NIfTI definition. The voxel order is left
native; the affine carries orientation, so no array flip is ever applied.
"""
import hashlib
from pathlib import Path

import numpy as np

from .canonical import CanonicalImage

# label values per the dataset README (datasets/README.md). Structure ids
# are the stable names the bundle, anatomy.json and viewer all key on.
LABEL_MAPS = {
    "msd-liver": {1: "liver", 2: "liver_tumor"},
    "msd-hepaticvessel": {1: "hepatic_vessel", 2: "liver_tumor"},
}


def _sha256(p, chunk=1 << 20):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def load_nifti_pair(image_path, label_path, dataset, case, with_image=False):
    import nibabel as nib
    image_path, label_path = Path(image_path), Path(label_path)
    lab = nib.load(str(label_path))
    img = nib.load(str(image_path))
    if lab.shape != img.shape:
        raise ValueError(f"image {img.shape} and label {lab.shape} grids differ")
    # the mask must sit on the image's grid, not merely have its shape
    if not np.allclose(lab.affine, img.affine, atol=1e-3):
        raise ValueError("image and label affines differ: mask is not aligned")
    raw = np.asanyarray(lab.dataobj)
    labels = np.rint(raw).astype(np.int16) if raw.dtype.kind == "f" else raw.astype(np.int16)
    image = np.asanyarray(img.dataobj).astype(np.float32) if with_image else None
    if dataset not in LABEL_MAPS:
        raise ValueError(f"no label map for dataset {dataset!r}")
    return CanonicalImage(
        labels=labels, affine=np.asarray(lab.affine, dtype=float),
        label_names=dict(LABEL_MAPS[dataset]), source_case=case, image=image,
        provenance={
            "dataset": dataset,
            "loader": "pipeline.nifti_adapter (placeholder for 1.2)",
            "affine_policy": "nibabel img.affine (sform if code>0 else qform)",
            "sform_code": int(lab.header["sform_code"]),
            "qform_code": int(lab.header["qform_code"]),
            "label_sha256": _sha256(label_path),
            "image_sha256": _sha256(image_path) if with_image else None,
        },
    ).validate()
