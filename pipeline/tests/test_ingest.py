"""Phase 1 ingestion tests: 1.1 DICOM, 1.2 NIfTI, 1.3 resampling.

    ~/.venvs/jas/bin/python -m pytest pipeline/tests -q

Synthetic only (pipeline/tests/dicom_fixture.py + pipeline/phantom.py).
The invariant everywhere: a structure's position in WORLD millimetres
survives every loader and transform. Voxel order may legitimately change.
"""
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))

pytest.importorskip("pydicom")
from pipeline import build, io_dicom, ircadb, phantom, resample, vtk_ref  # noqa: E402
from pipeline.tests import dicom_fixture as F  # noqa: E402

TUMOR = np.array(phantom.LANDMARKS["tumor_centre_mm"])


def centroid(ci, sid):
    v = {s: k for k, s in ci.label_names.items()}[sid]
    return ci.voxel_to_world(np.argwhere(ci.labels == v)).mean(0)


@pytest.fixture(scope="module")
def case(tmp_path_factory):
    return F.write_case(tmp_path_factory.mktemp("dcm"))


@pytest.fixture(scope="module")
def ci(case):
    return ircadb.load_case(case)


# ------------------------------------------------------------ 1.1 geometry
def test_dicom_world_landmarks_match_the_phantom(ci):
    assert np.allclose(centroid(ci, "liver_tumor_01"), TUMOR, atol=0.1)
    ref = phantom.build()
    for sid_ref, sid in (("liver", "liver"), ("hepatic_vessel", "portal_vein")):
        assert np.allclose(centroid(ci, sid), centroid(ref, sid_ref), atol=1e-6)


def test_order_comes_from_positions_not_names_or_instance_numbers(ci):
    a = ci.provenance["geometry_audit"]
    assert a["filename_order_matches"] is False       # image_10 sorts before image_2
    assert a["sorted_by"].startswith("ImagePositionPatient")
    assert a["slice_step_mm"] == pytest.approx(0.8)


def test_affine_is_explicit_lps_to_ras(ci):
    assert np.allclose(ci.spacing, (0.8, 2.0, 0.8))
    assert "LPS->RAS" in ci.provenance["geometry_audit"]["frame"]
    arm = ci.voxel_to_world(np.argwhere(ci.labels == 1))
    assert arm[arm[:, 2] > 2][:, 0].mean() > 0        # the L-arm stays on patient right


def _ct(tmp_path, **kw):
    d = F.write_case(tmp_path, **kw)
    return d / "PATIENT_DICOM.zip"


@pytest.mark.parametrize("kw,msg", [
    ({"drop": (12,)}, "missing slice"),
    ({"dup": 5}, "duplicate"),
    ({"tilt_iop_at": 9}, "mixed ImageOrientationPatient"),
])
def test_bad_series_geometry_is_refused(tmp_path, kw, msg):
    with pytest.raises(io_dicom.GeometryError, match=msg):
        io_dicom.load_series(_ct(tmp_path, **kw), "PATIENT_DICOM/")


def test_two_series_need_an_explicit_choice(tmp_path, case):
    z2 = tmp_path / "two.zip"
    with zipfile.ZipFile(case / "PATIENT_DICOM.zip") as a, zipfile.ZipFile(case / "MASKS_DICOM.zip") as b, \
            zipfile.ZipFile(z2, "w") as out:
        for n in a.namelist():
            out.writestr("X/" + n, a.read(n))
        for n in b.namelist():
            if "/liver/" in n:
                out.writestr("X/" + n, b.read(n))
    with pytest.raises(io_dicom.GeometryError, match="choose one explicitly"):
        io_dicom.load_series(z2, "X/")
    vol, *_ = io_dicom.load_series(z2, "X/", series_uid=F._uid(1))
    assert vol.shape == phantom.SHAPE


def test_mask_off_the_ct_grid_is_refused(tmp_path):
    d = F.write_case(tmp_path)
    with zipfile.ZipFile(d / "MASKS_DICOM.zip") as z:
        keep = {n: z.read(n) for n in z.namelist()}
    ci = phantom.build()
    shifted = F._series(np.where(ci.labels == 1, 255, 0).astype(np.uint8), "MASKS_DICOM/liver/",
                        F._uid(101), mask=True, ipp_shift=3.0)
    keep.update(shifted)
    with zipfile.ZipFile(d / "MASKS_DICOM.zip", "w") as z:
        for n, b in keep.items():
            z.writestr(n, b)
    with pytest.raises(io_dicom.GeometryError, match="not on the CT grid"):
        ircadb.load_case(d)


