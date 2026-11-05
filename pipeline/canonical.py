"""The one input contract for Phase 2: a labeled volume in patient space.

Phase 1 (1.1 DICOM, 1.2 NIfTI, 1.3 resampling) owns *producing* this; the
surface/export stages only ever *consume* it. That single seam is what
lets the two workstreams merge without touching each other's files
(decision D-P2-03). Everything downstream trusts exactly two things:
the integer label array and its voxel->world affine (RAS+, millimetres).
No stage may assume 1 mm voxels or a particular axis order.
"""
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

_ID_OK = set("abcdefghijklmnopqrstuvwxyz0123456789_")


@dataclass(frozen=True)
class CanonicalImage:
    labels: np.ndarray            # (I, J, K) integer labels, 0 = background
    affine: np.ndarray            # 4x4 voxel index (i,j,k,1) -> RAS+ mm
    label_names: dict             # {label value: structure id}
    source_case: str              # dataset case id, or "synthetic:<name>"
    image: Optional[np.ndarray] = None   # same grid as labels (HU), optional
    provenance: dict = field(default_factory=dict)

    @property
    def spacing(self):
        """Voxel edge lengths in mm (column norms of the affine's 3x3)."""
        return tuple(float(x) for x in np.linalg.norm(self.affine[:3, :3], axis=0))

    def validate(self):
        """Raise ValueError on anything that would make geometry silently
        wrong. Called by every stage entry point — cheap, and the failure
        modes (mismatched grids, singular/sheared affines) are exactly the
        ones that otherwise produce a plausible-looking wrong model."""
        L, A = self.labels, np.asarray(self.affine, dtype=float)
        if L.ndim != 3:
            raise ValueError(f"labels must be 3-D, got shape {L.shape}")
        if not np.issubdtype(L.dtype, np.integer):
            raise ValueError(f"labels must be integer, got {L.dtype}")
        if A.shape != (4, 4) or not np.all(np.isfinite(A)):
            raise ValueError("affine must be a finite 4x4 matrix")
        if not np.allclose(A[3], [0, 0, 0, 1]):
            raise ValueError("affine bottom row must be [0,0,0,1]")
        M = A[:3, :3]
        if abs(np.linalg.det(M)) < 1e-9:
            raise ValueError("affine is singular")
        # sheared grids are legal NIfTI but nothing here is built for them;
        # refuse rather than export a subtly distorted model
        n = M / np.linalg.norm(M, axis=0)
        off = n.T @ n - np.eye(3)
        if np.max(np.abs(off)) > 1e-3:
            raise ValueError("affine axes are not orthogonal (sheared grid)")
        if self.image is not None and self.image.shape != L.shape:
            raise ValueError(f"image shape {self.image.shape} != labels {L.shape}")
        for v, sid in self.label_names.items():
            if int(v) <= 0:
                raise ValueError(f"label value {v} must be > 0 (0 is background)")
            if not sid or len(sid) > 64 or set(sid) - _ID_OK:
                raise ValueError(f"structure id {sid!r} is not snake_case")
        return self

    def voxel_to_world(self, ijk):
        """(N,3) voxel coordinates -> (N,3) RAS+ mm."""
        ijk = np.asarray(ijk, dtype=float)
        return ijk @ self.affine[:3, :3].T + self.affine[:3, 3]
