"""Phase 2 data pipeline tests (1.4-1.6). Self-contained: synthetic data only.

    ~/.venvs/jas/bin/python -m pytest pipeline/tests -q
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))

from pipeline import build, optimize, phantom, surfaces  # noqa: E402
from pipeline.canonical import CanonicalImage  # noqa: E402
from pipeline.verify_bundle import verify  # noqa: E402

trimesh = pytest.importorskip("trimesh")
FIXTURE = HERE / "media" / "models" / "phantom"
CREATED = "2026-11-04T00:00:00Z"


@pytest.fixture(scope="module")
def ci():
    return phantom.build()


@pytest.fixture(scope="module")
def surfs(ci):
    return {s.structure_id: s for s in surfaces.extract_all(ci)}


@pytest.fixture()
def bundle(tmp_path):
    out = tmp_path / "b"
    build.run(phantom.build(), out, with_volume=True, created=CREATED, log=lambda *_: None)
    return out


def mesh(s):
    return trimesh.Trimesh(s.vertices, s.faces, process=False)


# ---- canonical contract -------------------------------------------------
def _ci(**kw):
    base = dict(labels=np.zeros((4, 4, 4), np.int16), affine=np.eye(4),
                label_names={1: "liver"}, source_case="t")
    base.update(kw)
    return CanonicalImage(**base)


@pytest.mark.parametrize("kw,msg", [
    ({"affine": np.diag([1, 1, 0, 1.0])}, "singular"),
    ({"affine": np.array([[1, .5, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1.]])}, "orthogonal"),
    ({"image": np.zeros((4, 4, 5))}, "image shape"),
    ({"label_names": {0: "liver"}}, "> 0"),
    ({"label_names": {1: "Liver Tumor"}}, "snake_case"),
    ({"labels": np.zeros((4, 4, 4), np.float32)}, "integer"),
])
def test_canonical_rejects_bad_geometry(kw, msg):
    with pytest.raises(ValueError, match=msg):
        _ci(**kw).validate()


def test_spacing_comes_from_affine(ci):
    assert ci.spacing == pytest.approx((0.8, 2.0, 0.8))


# ---- 1.4 surfaces: physical world coordinates ---------------------------
def test_tumor_centre_lands_on_known_world_point(surfs):
    c = mesh(surfs["liver_tumor"]).center_mass
    assert np.allclose(c, phantom.LANDMARKS["tumor_centre_mm"], atol=0.8), c


def test_no_mirroring_arm_is_on_patient_right(surfs):
    # the phantom's voxel i axis runs toward -x: ignoring the affine's sign
    # would put the arm on the left. Arm = liver above z=+2 mm.
    v = surfs["liver"].vertices
    arm = v[v[:, 2] > 2]
    lo, hi = phantom.LANDMARKS["arm_x_range_mm"]
    assert arm[:, 0].min() > lo - 1.0 and arm[:, 0].max() < hi + 1.0
    assert arm[:, 2].max() == pytest.approx(phantom.LANDMARKS["arm_z_range_mm"][1], abs=2.0)


def test_anisotropic_extent_is_true_mm(surfs):
    v = surfs["liver"].vertices
    (x0, y0, z0), (x1, y1, z1) = phantom.LANDMARKS["body_box_mm"]
    # z is the 2.0 mm axis: a 1 mm assumption would halve this extent
    assert v[:, 2].min() == pytest.approx(z0, abs=2.0)
    assert v[:, 1].min() == pytest.approx(y0, abs=0.8) and v[:, 1].max() == pytest.approx(y1, abs=0.8)


def test_outward_normals_despite_negative_determinant(surfs):
    assert np.linalg.det(phantom.AFFINE[:3, :3]) < 0
    for sid in ("liver", "liver_tumor", "hepatic_vessel"):
        assert mesh(surfs[sid]).volume > 0, sid


def test_mesh_volume_tracks_voxel_volume(surfs):
    s = surfs["liver"]
    assert mesh(s).volume / 1000.0 == pytest.approx(s.volume_ml, rel=0.10)


def test_thin_vessel_survives_as_closed_tube(surfs):
    s = surfs["hepatic_vessel"]
    m = mesh(s)
    assert s.status == "present" and m.is_watertight
    lo, hi = phantom.LANDMARKS["vessel_z_range_mm"]
    assert s.vertices[:, 2].min() == pytest.approx(lo, abs=2.0)
    assert s.vertices[:, 2].max() == pytest.approx(hi, abs=2.0)


def test_empty_label_is_reported_not_invented(surfs):
    s = surfs["portal_vein"]
    assert s.status == "empty" and s.voxels == 0 and len(s.faces) == 0


# ---- 1.5 optimization gates ---------------------------------------------
def test_over_smoothing_is_rejected_and_original_kept(ci, surfs):
    s = surfs["liver"]
    v, f, r = optimize.optimize(s, ci.spacing, plan={"taubin_iterations": [300]})
    assert "smoothing skipped" in " ".join(r["findings"])
    assert np.array_equal(f, s.faces)


def test_thin_vessel_is_not_smoothed_away(ci, surfs):
    s = surfs["hepatic_vessel"]
    v, f, r = optimize.optimize(s, ci.spacing)
    assert r["final"]["volume_change_pct"] <= optimize.DEFAULT_TOLERANCES["max_volume_change_pct"]


def test_decimation_respects_budget_and_tolerance(ci, surfs):
    s = surfs["liver"]
    v, f, r = optimize.optimize(s, ci.spacing, plan={"max_faces": 4000})
    assert r["final"]["pass"] and r["final"]["watertight"]
    assert r["final"]["euler"] == r["original"]["euler"]
    assert len(f) <= 4000


# ---- 1.6 bundle ----------------------------------------------------------
def test_bundle_verifies(bundle):
    assert verify(bundle) == []


def test_bundle_is_reproducible(bundle, tmp_path):
    out2 = tmp_path / "b2"
    build.run(phantom.build(), out2, with_volume=True, created=CREATED, log=lambda *_: None)
    a = json.loads((bundle / "manifest.json").read_text())
    b = json.loads((out2 / "manifest.json").read_text())
    assert a["revision"] == b["revision"]


def test_committed_fixture_is_current_and_valid(bundle):
    assert verify(FIXTURE) == []
    rev = lambda d: json.loads((d / "manifest.json").read_text())["revision"]
    assert rev(FIXTURE) == rev(bundle), "regenerate: python -m pipeline.build --phantom ..."


def test_manifest_records_frame_and_empty_structure(bundle):
    m = json.loads((bundle / "manifest.json").read_text())
    g = m["geometry"]
    assert g["units"] == "mm" and g["axes"] == "RAS"
    assert np.allclose(g["voxel_to_world"], phantom.AFFINE)
    assert m["structures"]["portal_vein"] == {"label_value": 4, "mesh_node": None,
                                              "voxels": 0, "volume_ml": 0.0, "status": "empty"}
    assert any(f["structure"] == "portal_vein" for f in m["validation"]["findings"])


def test_tampered_asset_is_rejected(bundle):
    p = bundle / "model.glb"
    b = bytearray(p.read_bytes())
    b[-1] ^= 0xFF
    p.write_bytes(bytes(b))
    assert any("sha256 mismatch" in e for e in verify(bundle))


def test_edited_manifest_is_rejected(bundle):
    p = bundle / "manifest.json"
    m = json.loads(p.read_text())
    m["structures"]["liver"]["volume_ml"] = 999.0
    p.write_text(json.dumps(m))
    assert any("revision" in e for e in verify(bundle))


def test_escaping_asset_path_is_rejected(bundle):
    p = bundle / "manifest.json"
    m = json.loads(p.read_text())
    m["assets"][0]["path"] = "../../server.py"
    p.write_text(json.dumps(m))
    assert any(e.startswith("schema") for e in verify(bundle))


def test_missing_asset_is_rejected(bundle):
    (bundle / "volume.nrrd").unlink()
    assert any("volume.nrrd: missing" in e for e in verify(bundle))


def test_nrrd_header_carries_the_affine(bundle):
    import nrrd
    data, hdr = nrrd.read(str(bundle / "volume.nrrd"))
    assert data.shape == phantom.SHAPE
    assert np.allclose(hdr["space directions"], phantom.AFFINE[:3, :3].T)
    assert np.allclose(hdr["space origin"], phantom.AFFINE[:3, 3])


def test_real_data_cannot_be_written_into_tracked_media():
    with pytest.raises(SystemExit, match="refusing"):
        build._guard_out(HERE / "media" / "models" / "liver_39", synthetic=False)
    build._guard_out(HERE / "media" / "local" / "liver_39", synthetic=False)   # allowed


# ---- 1.2 NIfTI loader (pipeline/io_nifti.py; more in test_ingest.py) -----
def test_nifti_loader_keeps_affine_and_rejects_misaligned_mask(tmp_path):
    nib = pytest.importorskip("nibabel")
    from pipeline.io_nifti import load_pair as load_nifti_pair
    ci = phantom.build()
    def mm(img):                      # real scans declare mm; 1.2 refuses "unknown"
        img.header.set_xyzt_units("mm")
        return img
    nib.save(mm(nib.Nifti1Image(ci.image, phantom.AFFINE)), tmp_path / "image.nii.gz")
    nib.save(mm(nib.Nifti1Image(ci.labels.astype(np.uint8), phantom.AFFINE)), tmp_path / "label.nii.gz")
    got = load_nifti_pair(tmp_path / "image.nii.gz", tmp_path / "label.nii.gz", "msd-liver", "t")
    assert np.allclose(got.affine, phantom.AFFINE, atol=1e-5)
    assert np.array_equal(got.labels, ci.labels)
    shifted = phantom.AFFINE.copy()
    shifted[0, 3] += 5
    nib.save(mm(nib.Nifti1Image(ci.labels.astype(np.uint8), shifted)), tmp_path / "label.nii.gz")
    with pytest.raises(ValueError, match="not aligned"):
        load_nifti_pair(tmp_path / "image.nii.gz", tmp_path / "label.nii.gz", "msd-liver", "t")
