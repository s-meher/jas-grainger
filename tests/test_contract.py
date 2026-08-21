#!/usr/bin/env python3
"""Heart acceptance test — contract layer.

Exercises every medical verb's valid and invalid argument classes against the
live server, the airlock, the answer-stripping endpoint, the sidecar
validator, and board-state.sh's rendering. Pure pass/fail, no eyeballs.
"""
import json, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

REPO = str(Path(__file__).resolve().parent.parent)
BASE = "http://127.0.0.1:8794"
results = []


def post(path, payload):
    req = urllib.request.Request(BASE + path, json.dumps(payload).encode(),
                                 {"Content-Type": "application/json"})
    try:
        return urllib.request.urlopen(req).status
    except urllib.error.HTTPError as e:
        return e.code


def get(path):
    try:
        r = urllib.request.urlopen(BASE + path)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""


def check(name, got, want):
    ok = got == want
    results.append((ok, name, f"got {got}, want {want}"))
    return ok


print("=" * 72)
print("A. VERB CONTRACT — valid forms must queue (204)")
print("=" * 72)
VALID = [
    ("cut preset",        {"a": "cut", "plane": "sagittal", "t": 0.5}),
    ("cut coronal",       {"a": "cut", "plane": "coronal", "t": 0.3}),
    ("cut axial",         {"a": "cut", "plane": "axial", "t": 0.7}),
    ("cut custom plane",  {"a": "cut", "plane": {"o": [0, 0, 0], "n": [0, 0, 2]}}),
    ("cut arm on",        {"a": "cut", "arm": 1}),
    ("cut arm off",       {"a": "cut", "arm": 0}),
    ("cut off",           {"a": "cut", "off": 1}),
    ("isolate",           {"a": "isolate", "structure": "left_ventricle"}),
    ("isolate off",       {"a": "isolate", "off": 1}),
    ("hide",              {"a": "hide", "structure": "right_atrium"}),
    ("hide off",          {"a": "hide", "off": 1}),
    ("label list",        {"a": "label", "structures": ["aortic_valve", "mitral_valve"]}),
    ("label all",         {"a": "label", "structures": "all"}),
    ("label off",         {"a": "label", "off": 1}),
    ("xray bare",         {"a": "xray"}),
    ("xray focus",        {"a": "xray", "focus": "left_ventricle"}),
    ("xray off",          {"a": "xray", "off": 1}),
    ("layer depth",       {"a": "layer", "depth": 1}),
    ("layer off",         {"a": "layer", "off": 1}),
    ("lesion",            {"a": "lesion", "case": "heart-anterior-stemi-01",
                           "lesion": "lad_occlusion"}),
    ("lesion off",        {"a": "lesion", "off": 1}),
    ("verb + title",      {"a": "isolate", "structure": "aorta_x", "title": "heart"}),
]
for name, payload in VALID:
    check(f"valid: {name}", post("/cmd", payload), 204)

print()
print("=" * 72)
print("B. VERB CONTRACT — malformed forms must be rejected (400)")
print("=" * 72)
INVALID = [
    ("cut with no args",       {"a": "cut"}),
    ("cut bad preset",         {"a": "cut", "plane": "diagonal"}),
    ("cut zero normal",        {"a": "cut", "plane": {"o": [0, 0, 0], "n": [0, 0, 0]}}),
    ("cut origin out of range", {"a": "cut", "plane": {"o": [5, 0, 0], "n": [0, 0, 1]}}),
    ("cut non-numeric t",      {"a": "cut", "plane": "axial", "t": "half"}),
    ("cut bad arm value",      {"a": "cut", "arm": 7}),
    ("isolate missing arg",    {"a": "isolate"}),
    ("isolate bad id case",    {"a": "isolate", "structure": "Left_Ventricle"}),
    ("isolate id punctuation", {"a": "isolate", "structure": "left-ventricle!"}),
    ("isolate id too long",    {"a": "isolate", "structure": "x" * 65}),
    ("hide missing arg",       {"a": "hide"}),
    ("label empty list",       {"a": "label", "structures": []}),
    ("label over cap (13)",    {"a": "label", "structures": [f"s{i}" for i in range(13)]}),
    ("label bad literal",      {"a": "label", "structures": "everything"}),
    ("xray bad focus id",      {"a": "xray", "focus": "Left Ventricle"}),
    ("layer missing depth",    {"a": "layer"}),
    ("layer negative",         {"a": "layer", "depth": -1}),
    ("layer too deep",         {"a": "layer", "depth": 9}),
    ("layer non-numeric",      {"a": "layer", "depth": "deep"}),
    ("lesion missing lesion",  {"a": "lesion", "case": "heart-anterior-stemi-01"}),
    ("lesion bad case id",     {"a": "lesion", "case": "../secrets", "lesion": "x"}),
    ("oversized title",        {"a": "xray", "title": "t" * 201}),
    ("off must be 1",          {"a": "xray", "off": 2}),
    ("unknown verb",           {"a": "dissect"}),
]
for name, payload in INVALID:
    check(f"reject: {name}", post("/cmd", payload), 400)

print()
print("=" * 72)
print("C. THE AIRLOCK — must not widen")
print("=" * 72)
check("airlock: parent escape", post("/cmd", {"a": "add_img", "src": "../server.py"}), 400)
check("airlock: abs path", post("/cmd", {"a": "add_img", "src": "/etc/passwd"}), 400)
check("airlock: deep escape",
      post("/cmd", {"a": "hand", "src": "../../../../etc/hosts"}), 400)
check("airlock: real model ok",
      post("/cmd", {"a": "hand", "src": "models/heart/heart.glb"}), 204)
