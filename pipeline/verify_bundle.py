#!/usr/bin/env python3
"""Task 1.6: reject a corrupt or inconsistent jas-bundle/1 folder.

    python3 -m pipeline.verify_bundle media/models/phantom

Checks, in order, so the first error is the most fundamental one:
  1. manifest.json parses and matches schemas/bundle.schema.json
  2. every asset path stays inside the bundle and exists, with the
     recorded byte size and sha256 (catches truncation and tampering)
  3. revision = hash of assets + geometry + structures (catches a
     hand-edited manifest whose assets were left alone)
  4. every "present" structure has its mesh node in model.glb, and no
     "empty" structure has one; anatomy.json passes schemas/validate.py
  5. anatomy.json `axes` agrees with the manifest frame (RAS)
Exit code 0 = valid. The browser loader (2.3) repeats the hash and node
checks client-side; this is the build-time gate.
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "schemas"))
import validate as anatomy_validate  # noqa: E402  (schemas/validate.py, stdlib-only)

from pipeline.export import RAS_AXES  # noqa: E402


def _revision(m):
    src = json.dumps({"assets": [(a["path"], a["sha256"]) for a in m["assets"]],
                      "geometry": m["geometry"], "structures": m["structures"]},
                     sort_keys=True)
    return hashlib.sha256(src.encode()).hexdigest()


def verify(bundle_dir):
    """-> list of error strings (empty = valid)."""
    d = Path(bundle_dir).resolve()
    errs = []
    try:
        m = json.loads((d / "manifest.json").read_text())
    except Exception as e:
        return [f"manifest.json: {e}"]
    try:
        import jsonschema
        schema = json.loads((HERE / "schemas" / "bundle.schema.json").read_text())
        for e in sorted(jsonschema.Draft202012Validator(schema).iter_errors(m), key=str):
            errs.append(f"schema: {'/'.join(map(str, e.path)) or '<root>'}: {e.message}")
    except ImportError:
        errs.append("jsonschema not installed (pipeline/requirements.txt)")
    if errs:
        return errs
    for a in m["assets"]:
        p = (d / a["path"]).resolve()
        if d not in p.parents:
            errs.append(f"asset {a['path']}: escapes the bundle folder")
            continue
        if not p.is_file():
            errs.append(f"asset {a['path']}: missing")
            continue
        b = p.read_bytes()
        if len(b) != a["bytes"]:
            errs.append(f"asset {a['path']}: {len(b)} bytes, manifest says {a['bytes']}")
        if hashlib.sha256(b).hexdigest() != a["sha256"]:
            errs.append(f"asset {a['path']}: sha256 mismatch")
    if _revision(m) != m["revision"]:
        errs.append("revision does not match assets/geometry/structures")
    roles = {a["role"]: a["path"] for a in m["assets"]}
    if "mesh" not in roles or "sidecar" not in roles:
        errs.append("bundle needs a mesh and a sidecar asset")
        return errs
    try:
        names = anatomy_validate.glb_mesh_node_names(
            anatomy_validate.parse_glb_json(d / roles["mesh"]))
    except Exception as e:
        return errs + [f"model: {e}"]
    for sid, s in m["structures"].items():
        if s["status"] == "present" and s["mesh_node"] not in names:
            errs.append(f"structure {sid}: mesh node {s['mesh_node']!r} not in GLB")
        if s["status"] == "empty" and sid in names:
            errs.append(f"structure {sid}: marked empty but GLB has a node for it")
    anat = json.loads((d / roles["sidecar"]).read_text())
    e1, _w, structs = anatomy_validate.validate_anatomy_shape(anat)
    errs += [f"anatomy.json: {e}" for e in e1]
    if structs:
        e2, _w2 = anatomy_validate.validate_glb_coverage(structs, d / roles["mesh"])
        errs += [f"anatomy.json vs GLB: {e}" for e in e2]
    if m["geometry"]["axes"] == "RAS" and anat.get("axes") != RAS_AXES:
        errs.append(f"anatomy.json axes {anat.get('axes')} disagree with manifest RAS frame")
    return errs


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print(__doc__.split("\n")[2].strip(), file=sys.stderr)
        return 2
    errs = verify(argv[0])
    for e in errs:
        print("ERROR", e)
    print("bundle OK" if not errs else f"{len(errs)} error(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
