"""Task 1.3: OPTIONAL resampling to a chosen grid, preserving physical space.

Not a default step. The pipeline already works on anisotropic voxels because
every stage goes through the affine (plan.md: "resampling is optional and
must preserve physical coordinates and labels"). Use it when a downstream
consumer needs a regular grid.

  - the new grid covers the SAME physical box: voxel centres span the
    original extent along each axis; directions are kept, only spacing changes
  - labels are nearest-neighbour (categorical: no invented in-between labels)
  - intensities are linear (order=1); constant -1024 HU outside
  - the original grid, new grid and transform go into provenance
"""
import numpy as np

from .canonical import CanonicalImage


def resample(ci: CanonicalImage, spacing_mm):
    from scipy.ndimage import affine_transform
    ci.validate()
    tgt = np.broadcast_to(np.asarray(spacing_mm, float), (3,)).astype(float)
    if np.any(tgt <= 0):
        raise ValueError("target spacing must be > 0")
    A = np.asarray(ci.affine, float)
    old_sp = np.linalg.norm(A[:3, :3], axis=0)
    dirs = A[:3, :3] / old_sp
    old_n = np.array(ci.labels.shape)
    extent = (old_n - 1) * old_sp                       # centre-to-centre span, mm
    new_n = np.maximum(1, np.floor(extent / tgt + 1e-6).astype(int) + 1)
    B = np.eye(4)
    B[:3, :3] = dirs * tgt
    B[:3, 3] = A[:3, 3]                                 # first voxel centre unchanged
    # output voxel -> world -> input voxel
    M = np.linalg.inv(A) @ B
    lab = affine_transform(ci.labels, M[:3, :3], M[:3, 3], output_shape=tuple(new_n),
                           order=0, mode="constant", cval=0).astype(ci.labels.dtype)
    img = None
    if ci.image is not None:
        img = affine_transform(ci.image.astype(np.float32), M[:3, :3], M[:3, 3],
                               output_shape=tuple(new_n), order=1, mode="constant",
                               cval=-1024.0).astype(np.float32)
    masks = {sid: affine_transform(m.astype(np.uint8), M[:3, :3], M[:3, 3], output_shape=tuple(new_n),
                                   order=0, mode="constant", cval=0).astype(bool)
             for sid, m in ci.surface_masks.items()}
    prov = dict(ci.provenance)
    prov["resampling"] = {
        "original_shape": old_n.tolist(), "original_spacing_mm": old_sp.round(6).tolist(),
        "original_affine": np.round(A, 6).tolist(),
        "new_shape": new_n.tolist(), "new_spacing_mm": tgt.round(6).tolist(),
        "labels": "nearest-neighbour", "image": "linear, cval -1024",
        "output_to_input_voxel": np.round(M, 9).tolist(),
    }
    return CanonicalImage(labels=lab, affine=B, label_names=dict(ci.label_names),
                          source_case=ci.source_case, image=img, provenance=prov,
                          surface_masks=masks).validate()