# a bare organ basename is AMBIGUOUS by design — every organ exists twice,
# in models/ and in holo/ — so the self-heal must refuse rather than guess
check("airlock: ambiguous organ basename refused",
      post("/cmd", {"a": "hand", "src": "heart.glb"}), 400)
check("airlock: holo subpath ok",
      post("/cmd", {"a": "hand", "src": "holo/heart/heart.glb"}), 204)
check("airlock: unique basename still heals",
      post("/cmd", {"a": "add_img", "src": "glass-hands.png"}), 204)

print()
print("=" * 72)
print("D. ANSWER ISOLATION — /case-render must never carry the answer")
print("=" * 72)
code, body = get("/case-render?id=heart-anterior-stemi-01")
check("case-render: serves", code, 200)
case = json.loads(open(f"{REPO}/cases/heart-anterior-stemi-01.json").read())
low = body.lower()
for field in ("vignette", "diagnosis", "grading_rubric", "teaching", "review"):
    check(f"case-render: no '{field}' key", field in json.loads(body), False)
# and no answer CONTENT, not merely no field names
leaks = []
for phrase in [case["diagnosis"]["correct"].lower()] + \
              [a.lower() for a in case["diagnosis"]["accept"]] + \
              [case["vignette"].lower()[:40]] + \
              [l.get("finding", "").lower()[:40] for l in case["lesions"]]:
    if phrase and phrase in low:
        leaks.append(phrase[:40])
check("case-render: no answer text anywhere", leaks, [])
check("case-render: bad id 404s", get("/case-render?id=nope")[0], 404)
check("case-render: traversal 404s", get("/case-render?id=../cases/x")[0], 404)

print()
print("=" * 72)
print("E. SIDECAR — schema + full mesh coverage")
print("=" * 72)
r = subprocess.run([sys.executable, f"{REPO}/schemas/validate.py",
                    f"{REPO}/media/models/heart/anatomy.json",
                    f"{REPO}/media/models/heart/heart.glb"],
                   capture_output=True, text=True)
check("validate.py anatomy+glb exit 0", r.returncode, 0)
r2 = subprocess.run([sys.executable, f"{REPO}/schemas/validate.py", "--case",
                     f"{REPO}/cases/heart-anterior-stemi-01.json",
                     f"{REPO}/media/models/heart/anatomy.json"],
                    capture_output=True, text=True)
check("validate.py case exit 0", r2.returncode, 0)

an = json.loads(open(f"{REPO}/media/models/heart/anatomy.json").read())
check("sidecar: 16 structures", len(an["structures"]), 16)
check("sidecar: axes measured", "axes" in an, True)
# every teach.connects / parent / child / alias target must exist
ids = set(an["structures"])
dangling = []
for sid, s in an["structures"].items():
    for ref in (s.get("children") or []) + ([s["parent"]] if s.get("parent") else []) \
               + ((s.get("teach") or {}).get("connects") or []):
        if ref not in ids:
            dangling.append(f"{sid}->{ref}")
check("sidecar: no dangling refs", dangling, [])
check("sidecar: aliases all resolve",
      [a for a, t in an.get("aliases", {}).items() if t not in ids], [])
check("sidecar: every structure teaches",
      [s for s, v in an["structures"].items() if not (v.get("teach") or {}).get("function")], [])
check("sidecar: every structure cites",
      [s for s, v in an["structures"].items() if not (v.get("teach") or {}).get("sources")], [])
check("case: review verified", case["review"]["status"], "verified")

print()
print("=" * 72)
print("F. BOARD-STATE — the agent's eyes report medical state truthfully")
print("=" * 72)
state = {"cursors": [], "items": [{
    "id": 1, "type": "model", "title": "heart",
    "src": "/media/models/heart/heart.glb", "mm": "solid",
    "x": 0.5, "y": 0.5, "scale": 1.0, "g": 0, "op": 1, "ch": 0,
    "cut": {"plane": "coronal", "t": 0.4}, "iso": "left_ventricle",
    "hid": ["right_atrium", "left_atrium"], "lb": ["aortic_valve"]}],
    "pt": {"model": "heart.glb", "structure": "mitral_valve", "mesh": "mitral_valve-Mesh"}}
post("/state", state)
out = subprocess.run([f"{REPO}/bin/board-state.sh"], capture_output=True, text=True).stdout
for frag in ("CUT coronal 40%", "ISOLATED: left_ventricle", "hidden: [2 ids]",
             "aortic_valve", "POINTING AT: mitral_valve"):
    check(f"board-state reports {frag!r}", frag in out, True)

# and it must stay byte-identical for a plain, non-medical item
plain = {"cursors": [], "items": [{"id": 2, "type": "model", "title": "heart",
         "src": "/media/models/heart/heart.glb", "mm": "solid",
         "x": 0.5, "y": 0.5, "scale": 1, "g": 0, "op": 1, "ch": 0}]}
post("/state", plain)
out2 = subprocess.run([f"{REPO}/bin/board-state.sh"], capture_output=True, text=True).stdout
check("board-state: no medical noise when absent",
      ("CUT" in out2 or "ISOLATED" in out2 or "POINTING" in out2), False)

# drain
for _ in range(3):
    post("/state", {"cursors": [], "items": []})

print()
print("=" * 72)
failed = [r for r in results if not r[0]]
for ok, name, detail in results:
    if not ok:
        print(f"  FAIL  {name}  ({detail})")
print(f"{len(results) - len(failed)}/{len(results)} passed")
print("=" * 72)
sys.exit(1 if failed else 0)
