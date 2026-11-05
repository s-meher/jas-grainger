"""Synthetic IRCADb-shaped DICOM case built from the asymmetric phantom.

No patient data and nothing binary committed: it's generated per test run.
It deliberately reproduces every trap the real data has:
  - `image_N` filenames whose lexical order is wrong (image_10 < image_2)
  - InstanceNumber scrambled (it must not be used for ordering)
  - a slice axis that runs OPPOSITE to row x col (the reader must re-derive order)
  - anisotropic spacing and a permuted, mirrored grid (from pipeline/phantom.py)
  - fake identifying tags (PatientName etc.) for the de-identification report
  - per-structure mask series in MASKS_DICOM/<ircad name>/
  - a MESHES_VTK.zip reference built from the phantom's own surfaces (LPS)
"""
import io
import zipfile
from pathlib import Path

import numpy as np

from pipeline import phantom

LPS = np.diag([-1.0, -1.0, 1.0, 1.0])
FAKE_NAME = "Testperson^Zelda"          # fake identifiers, checked never to leak
FAKE_ID = "ZX99173"
IRCAD_NAMES = {1: "liver", 2: "livertumor", 3: "portalvein1"}   # -> liver, liver_tumor_01, portal_vein


def _uid(n):
    return f"1.2.826.0.1.3680043.8.498.{n}"


def _slice_ds(arr2d, ipp, iop, spacing_rc, inst, series_uid, *, mask=False, phi=True):
    from pydicom.dataset import FileDataset, FileMetaDataset
    from pydicom.uid import ExplicitVRLittleEndian, CTImageStorage
    meta = FileMetaDataset()
    meta.TransferSyntaxUID = ExplicitVRLittleEndian
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = _uid(10_000 + inst + (5000 if mask else 0))
    ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
    ds.SeriesInstanceUID = series_uid
    ds.Modality = "CT"
    if phi:
        ds.PatientName, ds.PatientID, ds.PatientBirthDate, ds.PatientSex = FAKE_NAME, FAKE_ID, "19010101", "O"
        ds.InstitutionName = "Fixture General"
    ds.Rows, ds.Columns = arr2d.shape
    ds.PixelSpacing = [f"{spacing_rc[0]:.6g}", f"{spacing_rc[1]:.6g}"]
    ds.ImageOrientationPatient = [f"{x:.6g}" for x in iop]
    ds.ImagePositionPatient = [f"{x:.6g}" for x in ipp]
    ds.SliceThickness = "0.8"
    ds.InstanceNumber = inst
    ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
    if mask:
        ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 8, 8, 7, 0
        ds.PixelData = arr2d.astype(np.uint8).tobytes()
    else:
        ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 1
        ds.RescaleSlope, ds.RescaleIntercept = "1", "-1024"
        ds.PixelData = (arr2d + 1024).astype(np.int16).tobytes()
    buf = io.BytesIO()
    ds.save_as(buf, enforce_file_format=True)
    return buf.getvalue()


def geometry():
    """Phantom voxel grid expressed as DICOM tags: (iop, spacing_rc, ipp(k))."""
    A = LPS @ phantom.AFFINE
    row = A[:3, 0] / np.linalg.norm(A[:3, 0])        # i (columns)
    col = A[:3, 1] / np.linalg.norm(A[:3, 1])        # j (rows)
    spacing_rc = (np.linalg.norm(A[:3, 1]), np.linalg.norm(A[:3, 0]))
    ipp = lambda k: (A @ np.array([0, 0, k, 1.0]))[:3]
    return np.concatenate([row, col]), spacing_rc, ipp


def _series(vol, prefix, series_uid, *, mask=False, phi=True, drop=(), dup=None,
            tilt_iop_at=None, ipp_shift=0.0):
    iop, sp, ipp = geometry()
    K = vol.shape[2]
    rng = np.random.default_rng(7)
    insts = rng.permutation(K)                         # scrambled InstanceNumber
    files = {}
    for k in range(K):
        if k in drop:
            continue
        o = iop.copy()
        if tilt_iop_at is not None and k == tilt_iop_at:
            o = np.array([1, 0, 0, 0, 0.995, 0.0998749])
        p = ipp(k) + np.array([ipp_shift, 0, 0])
        files[f"{prefix}image_{k}"] = _slice_ds(vol[:, :, k].T, p, o, sp, int(insts[k]),
                                               series_uid, mask=mask, phi=phi)
    if dup is not None:
        files[f"{prefix}image_dup"] = files[f"{prefix}image_{dup}"]
    return files


def _vtk_binary(v, f):
    head = (b"# vtk DataFile Version 3.0\nvtk output\nBINARY\nDATASET POLYDATA\n"
            + f"POINTS {len(v)} float\n".encode())
    pts = np.asarray(v, ">f4").tobytes()
    polys = np.hstack([np.full((len(f), 1), 3), f]).astype(">i4").tobytes()
    return head + pts + f"\nPOLYGONS {len(f)} {4 * len(f)}\n".encode() + polys + b"\n"


def write_case(root, case="3Dircadb1.99", **series_kw):
    """-> case folder with the three IRCADb zips. series_kw tweaks the CT series."""
    from pipeline import surfaces
    ci = phantom.build()
    d = Path(root) / "ircadb" / case
    d.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(d / "PATIENT_DICOM.zip", "w") as z:
        for n, b in _series(np.rint(ci.image).astype(np.int16), "PATIENT_DICOM/", _uid(1), **series_kw).items():
            z.writestr(n, b)
    with zipfile.ZipFile(d / "MASKS_DICOM.zip", "w") as z:
        for v, name in IRCAD_NAMES.items():
            m = np.where(ci.labels == v, 255, 0).astype(np.uint8)
            for n, b in _series(m, f"MASKS_DICOM/{name}/", _uid(100 + v), mask=True).items():
                z.writestr(n, b)
    with zipfile.ZipFile(d / "MESHES_VTK.zip", "w") as z:
        for v, name in IRCAD_NAMES.items():
            s = surfaces.extract(ci, v, name)
            z.writestr(f"MESHES_VTK/{name}.vtk", _vtk_binary(s.vertices @ LPS[:3, :3].T, s.faces))
    return d
