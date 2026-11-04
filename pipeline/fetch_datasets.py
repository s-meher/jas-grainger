#!/usr/bin/env python3
"""Check the shared NOVA-data folder against datasets/manifest.csv.

Read-only and stdlib-only: it never copies scans into the repo (they are
not allowed in this public repository — see datasets/README.md). It
answers one question before any pipeline run: "is every case I am about
to use actually there, with the files the pipeline expects?"

    export JAS_DATA_ROOT=".../My Drive/NOVA-data"
    python3 pipeline/fetch_datasets.py                 # every case
    python3 pipeline/fetch_datasets.py --case liver_39 # just these
    python3 pipeline/fetch_datasets.py --hash --case liver_39

--hash prints sha256 per file so a run record can cite exactly which bytes
it used. It reads whole files: on a streamed Drive mount that downloads
them, so ask for it per case, not for the whole set.

Exit code 0 = all requested cases complete; 1 = something missing.
"""
import argparse
import csv
import hashlib
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MANIFEST = HERE / "datasets" / "manifest.csv"

# the files each dataset's case folder must hold (per the Drive README).
# IRCADb's preview jpg is named after the patient number, so it is not
# required — only the four zips the pipeline can read.
EXPECTED = {
    "ircadb": ("PATIENT_DICOM.zip", "MASKS_DICOM.zip",
               "LABELLED_DICOM.zip", "MESHES_VTK.zip"),
    "msd-liver": ("image.nii.gz", "label.nii.gz"),
    "msd-hepaticvessel": ("image.nii.gz", "label.nii.gz"),
}


def load_manifest(path=MANIFEST):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def sha256(p, chunk=1 << 20):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def check_case(root, row, want_hash=False):
    """-> (ok, lines). Size comes from stat, which a streamed Drive mount
    answers without downloading the file."""
    ds, case = row["dataset"], row["case"]
    folder = root / ds / case
    lines, ok = [], True
    if ds not in EXPECTED:
        return False, [f"  ? unknown dataset {ds!r} in manifest"]
    if not folder.is_dir():
        return False, [f"  MISSING folder {folder.relative_to(root)}"]
    for name in EXPECTED[ds]:
        p = folder / name
        if not p.is_file() or p.stat().st_size == 0:
            ok = False
            lines.append(f"  MISSING {ds}/{case}/{name}")
            continue
        extra = f"  sha256={sha256(p)}" if want_hash else ""
        lines.append(f"  ok {ds}/{case}/{name}  {p.stat().st_size} B{extra}")
    return ok, lines


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=os.environ.get("JAS_DATA_ROOT"),
                    help="NOVA-data folder (default: $JAS_DATA_ROOT)")
    ap.add_argument("--case", action="append", default=[],
                    help="limit to these case ids (repeatable)")
    ap.add_argument("--hash", action="store_true",
                    help="also print sha256 (reads whole files)")
    ap.add_argument("--manifest", default=str(MANIFEST))
    a = ap.parse_args(argv)
    if not a.root:
        print("set JAS_DATA_ROOT or pass --root (see datasets/README.md)",
              file=sys.stderr)
        return 2
    root = Path(a.root).expanduser()
    if not root.is_dir():
        print(f"data root not found: {root}", file=sys.stderr)
        return 2
    rows = load_manifest(a.manifest)
    if a.case:
        known = {r["case"] for r in rows}
        unknown = [c for c in a.case if c not in known]
        if unknown:
            print(f"not in manifest: {', '.join(unknown)}", file=sys.stderr)
            return 2
        rows = [r for r in rows if r["case"] in a.case]
    bad = 0
    for r in rows:
        ok, lines = check_case(root, r, a.hash)
        print(f"{'OK  ' if ok else 'FAIL'} {r['case']} ({r['dataset']}, "
              f"spacing {r['spacing_mm']} mm)")
        print("\n".join(lines))
        bad += not ok
    print(f"\n{len(rows) - bad}/{len(rows)} cases complete")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
