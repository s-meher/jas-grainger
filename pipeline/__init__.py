"""Phase 2 offline data pipeline: labeled scan -> named-structure bundle.

canonical  -> the one input contract (array + voxel->world affine, mm, RAS+)
surfaces   -> 1.4 marching cubes per label, vertices in world mm
optimize   -> 1.5 bounded smoothing/decimation with QA gates
export     -> 1.6 GLB + optional NRRD + manifest.json + anatomy.json
verify     -> 1.6 bundle integrity check (also used by tests)
"""
