# ADR 0002: Bundle manifest and patient-space export axes

- **Status:** proposed
- **Date:** 2026-11-04
- **Tasks:** 1.4, 1.5, 1.6, 2.3, 2.4; gate G2
- **Deciding reviewers:** Data and Graphics owners plus an imaging reviewer
  (to be named). Until G2 is accepted, the tolerances are placeholders.
- **Decision trees:** [D-P2-04](phase2-decision-log.md#d-p2-04-asset-bundle-contract),
  [D-P2-05](phase2-decision-log.md#d-p2-05-coordinate-frame-and-units-of-exported-meshes)

## Context

The pitch's central claim is that a scan becomes a to-scale, interactive model,
and today none of that is built. The only model is the BodyParts3D heart, which
is an atlas, not a scan. Its sidecar (`barehands-anatomy/1`) maps mesh names to
teaching content. It does not record where the geometry came from, what units
it uses, or how to get back to millimetres. The scans have anisotropic voxels
(≈0.7 × 0.7 × 0.7–5 mm). NIfTI and DICOM also disagree on orientation, so if
we ignore the affine the model comes out squashed or mirrored without any
error. [system.md](../architecture/system.md#proposed-asset-manifest) asks for
a separately versioned manifest and says `barehands-anatomy/1` must not be
changed silently.

## Options

1. Add geometry fields to `barehands-anatomy/1`. This would break the schema's
   "exactly this version" rule and risk the heart regressing.
2. Store meshes in glTF's metres/+Y-up convention and convert on export. This
   hides an axis swap that is easy to get wrong.
3. Store meshes in **patient world RAS+ millimetres** and add a new
   **`jas-bundle/1` manifest** next to an unchanged `anatomy.json`.

## Decision (proposed)

We take option 3.

A bundle is a folder under `media/`. For permitted or synthetic data only, it
contains:

```text
<bundle>/
  manifest.json      jas-bundle/1, validated by schemas/bundle.schema.json
  anatomy.json       barehands-anatomy/1 (unchanged contract), axes {superior:+z, left:-x, anterior:+y}
  model.glb          one mesh node per structure id; vertices in RAS+ mm
  model.orig.glb     optional: the un-optimized 1.4 output (1.5 keeps the original)
  volume.nrrd        optional: intensities with space directions/origin = the affine
```

The manifest has these field groups. `schemas/bundle.schema.json` is the
authority.

| Group | Fields |
| --- | --- |
| identity | `schema`, `bundle_id` (opaque, no patient name), `revision` (content hash), `source_case` (dataset case id or `synthetic:<name>`) |
| geometry | `units: "mm"`, `axes: "RAS"`, `shape`, `spacing`, `voxel_to_world` (4×4), `world_to_model` (4×4; identity for this ADR), `bounds_mm` (min/max) |
| assets | per file: `path` (relative, no `..`), `media_type`, `bytes`, `sha256` |
| structures | per id: `label_value`, `mesh_node`, `voxels`, `volume_ml`, `status` (`present` / `empty`) |
| provenance | `dataset`, `license`, `citation`, `tool_versions`, `pipeline_config`, `segmentation: {source, reviewer_state}`, `created` |
| validation | per structure: `max_displacement_mm`, `volume_change_pct`, `watertight`, findings (`warning` / `error`) |

The viewer (2.4) uses **one** centre-and-scale transform for the whole
bundle and keeps its inverse, so scene coordinates can be mapped back to mm.
It never centres structures one at a time. As built (PR D, D-P2-09), this is
stage.html's existing whole-scene box, centre and fit, with the bbox cache
keyed by `revision`. `mmToScene`/`sceneToMm` read the live three.js node
matrices. `bounds_mm` is kept for validation and future measuring tools.

## Consequences

- Distances and diameters can be computed in mm from the scene, which a later
  measure tool will need. The measure tool itself is not part of Phase 2.
- A mirrored export can be detected: the asymmetric phantom test fails if
  left and right are swapped.
- The heart and every existing sidecar keep working unchanged.
- Bundles derived from IRCADb are never committed (CC BY-NC-ND). Only
  synthetic bundles, and later explicitly permitted ones, go under `media/`.
- Tolerances such as maximum displacement and volume change are placeholders
  in the pipeline config until G2 sets them with an imaging reviewer.

## Evidence

The evidence comes from Phase 2 PR B (pipeline tests and the phantom bundle)
and PR D (viewer transform). This ADR stays *proposed* until those PRs are
reviewed and G2 tolerances are agreed.
