"""Task 1.5: bounded smoothing and decimation, each gated by geometry QA.

The un-optimized 1.4 mesh is always kept (it is exported beside the
optimized one). Optimization is a proposal: a candidate only replaces the
original if it passes every gate, against tolerances fixed *before* we
look at frame rates (plan.md 1.5, G2). A failing step is retried gentler,
and if it still fails it is skipped and recorded. It never silently wins.

Gates (symmetric, so a thin vessel that collapses is caught as well as a
bulge):
  max displacement  sampled two-way surface distance (Hausdorff estimate), mm
  volume change     % vs the original mesh's enclosed volume
  topology          watertight must not be lost; Euler number must not change
"""
import numpy as np

# PLACEHOLDER tolerances: G2 + an imaging reviewer replace these. The mm
# bound scales with the coarsest voxel edge because a staircase from 5 mm
# slices is itself ~half a slice off the true boundary.
DEFAULT_TOLERANCES = {
    "max_displacement_mm": 1.0,
    "max_displacement_voxel_frac": 0.5,
    "max_volume_change_pct": 5.0,
}
DEFAULT_PLAN = {
    "taubin_iterations": [10, 5, 2],     # tried in order until QA passes
    "max_faces": 80000,                  # per structure, after decimation
    "decimate_retries": 3,               # each retry keeps 2x more faces
    "qa_samples": 4000,
}


def _mesh(v, f):
    import trimesh
    return trimesh.Trimesh(vertices=np.asarray(v, float), faces=np.asarray(f), process=False)


def _decimate(m, face_count):
    """Quadric decimation at the lowest aggression (agg=0). Measured on the
    phantom and liver_39: trimesh's default wrapper aggression produced
    non-manifold edges (watertight lost), and agg=0 kept watertightness
    and the Euler number on both. Decision D-P2-06."""
    import fast_simplification
    v, f = fast_simplification.simplify(
        np.asarray(m.vertices, np.float32), np.asarray(m.faces, np.int32),
        target_reduction=1.0 - face_count / len(m.faces), agg=0)
    return _mesh(v.astype(float), f.astype(np.int64))


def qa(orig, cand, tol, spacing, samples=4000):
    import trimesh
    from trimesh.proximity import closest_point
    bound = max(tol["max_displacement_mm"],
                tol["max_displacement_voxel_frac"] * max(spacing))
    n = min(samples, max(200, len(orig.faces)))
    p1, _ = trimesh.sample.sample_surface(orig, n, seed=0)
    p2, _ = trimesh.sample.sample_surface(cand, n, seed=1)
    d1 = closest_point(cand, p1)[1]
    d2 = closest_point(orig, p2)[1]
    disp = float(max(d1.max(), d2.max()))
    v0 = abs(orig.volume)
    dv = 100.0 * abs(abs(cand.volume) - v0) / v0 if v0 > 0 else 0.0
    topo_ok = (cand.is_watertight or not orig.is_watertight) and \
              (cand.euler_number == orig.euler_number)
    findings = []
    if disp > bound:
        findings.append(f"displacement {disp:.2f} mm > {bound:.2f} mm")
    if dv > tol["max_volume_change_pct"]:
        findings.append(f"volume change {dv:.1f}% > {tol['max_volume_change_pct']}%")
    if not topo_ok:
        findings.append(f"topology changed (watertight {orig.is_watertight}->"
                        f"{cand.is_watertight}, euler {orig.euler_number}->{cand.euler_number})")
    return {"max_displacement_mm": round(disp, 3), "bound_mm": round(bound, 3),
            "volume_change_pct": round(dv, 2), "watertight": bool(cand.is_watertight),
            "euler": int(cand.euler_number), "pass": not findings,
            "findings": findings}


def optimize(surface, spacing, tol=None, plan=None):
    """-> (vertices, faces, report). Empty surfaces pass through untouched."""
    from trimesh.smoothing import filter_taubin
    tol = {**DEFAULT_TOLERANCES, **(tol or {})}
    plan = {**DEFAULT_PLAN, **(plan or {})}
    report = {"structure_id": surface.structure_id, "steps": [], "findings": []}
    if surface.status != "present" or len(surface.faces) == 0:
        report["findings"].append("empty structure: nothing to optimize")
        return surface.vertices, surface.faces, report
    orig = _mesh(surface.vertices, surface.faces)
    report["original"] = {"faces": int(len(orig.faces)),
                          "watertight": bool(orig.is_watertight),
                          "euler": int(orig.euler_number)}
    cur = orig
    # 1) decimation FIRST, on the raw marching-cubes mesh. Measured on
    # liver_39: decimating after smoothing removed <1% of faces, while
    # decimating first reached ~170k of 534k with topology intact.
    # (D-P2-06.) Every candidate is judged against the ORIGINAL, so
    # errors from the two steps cannot stack unseen.
    target = plan["max_faces"]
    if len(cur.faces) > target:
        for _ in range(plan["decimate_retries"]):
            if target >= len(cur.faces):
                break
            cand = _decimate(cur, target)
            r = qa(orig, cand, tol, spacing, plan["qa_samples"])
            report["steps"].append({"step": "decimate", "face_count": int(target),
                                    "faces_out": int(len(cand.faces)), **r})
            if r["pass"]:
                cur = cand
                break
            target *= 2
        else:
            report["findings"].append("decimation skipped: no face budget within tolerance")
        if len(cur.faces) > plan["max_faces"]:
            # agg=0 stops collapsing rather than break topology, so a
            # high-genus scan surface can stay above budget: say so
            report["findings"].append(f"face budget {plan['max_faces']} not reached "
                                      f"({len(cur.faces)} faces kept to preserve topology)")
    # 2) smoothing: gentlest setting that passes wins; none passing = skip
    base = cur
    for it in plan["taubin_iterations"]:
        cand = filter_taubin(base.copy(), lamb=0.5, nu=-0.53, iterations=it)
        r = qa(orig, cand, tol, spacing, plan["qa_samples"])
        report["steps"].append({"step": "taubin", "iterations": it, **r})
        if r["pass"]:
            cur = cand
            break
    else:
        report["findings"].append("smoothing skipped: no setting within tolerance")
    final = qa(orig, cur, tol, spacing, plan["qa_samples"]) if cur is not orig else \
        {"max_displacement_mm": 0.0, "volume_change_pct": 0.0,
         "watertight": bool(orig.is_watertight), "euler": int(orig.euler_number),
         "pass": True, "findings": []}
    report["final"] = {"faces": int(len(cur.faces)), **final}
    report["tolerances"] = tol
    return np.asarray(cur.vertices), np.asarray(cur.faces), report
