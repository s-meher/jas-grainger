"""Task 1.1: DICOM series -> CanonicalImage, with archive safety, series
selection, a slice-geometry audit and a de-identification REPORT.

Four separate concerns, kept separate on purpose (plan.md 1.1: "renaming
alone is not sanitization"):

  1. ARCHIVE SAFETY   read zip members (or directory files) in memory. Refuse
                      absolute paths, "..", symlinks, encrypted members and
                      over-size members or totals (zip bombs). Nothing is ever
                      extracted next to the source.
  2. SERIES SELECTION group by SeriesInstanceUID. More than one candidate
                      needs an explicit choice; we never guess.
  3. GEOMETRY AUDIT   sort by ImagePositionPatient projected on the slice
                      normal (row x col of ImageOrientationPatient), never by
                      filename or InstanceNumber. Reject mixed orientation,
                      spacing, size or transfer syntax, duplicate positions,
                      and gaps. Build the voxel->LPS affine, then convert it
                      to RAS with an explicit, labelled matrix.
  4. DE-ID REPORT     which identifying tags are present, empty or absent,
                      with counts only and never values, plus BurnedInAnnotation
                      and whether identifiers appear in member names. A report,
                      not a transformation: burned-in pixel text is NOT checked.

Voxel index convention (same as CanonicalImage everywhere):
  i = column (moves along IOP[0:3]), j = row (IOP[3:6]), k = slice (normal).
"""
import hashlib
import io
import re
import stat
import zipfile
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

import numpy as np

from .canonical import CanonicalImage

LPS_TO_RAS = np.diag([-1.0, -1.0, 1.0, 1.0])   # DICOM patient axes (LPS) -> RAS+

LIMITS = {"max_member_bytes": 64 << 20, "max_total_bytes": 4 << 30, "max_members": 20000}
ORIENT_TOL = 1e-4          # direction-cosine agreement across a series
SPACING_TOL = 0.02         # 2 % slice-spacing variation allowed
GAP_FACTOR = 1.5           # a step > 1.5x the median step is a missing slice

# identifying attributes reported on (keyword list; values never leave this file)
PHI_KEYWORDS = (
    "PatientName", "PatientID", "OtherPatientIDs", "PatientBirthDate", "PatientSex",
    "PatientAge", "PatientAddress", "PatientTelephoneNumbers", "InstitutionName",
    "InstitutionAddress", "ReferringPhysicianName", "PerformingPhysicianName",
    "OperatorsName", "StationName", "DeviceSerialNumber", "AccessionNumber", "StudyID",
    "StudyDate", "SeriesDate", "AcquisitionDate", "ContentDate", "StudyTime",
)


class ArchiveError(ValueError):
    pass


class GeometryError(ValueError):
    pass


# ------------------------------------------------------------- 1. archive
def _safe_name(name):
    p = PurePosixPath(name.replace("\\", "/"))
    if p.is_absolute() or ".." in p.parts or re.match(r"^[A-Za-z]:", name):
        raise ArchiveError(f"unsafe member path {name!r}")
    return p.as_posix()


def iter_members(src, prefix="", limits=None):
    """Yield (relative name, bytes) for files in a zip or directory under prefix."""
    lim = {**LIMITS, **(limits or {})}
    src = Path(src)
    total = count = 0
    if src.is_file() and zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            for info in z.infolist():
                name = _safe_name(info.filename)
                if info.is_dir() or not name.startswith(prefix):
                    continue
                if info.flag_bits & 0x1:
                    raise ArchiveError(f"encrypted member {name!r}")
                if stat.S_ISLNK(info.external_attr >> 16):
                    raise ArchiveError(f"symlink member {name!r}")
                count += 1
                total += info.file_size
                if info.file_size > lim["max_member_bytes"]:
                    raise ArchiveError(f"member {name!r} is {info.file_size} bytes (limit)")
                if total > lim["max_total_bytes"] or count > lim["max_members"]:
                    raise ArchiveError("archive exceeds size/member limits")
                data = z.read(info)
                if len(data) != info.file_size:          # a lying header is a bomb tell
                    raise ArchiveError(f"member {name!r} size mismatch")
                yield name, data
    elif src.is_dir():
        root = src.resolve()
        for p in sorted(root.rglob("*")):
            if p.is_symlink():
                raise ArchiveError(f"symlink {p.relative_to(root)}")
            if not p.is_file():
                continue
            rel = p.relative_to(root).as_posix()
            if not rel.startswith(prefix):
                continue
            count += 1
            total += p.stat().st_size
            if p.stat().st_size > lim["max_member_bytes"] or total > lim["max_total_bytes"] \
                    or count > lim["max_members"]:
                raise ArchiveError("directory exceeds size/member limits")
            yield rel, p.read_bytes()
    else:
        raise ArchiveError(f"not a zip or directory: {src}")


