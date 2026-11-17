# ADR 0003: Verified NRRD, multiplanar slices and volume rendering

- **Status** — Proposed for Phase 3 review. Implemented and exercised in Chrome.
- **Date** — 2026-11-17
- **Tasks** — 2.5, 2.6
- **Deciding reviewers** — Graphics and imaging reviewers

## Context

Multiplanar reformatting (MPR) and 3D CT need the same source intensities and
physical coordinates as the scan-derived surfaces. The existing board uses
Three.js r160 and native browser modules. The exporter delivers a small,
explicit NRRD subset alongside a bundle manifest and the GLB.

## Options

| Option | Effect on the current viewer |
| --- | --- |
| Three.js and native NRRD decoding | Keeps the board scene, material clipping and delivery path. The application owns sampling, transfer functions and fallback. |
| Dedicated medical visualization library | Offers broader format and rendering features. Requires another dependency and a scene/compositing integration to share clipping and transforms. |

## Decision

Extend the existing Three.js renderer. Verify the exported NRRD against
its manifest before decoding. Accept inline gzip in the exporter-supported
scalar formats and preserve the full voxel-to-RAS affine. Use inverse-affine
linear interpolation for canvas slices, clipping and contour overlays in
patient millimeters, and a WebGL2 3D texture for raymarching. Share window and
level controls across CT views. Keep the existing surface renderer available
if CT verification, decoding or GPU upload fails.

## Consequences and evidence

The viewer supports the pipeline's NRRD subset and a 256 MiB decoded volume
ceiling. GPU texture dimensions and memory also limit 3D mode. The tracker
owns the interactive CT view, and the OBS role mirrors the surface cut.
Revisit the renderer if target-hardware measurements or supported formats
exceed this design. The [validation record](../validation/2026-11-17-phase3.md)
contains phantom measurements, shader probes, Drive case checks and remaining
hardware and imaging acceptance.
