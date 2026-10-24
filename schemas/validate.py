#!/usr/bin/env python3
# barehands: move things on your screen with your bare hands.
# Copyright (C) 2026 Jared Rhodenizer
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# SPDX-License-Identifier: AGPL-3.0-or-later
"""schemas/validate.py — stdlib-only validator for anatomy.json / case.json.

Usage:
  python3 schemas/validate.py <anatomy.json> [model.glb]
      Checks the anatomy.json shape (ids snake_case, layers ints,
      parent/children/teach.connects/aliases all resolve to real
      structure ids). If a GLB is given, also parses its JSON chunk
      (no external glTF library — just struct + json) and checks every
      mesh/node name is claimed by exactly one structure's `meshes`
      globs, reporting orphan meshes and structures matching zero meshes.

  python3 schemas/validate.py --case <case.json> <anatomy.json>
      Checks every lesion's `structure` exists in the given anatomy.json,
      and that review.status is "draft" or "verified".

Exits nonzero (and prints a human-readable report) on any failure.
"""
import fnmatch
import json
import re
import struct
import sys
from pathlib import Path

STRUCT_RE = re.compile(r'^[a-z0-9_]{1,64}$')
CASE_RE = re.compile(r'^[a-z0-9-]{1,64}$')


def load_json(path):
    p = Path(path)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"error: {path}: no such file")
    except json.JSONDecodeError as e:
        raise SystemExit(f"error: {path}: malformed JSON ({e})")


# ---------------------------------------------------------------------------
# anatomy.json shape validation
# ---------------------------------------------------------------------------
def validate_anatomy_shape(doc, label="anatomy"):
    errors = []
    warnings = []

    if doc.get("schema") != "barehands-anatomy/1":
        errors.append(f'{label}: schema must be "barehands-anatomy/1", '
                       f'got {doc.get("schema")!r}')
    if not isinstance(doc.get("model"), str) or not doc.get("model"):
        errors.append(f"{label}: \"model\" must be a non-empty string")

    src = doc.get("source")
    if not isinstance(src, dict):
        errors.append(f"{label}: \"source\" must be an object")
    else:
        for k in ("name", "url", "license", "modifications"):
            if k not in src:
                warnings.append(f"{label}: source.{k} is missing")

    if not isinstance(doc.get("system"), str) or not doc.get("system"):
        errors.append(f"{label}: \"system\" must be a non-empty string")

    structures = doc.get("structures")
    if not isinstance(structures, dict) or not structures:
        errors.append(f"{label}: \"structures\" must be a non-empty object")
        structures = {}

    ids = set(structures.keys())
    for sid, s in structures.items():
        if not STRUCT_RE.match(sid):
            errors.append(f"{label}: structure id {sid!r} is not snake_case "
                           f"(^[a-z0-9_]{{1,64}}$)")
        if not isinstance(s, dict):
            errors.append(f"{label}: structures.{sid} must be an object")
            continue
        if not isinstance(s.get("name"), str) or not s.get("name"):
            errors.append(f"{label}: structures.{sid}.name must be a "
                           f"non-empty string")
        meshes = s.get("meshes")
        if not isinstance(meshes, list) or not meshes or \
                not all(isinstance(m, str) and m for m in meshes):
            errors.append(f"{label}: structures.{sid}.meshes must be a "
                           f"non-empty list of non-empty strings")
        layer = s.get("layer")
        if isinstance(layer, bool) or not isinstance(layer, int) or layer < 0:
            errors.append(f"{label}: structures.{sid}.layer must be an "
                           f"int >= 0, got {layer!r}")
        parent = s.get("parent")
        if parent is not None:
            if not isinstance(parent, str) or parent not in ids:
                errors.append(f"{label}: structures.{sid}.parent "
                               f"{parent!r} does not reference a real "
                               f"structure")
        children = s.get("children", [])
        if not isinstance(children, list):
            errors.append(f"{label}: structures.{sid}.children must be a "
                           f"list")
        else:
            for c in children:
                if c not in ids:
                    errors.append(f"{label}: structures.{sid}.children "
                                   f"references unknown id {c!r}")
        teach = s.get("teach")
        if teach is not None:
            if not isinstance(teach, dict):
                errors.append(f"{label}: structures.{sid}.teach must be "
                               f"an object")
            else:
                for c in teach.get("connects", []) or []:
                    if c not in ids:
                        errors.append(f"{label}: structures.{sid}."
                                       f"teach.connects references "
                                       f"unknown id {c!r}")

    aliases = doc.get("aliases", {})
    if not isinstance(aliases, dict):
        errors.append(f"{label}: \"aliases\" must be an object")
    else:
        for a, target in aliases.items():
            if target not in ids:
                errors.append(f"{label}: alias {a!r} -> {target!r} does "
                               f"not resolve to a real structure")

    return errors, warnings, structures


# ---------------------------------------------------------------------------
# GLB parsing (no glTF library — just the container format: a 12-byte
# header, then length-prefixed chunks; we only need the JSON chunk).
# ---------------------------------------------------------------------------
def parse_glb_json(path):
    data = Path(path).read_bytes()
    if len(data) < 12 or data[0:4] != b"glTF":
        raise ValueError(f"{path}: not a GLB file (bad magic)")
    version, total_len = struct.unpack_from("<II", data, 4)
    offset = 12
    json_chunk = None
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk_data = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == b"JSON" and json_chunk is None:
            json_chunk = chunk_data
        # BIN\0 chunk (the binary buffer) is skipped — we only need names
    if json_chunk is None:
        raise ValueError(f"{path}: no JSON chunk found in GLB")
    return json.loads(json_chunk.decode("utf-8"))