# ------------------------------------------------------- 1.1 archive safety
@pytest.mark.parametrize("name", ["../evil", "/abs/path", "a/../../b", "C:/win"])
def test_unsafe_member_paths_are_refused(tmp_path, name):
    z = tmp_path / "bad.zip"
    with zipfile.ZipFile(z, "w") as w:
        w.writestr(name, b"x")
    with pytest.raises(io_dicom.ArchiveError, match="unsafe"):
        list(io_dicom.iter_members(z))


def test_symlink_member_is_refused(tmp_path):
    z = tmp_path / "link.zip"
    info = zipfile.ZipInfo("PATIENT_DICOM/image_0")
    info.external_attr = (0o120777 << 16)
    with zipfile.ZipFile(z, "w") as w:
        w.writestr(info, "/etc/passwd")
    with pytest.raises(io_dicom.ArchiveError, match="symlink"):
        list(io_dicom.iter_members(z))


def test_size_limits_stop_a_zip_bomb(tmp_path):
    z = tmp_path / "big.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as w:
        w.writestr("a", b"\0" * 200_000)
    with pytest.raises(io_dicom.ArchiveError, match="limit"):
        list(io_dicom.iter_members(z, limits={"max_member_bytes": 100_000}))


# ------------------------------------------------------- 1.1 de-identification
def test_deid_report_counts_without_leaking_values(ci):
    r = ci.provenance["deid_report"]
    assert r["verdict"].startswith("NOT de-identified")
    assert r["identifying_tags"]["PatientName"]["present"] == phantom.SHAPE[2]
    assert "PatientBirthDate" in r["identifying_tags_with_values"]
    blob = json.dumps(r)
    for secret in (F.FAKE_NAME, "Testperson", "Zelda", F.FAKE_ID, "19010101", "Fixture General"):
        assert secret not in blob
    assert "pixel" in r["not_checked"]


def test_identifier_in_member_names_is_flagged(tmp_path, case):
    z = tmp_path / "named.zip"
    with zipfile.ZipFile(case / "PATIENT_DICOM.zip") as a, zipfile.ZipFile(z, "w") as w:
        for n in a.namelist():
            w.writestr(n.replace("image_", "zelda_"), a.read(n))
    *_, deid, _ = io_dicom.load_series(z, "PATIENT_DICOM/")
    assert deid["identifier_in_member_names"] is True


def test_clean_series_reports_no_identifying_values(tmp_path):
    d = F.write_case(tmp_path, phi=False)
    *_, deid, _ = io_dicom.load_series(d / "PATIENT_DICOM.zip", "PATIENT_DICOM/")
    assert deid["identifying_tags_with_values"] == []


# -------------------------------------------------------- 1.1 IRCADb names
@pytest.mark.parametrize("raw,sid,prec", [
    ("livertumor", "liver_tumor_01", 4), ("livertumor03", "liver_tumor_03", 4),
    ("livertumors", "liver_tumors", 4), ("liverkyste", "liver_cyst", 4), ("livercyst", "liver_cyst", 4),
    ("portalvein1", "portal_vein", 3), ("venacava", "vena_cava", 3), ("venoussystem", "venous_system", 3),
    ("liver", "liver", 2), ("leftkidney", "leftkidney", 1), ("Stones", "stones", 1),
])
def test_ircadb_name_normalization(raw, sid, prec):
    assert ircadb.normalize(raw) == (sid, prec)


def test_overlap_precedence_tumour_beats_liver(ci):
    v = {s: k for k, s in ci.label_names.items()}
    c = ci.voxel_to_world(np.argwhere(ci.labels == v["liver_tumor_01"]))
    assert len(c) == 388                                # the full sphere survives inside the liver


# --------------------------------------------------- 1.1 reference meshes + CLI
def test_vtk_reader_and_distance_roundtrip():
    from pipeline import surfaces
    s = surfaces.extract(phantom.build(), 2, "t")
    v, f = vtk_ref.read_vtk_polydata(F._vtk_binary(s.vertices, s.faces))
    assert np.allclose(v, s.vertices, atol=1e-4) and np.array_equal(f, s.faces)
    d = vtk_ref.surface_distance(s.vertices, s.faces, v, f, samples=500)
    assert d["p95_mm"] < 1e-3


