"""Task 1.6: write a jas-bundle/1 folder (ADR 0002).

    <out>/model.glb        optimized meshes, one node per structure id
    <out>/model.orig.glb   the un-optimized 1.4 meshes (1.5 keeps the original)
    <out>/volume.nrrd      optional intensities on the source grid
    <out>/anatomy.json     barehands-anatomy/1 sidecar, so the existing board loads it
    <out>/manifest.json    geometry, hashes, provenance, QA

GLB vertices stay in RAS+ millimetres. glTF's metre/+Y-up convention is
deliberately NOT applied (D-P2-05). The axis meaning is declared instead,
in anatomy.json `axes` for the existing cut presets and in the manifest
for 2.4's mm-preserving view transform. One frame, stated in two places,
and verify_bundle checks that the two statements agree.
"""
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

SCHEMA = "jas-bundle/1"
RAS_AXES = {"superior": "+z", "left": "-x", "anterior": "+y"}   # RAS+: +x = patient right

# display names + colors for the structure ids the label maps emit.
# Names are plain anatomical labels, not teaching content (that is 1.8's
# sourced sidecar work); unknown ids fall back to a title-cased id.
STYLE = {
    "liver": ("Liver", (0.62, 0.30, 0.24, 1.0)),
    "liver_tumor": ("Liver tumor", (0.93, 0.80, 0.35, 1.0)),
    "hepatic_vessel": ("Hepatic vessels", (0.30, 0.45, 0.85, 1.0)),
    "portal_vein": ("Portal vein", (0.35, 0.40, 0.90, 1.0)),
    "vena_cava": ("Inferior vena cava", (0.25, 0.35, 0.80, 1.0)),
    "hepatic_artery": ("Hepatic artery", (0.85, 0.25, 0.25, 1.0)),
}
# IRCADb ids are numbered or named differently (liver_tumor_03, venous_system, artery):
# style by family so every tumour reads as a tumour and every vein as a vein
STYLE_FAMILY = [
    (("liver_tumor", "metastasectomy"), ("Liver tumor", (0.93, 0.80, 0.35, 1.0))),
    (("liver_cyst",), ("Liver cyst", (0.70, 0.85, 0.95, 1.0))),
    (("artery",), ("Artery", (0.85, 0.25, 0.25, 1.0))),
    (("venous_system", "vena_cava", "hepatic_vein"), ("Veins", (0.25, 0.35, 0.80, 1.0))),
    (("biliary",), ("Biliary system", (0.40, 0.70, 0.35, 1.0))),
]


def style(sid):
    """-> (display name, rgba). Exact entry first, then family, then neutral."""
    if sid in STYLE:
        return STYLE[sid]
    for prefixes, (name, rgba) in STYLE_FAMILY:
        if sid.startswith(prefixes):
            suffix = sid.rsplit("_", 1)[-1]
            return (f"{name} {int(suffix)}" if suffix.isdigit() else sid.replace("_", " ").capitalize(), rgba)
    return (sid.replace("_", " ").capitalize(), (0.75, 0.75, 0.75, 1.0))


PARENT = "liver"   # tumors/vessels nest under the liver when it exists


def _sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def _tool_versions():
    import nrrd, skimage, trimesh
    return {"python": platform.python_version(), "numpy": np.__version__,
            "scikit-image": skimage.__version__, "trimesh": trimesh.__version__,
            "pynrrd": getattr(nrrd, "__version__", "unknown")}


def _glb(meshes):
    """meshes: [(structure_id, vertices, faces)] -> GLB bytes."""
    import trimesh
    from trimesh.visual.material import PBRMaterial
    from trimesh.visual import TextureVisuals
    scene = trimesh.Scene()
    for sid, v, f in meshes:
        m = trimesh.Trimesh(vertices=v, faces=f, process=False)
        color = style(sid)[1]
        m.visual = TextureVisuals(material=PBRMaterial(
            name=sid, baseColorFactor=[int(c * 255) for c in color],
            metallicFactor=0.0, roughnessFactor=0.6, doubleSided=True))
        scene.add_geometry(m, node_name=sid, geom_name=sid)
    return scene.export(file_type="glb")


def _nrrd(path, image, affine):
    import nrrd
    A = np.asarray(affine, float)
    hdr = {"space": "right-anterior-superior",
           # pynrrd: row i is the world-space vector of array axis i
           "space directions": A[:3, :3].T, "space origin": A[:3, 3],
           "kinds": ["domain"] * 3, "encoding": "gzip"}
    arr = image.astype(np.int16) if np.allclose(image, np.round(image)) else image.astype(np.float32)
    nrrd.write(str(path), arr, hdr)
    # pynrrd stamps "# on <wall clock>" into the header; drop it so a
    # rebuild is byte-identical and the bundle revision stays stable
    b = Path(path).read_bytes()
    end = b.find(b"\n\n")
    head = b"\n".join(l for l in b[:end].split(b"\n") if not l.startswith(b"# on "))
    Path(path).write_bytes(head + b[end:])


