"""Task 1.4: marching-cubes surfaces from labeled masks, in world mm.

One surface per label value, never per connected blob: a structure id is
the unit the viewer, sidecar and teaching content key on. Each label is
cropped to its bounding box with a 1-voxel zero border. The border closes
surfaces that touch the scan edge, and it keeps 1-voxel-thin vessels
(which have no interior voxel) as closed tubes, not open sheets.

Vertices go voxel -> world through the full affine exactly once. That is
what makes anisotropic spacing and flipped axes come out right. A
negative-determinant affine mirrors the winding, so faces are re-oriented
until the signed volume is positive (outward normals) rather than trusting
an index-space convention.
"""
from dataclasses import dataclass, field

import numpy as np

from .canonical import CanonicalImage


@dataclass
class Surface:
    structure_id: str
    label_value: int
    vertices: np.ndarray = field(repr=False)   # (N,3) RAS+ mm
    faces: np.ndarray = field(repr=False)      # (M,3) int
    voxels: int = 0
    volume_ml: float = 0.0        # from voxel count x voxel volume (ground truth)
    status: str = "present"       # "present" | "empty"


def _signed_volume(v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)


def extract(ci: CanonicalImage, label_value: int, structure_id: str) -> Surface:
    from skimage.measure import marching_cubes
    mask = ci.surface_masks.get(structure_id)
    if mask is None:
        mask = ci.labels == label_value
    n = int(mask.sum())
    voxel_ml = abs(np.linalg.det(ci.affine[:3, :3])) / 1000.0
    if n == 0:
        # reported, never invented: the manifest records it as empty
        return Surface(structure_id, label_value, np.zeros((0, 3)),
                       np.zeros((0, 3), dtype=np.int64), 0, 0.0, "empty")
    idx = np.argwhere(mask)
    lo, hi = idx.min(0), idx.max(0) + 1
    crop = np.zeros(tuple(hi - lo + 2), dtype=np.float32)
    crop[1:-1, 1:-1, 1:-1] = mask[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    verts, faces, _, _ = marching_cubes(crop, level=0.5)
    verts = verts + (lo - 1)                     # back to full-volume voxel index
    world = ci.voxel_to_world(verts)
    faces = faces.astype(np.int64)
    if _signed_volume(world, faces) < 0:
        faces = faces[:, ::-1].copy()
    return Surface(structure_id, label_value, world, faces, n, n * voxel_ml)


def extract_all(ci: CanonicalImage):
    ci.validate()
    return [extract(ci, int(v), sid) for v, sid in sorted(ci.label_names.items())]