def test_ircadb_build_end_to_end_with_reference_check(tmp_path, case):
    root = case.parent.parent
    out = tmp_path / "artifacts" / "fx"
    m = build.run(ircadb.load_case(case), out, with_volume=False, created="2026-11-05T00:00:00Z",
                  log=lambda *_: None)
    from pipeline.verify_bundle import verify
    assert verify(out) == []
    prov = m["provenance"]
    assert prov["dataset"] == "ircadb" and "geometry_audit" in prov and "deid_report" in prov
    assert F.FAKE_NAME not in (out / "manifest.json").read_text()
    res = build.reference_check(ircadb.load_case(case), out, case)
    assert res["liver_tumor_01"]["p95_mm"] < 0.6      # same masks; only 1.5 smoothing differs
    assert res["liver"]["mean_mm"] < 0.6


def test_real_ircadb_output_cannot_go_into_tracked_media():
    with pytest.raises(SystemExit, match="refusing"):
        build._guard_out(HERE / "media" / "models" / "ircadb_13", synthetic=False)


# ----------------------------------------------------------------- 1.2 NIfTI
def _nii(tmp_path, *, sform=None, qform=None, units="mm", labels=None, name="x"):
    import nibabel as nib
    ci = phantom.build()
    data = ci.labels if labels is None else labels
    img = nib.Nifti1Image(data.astype(np.float32 if data.dtype.kind == "f" else np.int16), None)
    if sform is not None:
        img.set_sform(sform[0], code=sform[1])
    else:
        img.set_sform(np.eye(4), code=0)
    if qform is not None:
        img.set_qform(qform[0], code=qform[1])
    else:
        img.set_qform(np.eye(4), code=0)
    img.header.set_xyzt_units(units)
    p = tmp_path / f"{name}.nii.gz"
    nib.save(img, p)
    return p


def _pair(tmp_path, **kw):
    return _nii(tmp_path, name="image", **kw), _nii(tmp_path, name="label", **kw)


def test_nifti_permuted_flipped_axes_keep_world_landmarks(tmp_path):
    from pipeline.io_nifti import load_pair
    i, l = _pair(tmp_path, sform=(phantom.AFFINE, 1), qform=(phantom.AFFINE, 1))
    ci = load_pair(i, l, "test", "t", label_map=phantom.LABELS)
    assert ci.provenance["affine_policy"]["label"]["source"] == "sform"
    assert np.allclose(centroid(ci, "liver_tumor"), centroid(phantom.build(), "liver_tumor"), atol=1e-4)


def test_nifti_qform_used_when_no_sform(tmp_path):
    from pipeline.io_nifti import load_pair
    i, l = _pair(tmp_path, qform=(phantom.AFFINE, 1))
    ci = load_pair(i, l, "test", "t", label_map=phantom.LABELS)
    assert ci.provenance["affine_policy"]["label"]["source"] == "qform"
    assert np.allclose(ci.affine, phantom.AFFINE, atol=1e-4)


def test_nifti_sform_qform_conflict_refused_unless_chosen(tmp_path):
    from pipeline.io_nifti import NiftiError, load_pair
    other = phantom.AFFINE.copy(); other[0, 3] += 10
    i, l = _pair(tmp_path, sform=(phantom.AFFINE, 1), qform=(other, 1))
    with pytest.raises(NiftiError, match="disagree"):
        load_pair(i, l, "test", "t", label_map=phantom.LABELS)
    ci = load_pair(i, l, "test", "t", label_map=phantom.LABELS, policy="qform")
    assert np.allclose(ci.affine, other, atol=1e-4)


def test_nifti_no_orientation_refused(tmp_path):
    from pipeline.io_nifti import NiftiError, load_pair
    i, l = _pair(tmp_path)
    with pytest.raises(NiftiError, match="orientation unknown"):
        load_pair(i, l, "test", "t", label_map=phantom.LABELS)


def test_nifti_metres_converted_and_unknown_units_refused(tmp_path):
    from pipeline.io_nifti import NiftiError, load_pair
    A_m = phantom.AFFINE.copy(); A_m[:3, :] /= 1000.0
    i, l = _pair(tmp_path, sform=(A_m, 1), units="meter")
    ci = load_pair(i, l, "test", "t", label_map=phantom.LABELS)
    assert np.allclose(ci.affine, phantom.AFFINE, atol=1e-4)
    i2, l2 = _pair(tmp_path, sform=(phantom.AFFINE, 1), units="unknown")
    with pytest.raises(NiftiError, match="millimetres"):
        load_pair(i2, l2, "test", "t", label_map=phantom.LABELS)
    assert load_pair(i2, l2, "test", "t", label_map=phantom.LABELS, assume_mm=True) \
        .provenance["affine_policy"]["assume_mm"] is True


