# Phase 3 advanced scan mechanics

Phase 3 covers tasks 1.8, 2.5–2.7 and 3.7–3.8 for the educational research
viewer. Its base, `98b1899`, contains the Phase 1 and Phase 2 merges. The
[validation record](../validation/2026-11-17-phase3.md) lists performed
checks, reproduction commands and remaining manual acceptance.

## Run the synthetic scan

1. Start `python server.py` from the repository root. Open
   `http://127.0.0.1:8794/stage.html` in Chrome and allow the camera.
2. Stage `models/phantom/model.glb` with `bin/board.sh '{"a":"hand","src":"models/phantom/model.glb"}'`
   or select it in the Props orb. On Windows the shell script can run in Git Bash.
3. **CT slices** shows axial, coronal and sagittal reformats with positions in RAS
   millimeters. Cyan contours mark intersections with visible anatomical meshes.
   **3D volume** overlays a transparent CT raymarch on the staged surface.
   Adjust level, width and volume opacity. **Surface** restores the mesh view.
4. Choose a cut preset and move **Cut depth**. The corresponding CT panel
   follows the plane. **Arm cut** or **X** enables a flat-palm swipe. Spread two
   fingers to move the cut. A hand-defined cut gets an oblique CT panel. Lock
   or pause preserves the plane. Resume explicitly after the cutting hand is
   lost. **Clear cut** removes the plane.
5. Hold an open hand still over a visible mesh, or choose **Mouse pick** and
   click the model. The panel reports a structure name or a selection status. Reassemble
   exploded models to inspect volume alignment and patient-space hits.

The controls target the most recently staged scan still on the board. The
3D view needs WebGL2 and sufficient GPU memory. Multiplanar slices use a 2D
canvas. Missing, unsupported and oversized volumes retain a surface fallback.
The OBS render role mirrors surface pose and clipping. The interactive CT
views and controls live on the tracker.

## Geometry and metadata decisions

- Use the pinned Three.js renderer already loaded by the board. Phase 3 reads
  the verified inline-gzip NRRD subset emitted by the pipeline. Browser
  decompression and an explicit RAS affine preserve translation, anisotropy
  and mirroring. See [ADR 0003](../decisions/0003-volume-mpr-rendering.md)
  for renderer selection. Existing `jas-bundle/1` and `barehands-anatomy/1` files remain
  the entry points. The board uses the same verified sidecar bytes as the GLB
  gate, including when staging two copies of the same asset.
- The scan scene has one patient root below the existing model root. The chain
  is voxel center → RAS mm → GLB model → board scene. The MPR sampler uses the
  inverse voxel affine. Mesh contours, ray hits and clip planes use the same
  patient frame. The 3D texture uses half-voxel bounds. Cut state adapts the
  existing wire format to a patient plane and retains the existing cap path.
  The raymarch and surface clip use the same half-space. The 3D view uses
  transparent compositing and offers window, level and opacity controls.
- A scan hit records its bundle revision, stable structure ID, patient-space
  hit point, depth and teaching review status. Near-coincident surfaces and
  disagreeing hands give an ambiguous result. The heartbeat `pt` retains its
  established structure and ambiguity fields. Draft teaching references
  stay separate from `teach`. Segmentation source and teaching review are
  independent fields.

## Manual review checklist

Record commit, Chrome, camera, viewport and GPU. Use the synthetic phantom
first and an approved NOVA-data dataset if available. Store only non-sensitive
metrics and hashes in Git.

| Check | Expected observation |
| --- | --- |
| Geometry | The asymmetric landmark appears on the correct side. Corresponding contour and voxel landmarks agree within one source voxel. Record physical error. |
| CT display | An active cut moves in the 2D slice, 3D clip and surface cap together. Adjust window and opacity and switch models to check cleanup. |
| Webcam | Test both hands, mirrored framing, two viewport sizes, flat-palm cuts and two-finger scrubs. Cover the cutting hand for more than 400 ms. The last plane holds until resumed. Disarm and confirm ordinary pinch works. |
| Picking | Confirm stable names when still, explicit ambiguity for opposing hands and no stale hit after hiding, clipping, leaving the frame or removing the model. |
| Performance and imaging | Record CT load time and frame pacing during scrub. Have the imaging reviewer check real-case overlays, source provenance and accepted tolerances. |
