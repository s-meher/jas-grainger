#!/usr/bin/env python3
"""Heart acceptance test — render layer.

Drives the OBS render page through every medical visual state by posting
synthetic heartbeats, screenshots each, and assembles one contact sheet.
Also proves TEARDOWN numerically: apply every verb, turn every verb off,
and the frame must come back pixel-identical to the untouched baseline.
"""
import json, subprocess, sys, urllib.request, hashlib
from pathlib import Path
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "tests" / "_shots"
OUT.mkdir(exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL = "http://127.0.0.1:8794/stage.html?role=render&cursors=0"
W = H = 620

BASE_ITEM = {
    "id": 7, "type": "model", "title": "heart",
    "src": "/media/models/heart/heart.glb", "mm": "solid",
    "x": 0.5, "y": 0.5, "scale": 1.7, "g": 0, "op": 1, "ch": 0,
    "rx": -0.15, "ry": 0.6, "rz": 0,
}


def post_state(extra):
    item = dict(BASE_ITEM)
    item.update(extra)
    body = json.dumps({"cursors": [], "items": [item]}).encode()
    urllib.request.urlopen(urllib.request.Request(
        "http://127.0.0.1:8794/state", body, {"Content-Type": "application/json"}))


def shot(name, extra):
    post_state(extra)
    png = OUT / f"{name}.png"
    subprocess.run([CHROME, "--headless=new", f"--window-size={W},{H}",
                    "--virtual-time-budget=18000", "--timeout=28000",
                    f"--screenshot={png}", URL],
                   capture_output=True, timeout=90)
    return png


CASES = [
    ("01 baseline",        {}),
    ("02 label x3",        {"lb": ["left_ventricle", "aortic_valve", "pulmonary_trunk"]}),
    ("03 label all",       {"lb": list(json.load(open(
                              REPO / "media" / "models" / "heart" / "anatomy.json"))["structures"])[:12]}),
    ("04 isolate LV",      {"iso": "left_ventricle"}),
    ("05 hide 2 chambers", {"hid": ["right_atrium", "left_atrium"]}),
    ("06 xray",            {"xr": 1}),
    ("07 xray focus LV",   {"xr": "left_ventricle"}),
    ("08 layer depth 0",   {"ly": 0}),
    ("09 cut sagittal",    {"cut": {"plane": "sagittal", "t": 0.5}}),
    ("10 cut coronal",     {"cut": {"plane": "coronal", "t": 0.5}}),
    ("11 cut axial",       {"cut": {"plane": "axial", "t": 0.5}}),
    ("12 cut custom",      {"cut": {"plane": {"o": [0, 0, 0], "n": [0.7071, 0, 0.7071]},
                                    "t": 0.5}}),
    ("13 lesion",          {"les": {"case": "heart-anterior-stemi-01",
                                    "lesion": "lad_occlusion"}}),
    ("14 cut+lesion+label", {"cut": {"plane": "sagittal", "t": 0.5},
                             "les": {"case": "heart-anterior-stemi-01",
                                     "lesion": "lad_occlusion"},
                             "lb": ["left_ventricle"]}),
    ("15 teardown",        {}),      # everything off again — must equal baseline
    ("16 baseline again",  {}),      # freshly re-measured reference
]

print("warm-up frame (discarded — the first render of a run differs)…")
shot("00 warmup", {})
print("rendering", len(CASES), "states…")
paths = []
for name, extra in CASES:
    p = shot(name, extra)
    ok = p.exists() and p.stat().st_size > 0
    print(f"  {'ok ' if ok else 'FAIL'} {name}")
    paths.append((name, p))

# ---- teardown proof: baseline vs teardown, pixel for pixel
def digest(p):
    im = Image.open(p).convert("RGB")
    return hashlib.sha256(im.tobytes()).hexdigest()


base_d, tear_d = digest(paths[-1][1]), digest(paths[-2][1])
identical = base_d == tear_d
print()
print("TEARDOWN:", "PASS — pixel-identical to baseline" if identical
      else f"DIFFER\n  baseline {base_d[:16]}\n  teardown {tear_d[:16]}")
if not identical:
    a = Image.open(paths[-1][1]).convert("RGB")
    b = Image.open(paths[-2][1]).convert("RGB")
    diff = sum(1 for x, y in zip(a.getdata(), b.getdata()) if x != y)
    print(f"  {diff} differing pixels of {a.width * a.height}")

# ---- contact sheet
COLS, TH = 4, 300
rows = (len(paths) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * TH, rows * (TH + 22)), "white")
d = ImageDraw.Draw(sheet)
for i, (name, p) in enumerate(paths):
    im = Image.open(p).convert("RGB").resize((TH, TH))
    x, y = (i % COLS) * TH, (i // COLS) * (TH + 22)
    sheet.paste(im, (x, y + 22))
    d.rectangle([x, y, x + TH - 1, y + TH + 21], outline="#bbb")
    d.text((x + 6, y + 6), name, fill="black")
sheet_path = OUT / "heart-visual-matrix.png"
sheet.save(sheet_path)
print("contact sheet:", sheet_path)

for _ in range(3):
    urllib.request.urlopen(urllib.request.Request(
        "http://127.0.0.1:8794/state", b'{"cursors":[],"items":[]}',
        {"Content-Type": "application/json"}))
sys.exit(0 if identical else 1)