def test_nifti_misaligned_mask_and_fractional_labels_refused(tmp_path):
    from pipeline.io_nifti import NiftiError, load_pair
    i = _nii(tmp_path, name="image", sform=(phantom.AFFINE, 1))
    sh = phantom.AFFINE.copy(); sh[2, 3] += 2
    l = _nii(tmp_path, name="label", sform=(sh, 1))
    with pytest.raises(NiftiError, match="not aligned"):
        load_pair(i, l, "test", "t", label_map=phantom.LABELS)
    frac = phantom.build().labels.astype(np.float32); frac[0, 0, 0] = 0.5
    l2 = _nii(tmp_path, name="label", sform=(phantom.AFFINE, 1), labels=frac)
    with pytest.raises(NiftiError, match="non-integer"):
        load_pair(i, l2, "test", "t", label_map=phantom.LABELS)


# --------------------------------------------------------------- 1.3 resample
def test_resample_preserves_world_box_landmarks_and_labels():
    src = phantom.build()
    out = resample.resample(src, 0.5)
    assert np.allclose(out.spacing, (0.5, 0.5, 0.5))
    assert set(np.unique(out.labels)) <= set(np.unique(src.labels))   # no invented labels
    for sid in ("liver", "liver_tumor"):
        assert np.allclose(centroid(out, sid), centroid(src, sid), atol=0.5)
    a = src.voxel_to_world(np.array([[0, 0, 0], np.array(src.labels.shape) - 1]))
    b = out.voxel_to_world(np.array([[0, 0, 0], np.array(out.labels.shape) - 1]))
    assert np.allclose(a[0], b[0]) and np.all(np.abs(a[1] - b[1]) <= 0.5 * 0.5 + 1e-6)
    r = out.provenance["resampling"]
    assert r["original_spacing_mm"] == pytest.approx([0.8, 2.0, 0.8]) and r["labels"] == "nearest-neighbour"


def test_resample_keeps_the_mirrored_grid_mirrored():
    out = resample.resample(phantom.build(), 1.0)
    assert np.linalg.det(out.affine[:3, :3]) < 0          # orientation is kept, not "fixed"


# ------------------------------------------- D-P1-02 whole-organ surfaces
def test_surface_masks_give_whole_organ_surfaces_without_carving():
    from pipeline import surfaces
    from pipeline.canonical import CanonicalImage
    p = phantom.build()
    whole = np.isin(p.labels, (1, 2))                     # liver including its tumour
    ci = CanonicalImage(labels=p.labels, affine=p.affine, label_names=p.label_names,
                        source_case="t", surface_masks={"liver": whole}).validate()
    s = surfaces.extract(ci, 1, "liver")
    carved = surfaces.extract(p, 1, "liver")
    assert s.voxels == int(whole.sum()) > carved.voxels
    import trimesh
    assert len(trimesh.Trimesh(s.vertices, s.faces).split(only_watertight=False)) < \
        len(trimesh.Trimesh(carved.vertices, carved.faces).split(only_watertight=False))  # no tumour cavity


def test_surface_mask_must_match_grid_and_a_label():
    from pipeline.canonical import CanonicalImage
    p = phantom.build()
    with pytest.raises(ValueError, match="bool on the label grid"):
        CanonicalImage(labels=p.labels, affine=p.affine, label_names=p.label_names, source_case="t",
                       surface_masks={"liver": np.zeros((2, 2, 2), bool)}).validate()
    with pytest.raises(ValueError, match="has no label"):
        CanonicalImage(labels=p.labels, affine=p.affine, label_names=p.label_names, source_case="t",
                       surface_masks={"spleen": np.zeros(p.labels.shape, bool)}).validate()


def test_msd_liver_surface_includes_its_tumours(tmp_path):
    from pipeline.io_nifti import load_pair
    i, l = _pair(tmp_path, sform=(phantom.AFFINE, 1))
    ci = load_pair(i, l, "msd-liver", "t")              # phantom labels 1=liver, 2=tumour
    assert ci.surface_masks["liver"].sum() == np.isin(phantom.build().labels, (1, 2)).sum()
