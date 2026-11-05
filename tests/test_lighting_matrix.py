#!/usr/bin/env python3
"""Task 2.2: lighting reference matrix (models x medical states) + a contact sheet.

    python3 server.py &
    python3 tests/test_lighting_matrix.py

Renders through the real render page, like tests/test_visual.py. Models:
the generic heart and the synthetic phantom always, plus any locally built
scan bundles found under media/local/ (never committed). States: solid,
sagittal cut, isolate, x-ray with a focus structure.

Per image it prints objective numbers, so "too dark / blown out" is
measurable:
  cover %   model pixels / frame
  L mean    mean luminance of model pixels (0-255)
  clip %    model pixels with L > 250 (highlights blown)
  crush %   model pixels with L < 20  (detail lost in shadow)
Output: tests/_shots/lighting/ (git-ignored). Screenshots of scan bundles
stay local: they are scan-derived. A human reviews the sheet (plan 2.2).
Exit 1 only if a render is missing/blank; the numbers are for review.
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _cdp import chrome_path  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "tests" / "_shots" / "lighting"
OUT.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:8794/stage.html?role=render&cursors=0"
W = H = 620

MODELS = [("heart", "/media/models/heart/heart.glb", "left_ventricle", "left_ventricle"),
          ("phantom", "/media/models/phantom/model.glb", "liver", "liver_tumor")]
for name, iso, focus in (("ircadb_13", "liver", "liver_tumor_01"), ("ircadb_8", "liver", "liver_tumor_02"),
                         ("liver_39", "liver", "liver_tumor")):
    if (REPO / "media" / "local" / name / "model.glb").is_file():
        MODELS.append((name, f"/media/local/{name}/model.glb", iso, focus))
STATES = [("solid", lambda iso, f: {}),
          ("cut", lambda iso, f: {"cut": {"plane": "sagittal", "t": 0.5}}),
          ("isolate", lambda iso, f: {"iso": iso}),
          ("xray", lambda iso, f: {"xr": f})]


def post(item):
    urllib.request.urlopen(urllib.request.Request(
        "http://127.0.0.1:8794/state", json.dumps({"cursors": [], "items": [item]}).encode(),
        {"Content-Type": "application/json"}))


def shot(path, item):
    post(item)
    subprocess.run([chrome_path(), "--headless=new", f"--window-size={W},{H}", "--virtual-time-budget=25000",
                    "--timeout=35000", f"--screenshot={path}", URL], capture_output=True, timeout=120)


def metrics(p):
    im = Image.open(p).convert("RGB")
    px = list(im.getdata())
    bg = px[0]
    model = [c for c in px if max(abs(c[i] - bg[i]) for i in range(3)) > 12]
    if not model:
        return {"cover_pct": 0.0}
    L = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in model]
    return {"cover_pct": round(100 * len(model) / len(px), 1), "L_mean": round(sum(L) / len(L), 1),
            "clip_pct": round(100 * sum(1 for v in L if v > 250) / len(L), 2),
            "crush_pct": round(100 * sum(1 for v in L if v < 20) / len(L), 2)}


base = {"id": 7, "type": "model", "title": "m", "mm": "solid", "x": 0.5, "y": 0.5, "scale": 1.7,
        "g": 0, "op": 1, "ch": 0, "rx": -0.15, "ry": 0.6, "rz": 0}
shot(OUT / "00_warmup.png", {**base, "src": MODELS[0][1]})
rows, bad, report = [], 0, {}
for name, src, iso, focus in MODELS:
    row = []
    for st, fn in STATES:
        p = OUT / f"{name}__{st}.png"
        shot(p, {**base, "src": src, **fn(iso, focus)})
        m = metrics(p) if p.exists() else {"cover_pct": 0.0}
        report[f"{name}/{st}"] = m
        if m["cover_pct"] < 1:
            bad += 1
        print(f"  {name:10s} {st:8s} {m}")
        row.append(p)
    rows.append((name, row))
TH = 260
sheet = Image.new("RGB", (len(STATES) * TH + 110, len(rows) * TH + 24), "white")
d = ImageDraw.Draw(sheet)
for j, (st, _) in enumerate(STATES):
    d.text((110 + j * TH + 8, 6), st, fill="black")
for i, (name, row) in enumerate(rows):
    d.text((6, 24 + i * TH + TH // 2), name, fill="black")
    for j, p in enumerate(row):
        if p.exists():
            sheet.paste(Image.open(p).convert("RGB").resize((TH, TH)), (110 + j * TH, 24 + i * TH))
sheet.save(OUT / "lighting-matrix.png")
(OUT / "metrics.json").write_text(json.dumps(report, indent=2))
for _ in range(3):
    urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8794/state", b'{"cursors":[],"items":[]}',
                                                  {"Content-Type": "application/json"}))
print("contact sheet:", OUT / "lighting-matrix.png")
print(f"{len(report) - bad}/{len(report)} renders non-blank")
sys.exit(1 if bad else 0)