def list_names(src, prefix=""):
    """Member names only (no decompression), with the same path safety."""
    src = Path(src)
    if src.is_file() and zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            return [n for n in (_safe_name(i.filename) for i in z.infolist() if not i.is_dir())
                    if n.startswith(prefix)]
    return [n for n, _ in iter_members(src, prefix)]


# ------------------------------------------------------------ 2. series
@dataclass
class Slice:
    name: str
    ds: object = field(repr=False)


def read_slices(src, prefix="", limits=None):
    """-> (slices, skipped names). Non-DICOM members are skipped, not fatal."""
    import pydicom
    from pydicom.errors import InvalidDicomError
    out, skipped = [], []
    for name, data in iter_members(src, prefix, limits):
        try:
            ds = pydicom.dcmread(io.BytesIO(data))
        except InvalidDicomError:
            skipped.append(name)
            continue
        if "PixelData" not in ds:
            skipped.append(name)
            continue
        out.append(Slice(name, ds))
    return out, skipped


def group_series(slices):
    groups = {}
    for s in slices:
        groups.setdefault(str(getattr(s.ds, "SeriesInstanceUID", "")), []).append(s)
    return groups


def select_series(slices, series_uid=None):
    g = group_series(slices)
    if not g:
        raise GeometryError("no DICOM image slices found")
    if series_uid is not None:
        if series_uid not in g:
            raise GeometryError("requested SeriesInstanceUID not present")
        return g[series_uid]
    if len(g) > 1:
        sizes = ", ".join(f"{u[-12:]}:{len(v)}" for u, v in g.items())
        raise GeometryError(f"{len(g)} series present ({sizes}); choose one explicitly")
    return next(iter(g.values()))


# ------------------------------------------------------- 3. geometry
def _f(v, n):
    try:
        a = np.array([float(x) for x in v], dtype=float)
    except Exception:
        raise GeometryError("missing or malformed geometry tag")
    if a.shape != (n,):
        raise GeometryError("malformed geometry tag")
    return a


def audit_geometry(slices):
    """-> (ordered slices, affine RAS, audit dict). Raises GeometryError."""
    if len(slices) < 2:
        raise GeometryError("need at least 2 slices for a volume")
    iops = [_f(getattr(s.ds, "ImageOrientationPatient", None), 6) for s in slices]
    iop = iops[0]
    if any(np.max(np.abs(o - iop)) > ORIENT_TOL for o in iops):
        raise GeometryError("mixed ImageOrientationPatient within the series")
    row, col = iop[:3], iop[3:]
    if abs(np.linalg.norm(row) - 1) > 1e-3 or abs(np.linalg.norm(col) - 1) > 1e-3 \
            or abs(row @ col) > 1e-3:
        raise GeometryError("ImageOrientationPatient is not orthonormal")
    normal = np.cross(row, col)
    ps = {tuple(_f(getattr(s.ds, "PixelSpacing", None), 2)) for s in slices}
    shp = {(int(s.ds.Rows), int(s.ds.Columns)) for s in slices}
    ts = {str(getattr(getattr(s.ds, "file_meta", None), "TransferSyntaxUID", "")) for s in slices}
    for what, vals in (("PixelSpacing", ps), ("Rows/Columns", shp), ("TransferSyntax", ts)):
        if len(vals) > 1:
            raise GeometryError(f"mixed {what} within the series")
    ipps = np.array([_f(getattr(s.ds, "ImagePositionPatient", None), 3) for s in slices])
    d = ipps @ normal
    order = np.argsort(d, kind="stable")
    d = d[order]
    steps = np.diff(d)
    if np.any(steps < 1e-6):
        raise GeometryError("duplicate slice positions")
    med = float(np.median(steps))
    if np.any(steps > GAP_FACTOR * med):
        raise GeometryError(f"missing slice(s): a step of {steps.max():.3f} mm vs median {med:.3f} mm")
    if (steps.max() - steps.min()) > SPACING_TOL * med:
        raise GeometryError(f"non-uniform slice spacing ({steps.min():.4f}-{steps.max():.4f} mm)")
    # in-plane IPP drift along the stack = a sheared (gantry-tilt) volume
    inplane = (ipps[order] - ipps[order][0]) - np.outer(d - d[0], normal)
    if np.max(np.abs(inplane)) > 1e-2:
        raise GeometryError("slice origins drift in-plane (gantry tilt / sheared stack)")
    ordered = [slices[i] for i in order]
    (rs, cs), = ps                     # PixelSpacing = [row spacing, column spacing]
    A = np.eye(4)
    A[:3, 0] = row * cs                # i: next column
    A[:3, 1] = col * rs                # j: next row
    A[:3, 2] = normal * med            # k: next slice
    A[:3, 3] = ipps[order][0]
    thick = getattr(ordered[0].ds, "SliceThickness", None)
    filename_order = [s.name for s in sorted(slices, key=lambda s: s.name)]
    audit = {
        "slices": len(ordered), "rows_cols": list(next(iter(shp))),
        "pixel_spacing_mm": [rs, cs], "slice_step_mm": round(med, 6),
        "slice_step_range_mm": [round(float(steps.min()), 6), round(float(steps.max()), 6)],
        "slice_thickness_mm": float(thick) if thick not in (None, "") else None,
        "orientation": [round(float(x), 6) for x in iop],
        "sorted_by": "ImagePositionPatient . (row x col)",
        "filename_order_matches": filename_order == [s.name for s in ordered],
        "transfer_syntax": next(iter(ts)),
        "frame": "voxel->LPS built from DICOM, then LPS->RAS = diag(-1,-1,1)",
    }
    if audit["slice_thickness_mm"] and abs(audit["slice_thickness_mm"] - med) > 0.1 * med:
        audit["warning"] = "SliceThickness differs from slice step (gaps or overlap between slabs)"
    return ordered, LPS_TO_RAS @ A, audit


