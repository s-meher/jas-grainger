"""Task 1.2: NIfTI image + label pair -> CanonicalImage. This replaces the
Phase 2 placeholder (pipeline/nifti_adapter.py).

What the placeholder left implicit is now an explicit, recorded policy:

  AFFINE   sform if sform_code > 0, otherwise qform if qform_code > 0, otherwise
           REFUSE (code 0 = "no orientation information": a pixel-size-only
           affine would quietly produce a model that is mirrored, rotated
           or both). If both are set and disagree beyond AFFINE_TOL, REFUSE
           unless the caller passes policy="sform" or "qform".
  UNITS    xyzt_units must say mm, or metres/micrometres, which are converted to
           mm. "unknown" is refused unless assume_mm=True, and that is recorded.
  FRAME    NIfTI world space is RAS+ by definition, so no axis conversion is
           applied and no array is ever flipped. Voxel order stays native and
           the affine carries orientation.
  MASK     the label must share the image's shape AND world grid. An integer
           mask stored as float is accepted only if its values are integral.
"""
import hashlib
from pathlib import Path

import numpy as np

from .canonical import CanonicalImage

AFFINE_TOL = 1e-3      # mm / direction-cosine agreement between sform and qform
UNIT_TO_MM = {"mm": 1.0, "meter": 1000.0, "micron": 0.001}

# MSD labels are exclusive: a tumour voxel is not a liver voxel. The organ's
# surface is the liver INCLUDING its tumours (D-P1-02); the tumour keeps its own.
CONTAINS = {"msd-liver": {"liver": (1, 2)}}

# label values per dataset (datasets/README.md); ids are the stable names
LABEL_MAPS = {
    "msd-liver": {1: "liver", 2: "liver_tumor"},
    "msd-hepaticvessel": {1: "hepatic_vessel", 2: "liver_tumor"},
}


class NiftiError(ValueError):
    pass


def _sha256(p, chunk=1 << 20):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def choose_affine(img, policy="auto"):
    """-> (4x4 affine in mm, decision dict)."""
    hdr = img.header
    sc, qc = int(hdr["sform_code"]), int(hdr["qform_code"])
    S, Q = hdr.get_sform(), hdr.get_qform()
    if policy == "sform":
        if sc <= 0:
            raise NiftiError("policy=sform but sform_code is 0")
        A, src = S, "sform (forced)"
    elif policy == "qform":
        if qc <= 0:
            raise NiftiError("policy=qform but qform_code is 0")
        A, src = Q, "qform (forced)"
    else:
        if sc > 0 and qc > 0 and not np.allclose(S, Q, atol=AFFINE_TOL):
            raise NiftiError("sform and qform disagree; choose explicitly (--affine-policy)")
        if sc > 0:
            A, src = S, "sform"
        elif qc > 0:
            A, src = Q, "qform"
        else:
            raise NiftiError("sform_code and qform_code are both 0: orientation unknown")
    unit = hdr.get_xyzt_units()[0]
    return np.asarray(A, float), {"source": src, "sform_code": sc, "qform_code": qc,
                                  "sform_qform_agree": bool(np.allclose(S, Q, atol=AFFINE_TOL)),
                                  "spatial_unit": unit}


def _to_mm(A, unit, assume_mm):
    if unit in UNIT_TO_MM:
        k = UNIT_TO_MM[unit]
    elif unit == "unknown" and assume_mm:
        k = 1.0
    else:
        raise NiftiError(f"spatial unit {unit!r}: cannot establish millimetres")
    A = A.copy()
    A[:3, :] *= k          # scales directions and origin; the bottom row stays [0,0,0,1]
    return A


def load_pair(image_path, label_path, dataset, case, *, with_image=False,
              policy="auto", assume_mm=False, label_map=None):
    import nibabel as nib
    image_path, label_path = Path(image_path), Path(label_path)
    img, lab = nib.load(str(image_path)), nib.load(str(label_path))
    if len(lab.shape) != 3 or lab.shape != img.shape[:3]:
        raise NiftiError(f"image {img.shape} and label {lab.shape} grids differ")
    Ai, di = choose_affine(img, policy)
    Al, dl = choose_affine(lab, policy)
    Ai, Al = _to_mm(Ai, di["spatial_unit"], assume_mm), _to_mm(Al, dl["spatial_unit"], assume_mm)
    if not np.allclose(Ai, Al, atol=AFFINE_TOL):
        raise NiftiError("image and label world grids differ: mask is not aligned")
    raw = np.asanyarray(lab.dataobj)
    if raw.dtype.kind == "f":
        if not np.allclose(raw, np.rint(raw)):
            raise NiftiError("label volume has non-integer values")
        raw = np.rint(raw)
    labels = raw.astype(np.int16)
    lmap = label_map or LABEL_MAPS.get(dataset)
    if lmap is None:
        raise NiftiError(f"no label map for dataset {dataset!r}")
    unknown = sorted(set(np.unique(labels).tolist()) - {0} - set(lmap))
    image = np.asanyarray(img.dataobj).astype(np.float32) if with_image else None
    surface_masks = {sid: np.isin(labels, vals) for sid, vals in CONTAINS.get(dataset, {}).items()}
    return CanonicalImage(
        labels=labels, affine=Al, label_names=dict(lmap), source_case=case, image=image,
        provenance={
            "dataset": dataset, "loader": "pipeline.io_nifti",
            "affine_policy": {"label": dl, "image": di, "requested": policy,
                              "assume_mm": bool(assume_mm and dl["spatial_unit"] == "unknown")},
            "unlabelled_values_present": unknown,
            "label_sha256": _sha256(label_path),
            "image_sha256": _sha256(image_path) if with_image else None,
            "surfaces_from": {k: f"labels in {list(v)}" for k, v in CONTAINS.get(dataset, {}).items()},
        },
        surface_masks=surface_masks,
    ).validate()
