"""Task 1.1: a 3D-IRCADb-01 patient folder -> one labeled CanonicalImage.

Per patient (datasets/README.md):
    PATIENT_DICOM.zip  the CT, one file per slice (names sort wrongly)
    MASKS_DICOM.zip    MASKS_DICOM/<structure>/image_N: one series per structure
    MESHES_VTK.zip     IRCAD's own surface meshes (reference only, see vtk_ref.py)

Each mask series goes through the same geometry audit as the CT, and it must
land on exactly the CT's slice positions and in-plane grid, or it is refused.
Masks are then painted into ONE label volume in precedence order: a tumour
inside the liver stays a tumour, and a vessel crossing the liver stays a
vessel. Structure names are normalized in one table (README gotcha: they are
not uniform across patients).

License: CC BY-NC-ND 4.0. Nothing derived from this goes into Git;
pipeline/build.py only writes IRCADb output to ignored folders.
"""
import re
from pathlib import Path

import numpy as np

from . import io_dicom
from .canonical import CanonicalImage

# name -> (stable structure id, precedence class). Higher precedence wins overlaps.
_RULES = [
    (r"^livertumou?r(\d*)$", lambda m: f"liver_tumor_{int(m.group(1) or 1):02d}", 4),
    (r"^livertumou?rs$", lambda m: "liver_tumors", 4),
    (r"^liver(kyst|kyste|cyst)s?(\d*)$", lambda m: "liver_cyst" + (f"_{int(m.group(2)):02d}" if m.group(2) else ""), 4),
    (r"^metastasectomie$", lambda m: "metastasectomy_site", 4),
    (r"^portalvein\d*$", lambda m: "portal_vein", 3),
    (r"^venoussystem$", lambda m: "venous_system", 3),
    (r"^venacava$", lambda m: "vena_cava", 3),
    (r"^artery$", lambda m: "artery", 3),
    (r"^biliarysystem$", lambda m: "biliary_system", 3),
    (r"^liver$", lambda m: "liver", 2),
]
# the liver-surgery view by default; skin/bone/lungs/other organs are huge
# meshes that bury the liver. Opt in with include=("all",) or by id.
DEFAULT_IDS = re.compile(r"^(liver|liver_tumor_\d+|liver_tumors|liver_cyst(_\d+)?|metastasectomy_site|"
                         r"portal_vein|venous_system|vena_cava|artery|biliary_system|gallbladder)$")


def normalize(name):
    """IRCAD folder name -> (structure id, precedence)."""
    key = re.sub(r"[^a-z0-9]", "", name.lower())
    for pat, fn, prec in _RULES:
        m = re.match(pat, key)
        if m:
            return fn(m), prec
    sid = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:64] or "structure"
    return sid, 1


def _mask_folders(zip_path):
    names = set()
    for name in io_dicom.list_names(zip_path, "MASKS_DICOM/"):
        parts = name.split("/")
        if len(parts) >= 3:
            names.add(parts[1])
    return sorted(names)


def load_case(case_dir, include=(), with_image=True):
    """-> CanonicalImage (labels + RAS affine) with audit/de-id provenance."""
    case_dir = Path(case_dir)
    pz, mz = case_dir / "PATIENT_DICOM.zip", case_dir / "MASKS_DICOM.zip"
    vol, affine, audit, deid, ordered = io_dicom.load_series(pz, "PATIENT_DICOM/")
    ref_pos = np.array([io_dicom._f(s.ds.ImagePositionPatient, 3) for s in ordered])
    shape = vol.shape
    folders = _mask_folders(mz)
    want_all = "all" in include
    picked, skipped, mapping = [], [], {}
    for f in folders:
        sid, prec = normalize(f)
        if want_all or sid in include or DEFAULT_IDS.match(sid):
            picked.append((prec, f, sid))
        else:
            skipped.append(sid)
        mapping[f] = sid
    ids = [sid for _, _, sid in picked]
    if len(set(ids)) != len(ids):
        raise io_dicom.GeometryError(f"two IRCAD masks normalize to the same id: {sorted(ids)}")
    labels = np.zeros(shape, np.int16)
    names, mask_audit, full = {}, {}, {}
    # paint low precedence first, so higher classes overwrite at overlaps
    for v, (prec, f, sid) in enumerate(sorted(picked, key=lambda t: (t[0], t[2])), start=1):
        mvol, maff, maud, _, mord = io_dicom.load_series(mz, f"MASKS_DICOM/{f}/", rescale=False)
        mpos = np.array([io_dicom._f(s.ds.ImagePositionPatient, 3) for s in mord])
        if mvol.shape != shape or not np.allclose(maff, affine, atol=1e-3) \
                or not np.allclose(mpos, ref_pos, atol=1e-3):
            raise io_dicom.GeometryError(f"mask {f!r} is not on the CT grid")
        labels[mvol > 0] = v
        names[v] = sid
        full[sid] = mvol > 0          # whole structure for its surface (no carving)
        mask_audit[sid] = {"source_folder": f, "precedence": prec, "voxels": int((mvol > 0).sum())}
    return CanonicalImage(
        labels=labels, affine=affine, label_names=names, source_case=case_dir.name,
        image=vol.astype(np.float32) if with_image else None,
        provenance={
            "dataset": "ircadb", "loader": "pipeline.ircadb + pipeline.io_dicom",
            "geometry_audit": audit, "deid_report": deid,
            "masks": {"normalized": mapping, "included": mask_audit, "excluded": sorted(skipped),
                      "overlap_rule": "precedence: tumour/cyst > vessels > liver > other"},
            "source_archives_sha256": {p.name: io_dicom.sha256_file(p) for p in (pz, mz)},
            "surfaces_from": "each structure's own full IRCAD mask (overlaps kept)",
        },
        surface_masks=full,
    ).validate()