def glb_mesh_node_names(gltf):
    names = set()
    for m in gltf.get("meshes", []) or []:
        n = m.get("name")
        if n:
            names.add(n)
    for nd in gltf.get("nodes", []) or []:
        if "mesh" in nd:
            n = nd.get("name")
            if n:
                names.add(n)
    return names


def validate_glb_coverage(structures, glb_path):
    errors = []
    warnings = []
    try:
        gltf = parse_glb_json(glb_path)
    except Exception as e:
        return [f"glb: {e}"], []
    names = glb_mesh_node_names(gltf)
    if not names:
        warnings.append("glb: no named meshes/nodes found — nothing to "
                         "check coverage against")
        return errors, warnings

    matched_by = {n: [] for n in names}
    struct_hits = {sid: 0 for sid in structures}
    for sid, s in structures.items():
        if not isinstance(s, dict):
            continue
        for pattern in s.get("meshes", []) or []:
            for n in names:
                if fnmatch.fnmatchcase(n, pattern):
                    matched_by[n].append(sid)
                    struct_hits[sid] += 1

    orphans = sorted(n for n, hits in matched_by.items() if not hits)
    ambiguous = {n: hits for n, hits in matched_by.items() if len(hits) > 1}
    zero_hit = sorted(sid for sid, c in struct_hits.items() if c == 0)

    if orphans:
        errors.append("glb: orphan meshes matched by no structure: "
                       + ", ".join(orphans))
    if ambiguous:
        for n, hits in sorted(ambiguous.items()):
            errors.append(f"glb: mesh {n!r} matched by >1 structure: "
                           + ", ".join(hits))
    if zero_hit:
        errors.append("glb: structures matching zero meshes: "
                       + ", ".join(zero_hit))
    return errors, warnings


# ---------------------------------------------------------------------------
# case.json validation
# ---------------------------------------------------------------------------
def validate_case(case_doc, anatomy_structures):
    errors = []
    warnings = []

    if case_doc.get("schema") != "barehands-case/1":
        errors.append(f'case: schema must be "barehands-case/1", got '
                       f'{case_doc.get("schema")!r}')
    cid = case_doc.get("id")
    if not isinstance(cid, str) or not CASE_RE.match(cid):
        errors.append(f"case: \"id\" {cid!r} must match ^[a-z0-9-]"
                       f"{{1,64}}$")

    lesions = case_doc.get("lesions", [])
    if not isinstance(lesions, list):
        errors.append("case: \"lesions\" must be a list")
        lesions = []
    for l in lesions:
        if not isinstance(l, dict):
            errors.append(f"case: lesion entry {l!r} must be an object")
            continue
        lid = l.get("id")
        if not isinstance(lid, str) or not STRUCT_RE.match(lid):
            errors.append(f"case: lesion id {lid!r} must match "
                           f"^[a-z0-9_]{{1,64}}$")
        struct_id = l.get("structure")
        if struct_id not in anatomy_structures:
            errors.append(f"case: lesion {lid!r} references structure "
                           f"{struct_id!r}, not found in the anatomy file")
        render = l.get("render")
        if not isinstance(render, dict) or render.get("kind") not in \
                ("tint", "decal", "variant"):
            errors.append(f"case: lesion {lid!r}.render.kind must be one "
                           f"of tint/decal/variant")

    review = case_doc.get("review")
    if not isinstance(review, dict) or review.get("status") not in \
            ("draft", "verified"):
        errors.append("case: review.status must be \"draft\" or "
                       "\"verified\"")

    diagnosis = case_doc.get("diagnosis")
    if not isinstance(diagnosis, dict) or not diagnosis.get("correct"):
        errors.append("case: diagnosis.correct is required")

    return errors, warnings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def report(errors, warnings, ok_label):
    for w in warnings:
        print(f"  warning: {w}")
    for e in errors:
        print(f"  ERROR: {e}")
    if errors:
        print(f"FAIL — {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"OK — {ok_label} ({len(warnings)} warning(s))")
    return 0


def main(argv):
    if argv[:1] == ["--case"]:
        if len(argv) != 3:
            print(__doc__)
            return 2
        case_path, anatomy_path = argv[1], argv[2]
        anatomy_doc = load_json(anatomy_path)
        a_errors, a_warnings, structures = validate_anatomy_shape(
            anatomy_doc, label=Path(anatomy_path).name)
        case_doc = load_json(case_path)
        c_errors, c_warnings = validate_case(case_doc, structures)
        print(f"validating {case_path} against {anatomy_path}")
        return report(a_errors + c_errors, a_warnings + c_warnings,
                      f"{case_path} is valid")

    if not argv:
        print(__doc__)
        return 2
    anatomy_path = argv[0]
    glb_path = argv[1] if len(argv) > 1 else None

    anatomy_doc = load_json(anatomy_path)
    errors, warnings, structures = validate_anatomy_shape(
        anatomy_doc, label=Path(anatomy_path).name)
    print(f"validating {anatomy_path}" +
          (f" against {glb_path}" if glb_path else ""))

    if glb_path:
        g_errors, g_warnings = validate_glb_coverage(structures, glb_path)
        errors += g_errors
        warnings += g_warnings

    return report(errors, warnings, f"{anatomy_path} is valid")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