def anatomy_sidecar(present_ids, source):
    has_parent = PARENT in present_ids
    structures = {}
    for sid in present_ids:
        parent = PARENT if has_parent and sid != PARENT else None
        structures[sid] = {
            "name": style(sid)[0],
            "meshes": [sid], "parent": parent,
            "children": [c for c in present_ids if has_parent and sid == PARENT and c != PARENT],
            "layer": 0 if parent is None else 1,
        }
    return {"schema": "barehands-anatomy/1", "model": "model.glb", "source": source,
            "system": "hepatobiliary", "axes": dict(RAS_AXES),
            "structures": structures, "aliases": {}}


def write_bundle(out, ci, surfaces, optimized, reports, *, source, dataset_license,
                 citation, segmentation, pipeline_config, with_volume=False,
                 created=None):
    """surfaces: 1.4 Surface list; optimized: {sid: (v, f)}; reports: {sid: 1.5 report}."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    present = [s for s in surfaces if s.status == "present"]
    ids = [s.structure_id for s in present]
    files = {
        "model.glb": _glb([(s.structure_id, *optimized[s.structure_id]) for s in present]),
        "model.orig.glb": _glb([(s.structure_id, s.vertices, s.faces) for s in present]),
    }
    files["anatomy.json"] = (json.dumps(anatomy_sidecar(ids, source), indent=2) + "\n").encode()
    for name, b in files.items():
        (out / name).write_bytes(b)
    roles = {"model.glb": ("mesh", "model/gltf-binary"),
             "model.orig.glb": ("mesh_original", "model/gltf-binary"),
             "anatomy.json": ("sidecar", "application/json")}
    if with_volume and ci.image is not None:
        _nrrd(out / "volume.nrrd", ci.image, ci.affine)
        roles["volume.nrrd"] = ("volume", "application/octet-stream")
    assets = []
    for name, (role, mt) in roles.items():
        b = (out / name).read_bytes()
        assets.append({"path": name, "role": role, "media_type": mt,
                       "bytes": len(b), "sha256": _sha256_bytes(b)})
    allv = np.concatenate([optimized[s.structure_id][0] for s in present]) if present else np.zeros((1, 3))
    geometry = {
        "units": "mm", "axes": "RAS", "shape": list(ci.labels.shape),
        "spacing": [round(x, 6) for x in ci.spacing],
        "voxel_to_world": np.round(ci.affine, 6).tolist(),
        "world_to_model": np.eye(4).tolist(),
        "bounds_mm": {"min": np.round(allv.min(0), 3).tolist(),
                      "max": np.round(allv.max(0), 3).tolist()},
    }
    structures = {s.structure_id: {
        "label_value": s.label_value,
        "mesh_node": s.structure_id if s.status == "present" else None,
        "voxels": s.voxels, "volume_ml": round(s.volume_ml, 3), "status": s.status,
    } for s in surfaces}
    validation = {sid: {k: r.get("final", {}).get(k) for k in
                        ("faces", "max_displacement_mm", "volume_change_pct", "watertight", "pass")}
                  | {"findings": r.get("findings", []) + r.get("final", {}).get("findings", [])}
                  for sid, r in reports.items()}
    findings = [{"level": "warning", "structure": s.structure_id,
                 "message": "label has no voxels in this case; reported, not generated"}
                for s in surfaces if s.status == "empty"]
    # revision = content identity: assets + geometry + structure table.
    # `created` is excluded so a byte-identical rebuild keeps its revision.
    rev_src = json.dumps({"assets": [(a["path"], a["sha256"]) for a in assets],
                          "geometry": geometry, "structures": structures}, sort_keys=True)
    revision = _sha256_bytes(rev_src.encode())
    manifest = {
        "schema": SCHEMA,
        "bundle_id": f"{ci.source_case.replace(':', '-')}-{revision[:12]}",
        "revision": revision,
        "source_case": ci.source_case,
        "geometry": geometry,
        "assets": assets,
        "structures": structures,
        "provenance": {
            "dataset": ci.provenance.get("dataset", "synthetic"),
            "license": dataset_license, "citation": citation,
            "loader": ci.provenance.get("loader"),
            "input_hashes": {k: v for k, v in ci.provenance.items() if k.endswith("sha256") and v},
            # 1.1/1.2/1.3 evidence travels with the bundle (counts only; never PHI values)
            **{k: ci.provenance[k] for k in ("geometry_audit", "deid_report", "masks", "affine_policy", "surfaces_from",
                                            "resampling", "source_archives_sha256")
               if k in ci.provenance},
            "tool_versions": _tool_versions(),
            "pipeline_config": pipeline_config,
            "segmentation": segmentation,
            "created": created or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "validation": {"structures": validation, "findings": findings},
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest
