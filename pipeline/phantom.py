"""Synthetic asymmetric phantom: known geometry in world mm, no patient data.

Shapes are defined in *world* RAS+ mm and then sampled onto a voxel grid
whose affine is deliberately hostile:
  - anisotropic (0.8 x 2.0 x 0.8 mm)
  - permuted (voxel j runs along world z, voxel k along world y)
  - mirrored (voxel i runs toward -x; det < 0, like LPS-stored data)
Any pipeline step that ignores the affine, drops a sign or assumes 1 mm
voxels moves a landmark below, and the tests in pipeline/tests catch it.

Landmarks (world mm, RAS+):
  liver         L-shape: body x[-12,12] y[-8,8] z[-30,0]; arm x[0,16] z[0,26]
                -> the arm is on the patient's RIGHT (+x) and superior (+z)
  liver_tumor   sphere, centre (-5, 0, -15), radius 5
  hepatic_vessel  1-voxel-thick line at x=8, y=0, z[-30,20]
  portal_vein   declared label with no voxels -> must be reported empty
"""
import numpy as np

from .canonical import CanonicalImage

AFFINE = np.array([[-0.8, 0.0, 0.0, 20.0],
                   [0.0, 0.0, -0.8, 12.0],
                   [0.0, 2.0, 0.0, -40.0],
                   [0.0, 0.0, 0.0, 1.0]])
SHAPE = (48, 40, 30)
LABELS = {1: "liver", 2: "liver_tumor", 3: "hepatic_vessel", 4: "portal_vein"}
LANDMARKS = {
    "tumor_centre_mm": (-5.0, 0.0, -15.0), "tumor_radius_mm": 5.0,
    "arm_x_range_mm": (0.0, 16.0), "arm_z_range_mm": (0.0, 26.0),
    "body_box_mm": ((-12.0, -8.0, -30.0), (12.0, 8.0, 0.0)),
    "vessel_xy_mm": (8.0, 0.0), "vessel_z_range_mm": (-30.0, 20.0),
}


def world_grid():
    ijk = np.indices(SHAPE).reshape(3, -1).T.astype(float)
    xyz = ijk @ AFFINE[:3, :3].T + AFFINE[:3, 3]
    return xyz[:, 0].reshape(SHAPE), xyz[:, 1].reshape(SHAPE), xyz[:, 2].reshape(SHAPE)


def build():
    x, y, z = world_grid()
    lab = np.zeros(SHAPE, dtype=np.int16)
    body = (abs(x) <= 12) & (abs(y) <= 8) & (z >= -30) & (z <= 0)
    arm = (x >= 0) & (x <= 16) & (abs(y) <= 8) & (z > 0) & (z <= 26)
    lab[body | arm] = 1
    cx, cy, cz = LANDMARKS["tumor_centre_mm"]
    lab[(x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= LANDMARKS["tumor_radius_mm"] ** 2] = 2
    vx, vy = LANDMARKS["vessel_xy_mm"]
    lab[(abs(x - vx) < 0.4) & (abs(y - vy) < 0.4) & (z >= -30) & (z <= 20)] = 3
    img = np.full(SHAPE, -100.0, dtype=np.float32)
    img[lab == 1], img[lab == 2], img[lab == 3] = 60.0, 30.0, 150.0
    return CanonicalImage(labels=lab, affine=AFFINE.copy(), label_names=dict(LABELS),
                          source_case="synthetic:asymmetric-phantom-v1", image=img,
                          provenance={"dataset": "synthetic",
                                      "loader": "pipeline.phantom"}).validate()