def stack(ordered, rescale=True):
    """Ordered slices -> (I=cols, J=rows, K=slices) array; HU if rescale."""
    vol = np.stack([s.ds.pixel_array for s in ordered], axis=-1)   # (rows, cols, K)
    vol = np.transpose(vol, (1, 0, 2))
    if not rescale:
        return vol
    slope = float(getattr(ordered[0].ds, "RescaleSlope", 1) or 1)
    icpt = float(getattr(ordered[0].ds, "RescaleIntercept", 0) or 0)
    return vol.astype(np.float32) * slope + icpt


# ------------------------------------------------------------ 4. de-id
def deid_report(slices, member_names=()):
    """Counts only. Values are compared internally and never returned."""
    n = len(slices)
    tags, ids = {}, set()
    for kw in PHI_KEYWORDS:
        present = empty = 0
        for s in slices:
            if kw in s.ds:
                v = str(s.ds.get(kw, "")).strip()
                if v:
                    present += 1
                    if kw in ("PatientName", "PatientID", "OtherPatientIDs", "AccessionNumber"):
                        ids.update(t.lower() for t in re.split(r"[\^\s,]+", v) if len(t) >= 3)
                else:
                    empty += 1
        if present or empty:
            tags[kw] = {"present": present, "empty": empty, "absent": n - present - empty}
    burned = sorted({str(getattr(s.ds, "BurnedInAnnotation", "")) for s in slices} - {""})
    names = [m.lower() for m in member_names]
    in_names = any(t in nm for t in ids for nm in names)
    private = sum(1 for s in slices for e in s.ds if e.tag.is_private)
    return {
        "slices": n,
        "identifying_tags": tags,
        "identifying_tags_with_values": sorted(k for k, v in tags.items() if v["present"]),
        "burned_in_annotation": burned or ["(tag absent)"],
        "identifier_in_member_names": in_names,
        "private_elements": private,
        "verdict": ("NOT de-identified: identifying values present" if any(v["present"] for v in tags.values())
                    else "no identifying values in reported tags"),
        "not_checked": "burned-in text in pixel data; free-text and private-tag contents",
    }


# ---------------------------------------------------------- one-shot
def sha256_file(p, chunk=1 << 20):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def load_series(src, prefix="", series_uid=None, rescale=True, limits=None):
    """-> (array, affine RAS, audit, deid, ordered slices)."""
    slices, skipped = read_slices(src, prefix, limits)
    chosen = select_series(slices, series_uid)
    ordered, affine, audit = audit_geometry(chosen)
    audit["skipped_non_image_members"] = len(skipped)
    deid = deid_report(chosen, [s.name for s in chosen])
    return stack(ordered, rescale), affine, audit, deid, ordered


def load_dicom_image(src, case, prefix="", series_uid=None, with_image=True):
    """A DICOM series with no masks -> CanonicalImage with an empty label map
    (useful for inspection; labeled data comes via pipeline/ircadb.py)."""
    vol, aff, audit, deid, _ = load_series(src, prefix, series_uid, rescale=True)
    return CanonicalImage(labels=np.zeros(vol.shape, np.int16), affine=aff, label_names={},
                          source_case=case, image=vol if with_image else None,
                          provenance={"dataset": "dicom", "loader": "pipeline.io_dicom",
                                      "geometry_audit": audit, "deid_report": deid}).validate()
