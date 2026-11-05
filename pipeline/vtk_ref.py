"""Independent geometry check (1.1 / G2): compare our meshes with IRCAD's own.

3D-IRCADb ships `MESHES_VTK/<structure>.vtk` (legacy VTK POLYDATA, binary
big-endian or ASCII) for each structure. They are made by IRCAD from the
same masks, independently of this pipeline. If our DICOM ordering, spacing
or axis handling were wrong (a mirrored axis, a reversed slice order,
a 1-mm assumption), our surfaces would sit centimetres away from theirs.

Their meshes are in the scan's DICOM patient frame (LPS mm). Ours are RAS mm,
so ours are converted with the same labelled diag(-1,-1,1) before comparing.
IRCAD's meshes are decimated (e.g. ~4k points for a whole liver), so
"distance" includes their simplification error too. Read the mean/p95,
not the max, as the agreement figure.
"""
import re

import numpy as np

RAS_TO_LPS = np.diag([-1.0, -1.0, 1.0])


def read_vtk_polydata(data: bytes):
    """-> (points (N,3) float, triangles (M,3) int). Polygons are fanned."""
    head = data[:256]
    binary = b"BINARY" in head.split(b"\n", 3)[2] if head.count(b"\n") >= 3 else False
    m = re.search(rb"POINTS\s+(\d+)\s+(\w+)\s*\n", data)
    if not m:
        raise ValueError("no POINTS section")
    n, typ = int(m.group(1)), m.group(2).decode()
    p = m.end()
    if binary:
        dt = {"float": ">f4", "double": ">f8"}[typ]
        w = np.dtype(dt).itemsize
        pts = np.frombuffer(data[p:p + 3 * n * w], dtype=dt).reshape(-1, 3).astype(float)
        p += 3 * n * w
    else:
        toks = data[p:].split()
        pts = np.array(toks[:3 * n], dtype=float).reshape(-1, 3)
    m2 = re.search(rb"POLYGONS\s+(\d+)\s+(\d+)\s*\n", data[p:] if binary else data)
    if not m2:
        raise ValueError("no POLYGONS section")
    cnt, size = int(m2.group(1)), int(m2.group(2))
    q = (p if binary else 0) + m2.end()
    raw = (np.frombuffer(data[q:q + 4 * size], dtype=">i4") if binary
           else np.array(data[q:].split()[:size], dtype=np.int64)).astype(np.int64)
    tris, i = [], 0
    for _ in range(cnt):
        k = int(raw[i]); idx = raw[i + 1:i + 1 + k]; i += 1 + k
        tris.extend((idx[0], idx[t], idx[t + 1]) for t in range(1, k - 1))
    return pts, np.array(tris, dtype=np.int64)


def surface_distance(v_a, f_a, v_b, f_b, samples=5000):
    """Symmetric sampled surface distance (mm): mean, p95, max."""
    import trimesh
    from trimesh.proximity import closest_point
    a = trimesh.Trimesh(v_a, f_a, process=False)
    b = trimesh.Trimesh(v_b, f_b, process=False)
    pa, _ = trimesh.sample.sample_surface(a, samples, seed=0)
    pb, _ = trimesh.sample.sample_surface(b, samples, seed=1)
    d = np.concatenate([closest_point(b, pa)[1], closest_point(a, pb)[1]])
    return {"mean_mm": round(float(d.mean()), 3), "p95_mm": round(float(np.percentile(d, 95)), 3),
            "max_mm": round(float(d.max()), 3)}


def compare_case(case_dir, meshes_ras, folder_for_sid, samples=5000):
    """meshes_ras: {sid: (vertices RAS, faces)}; folder_for_sid: {sid: IRCAD folder}.
    -> {sid: distances | note}."""
    import zipfile
    from pathlib import Path
    z = zipfile.ZipFile(Path(case_dir) / "MESHES_VTK.zip")
    names = {Path(n).stem.lower(): n for n in z.namelist() if n.lower().endswith(".vtk")}
    out = {}
    for sid, (v, f) in meshes_ras.items():
        key = folder_for_sid.get(sid, "").lower()
        if key not in names or len(f) == 0:
            out[sid] = {"note": "no IRCAD reference mesh"}
            continue
        rv, rf = read_vtk_polydata(z.read(names[key]))
        out[sid] = surface_distance(np.asarray(v) @ RAS_TO_LPS.T, f, rv, rf, samples)
        out[sid]["reference_points"] = int(len(rv))
    return out
