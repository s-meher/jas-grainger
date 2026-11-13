# Phase 1 decision log (decision trees)

Same format as the [Phase 2 log](phase2-decision-log.md): question → options →
criterion → chosen leaf, with evidence. Status stays `proposed` until the
owners' review accepts it.

## D-P1-01 Reading DICOM: order, frame and archives

2026-11-05 · tasks 1.1, G1, G2 · proposed

```mermaid
flowchart TD
  Q{How do slices become a volume in RAS mm?}
  Q --> A[Sort by filename / InstanceNumber]
  Q --> B[Unzip to disk, then read]
  Q --> C[In-memory zip read; sort by IPP on the slice normal;<br/>LPS affine, then labelled LPS-to-RAS]
  A -->|IRCADb: image_10 sorts before image_2;<br/>fixture scrambles InstanceNumber| AX[Rejected]
  B -->|~1 GB per patient vs 9 GB free;<br/>extraction is where path attacks land| BX[Rejected]
  C --> C1{World landmarks exact? Agrees with independent data?}
  C1 -->|fixture centroids match the phantom to 1e-6 mm;<br/>IRCAD's own meshes: mean 0.35-0.69 mm, p95 0.76-1.70 mm| CY[Chosen]
```

## D-P1-02 Overlapping structures: carve or keep whole?

2026-11-05 · tasks 1.1, 1.4 · proposed

```mermaid
flowchart TD
  Q{IRCAD masks overlap: tumours and vessels sit inside the liver.<br/>What is the liver's surface?}
  Q --> A[Paint one exclusive label volume; mesh each label]
  Q --> B[Exclusive labels for voxels; each surface from the structure's FULL mask]
  A -->|liver gets tunnels and cavities;<br/>vs IRCAD liver: mean 3.6 mm, p95 20 mm| AX[Rejected]
  B --> B1{Matches IRCAD? Board still works?}
  B1 -->|liver vs IRCAD: mean 0.60 mm, p95 1.43 mm;<br/>x-ray shows tumours/vessels inside a whole organ| BY[Chosen]
```

MSD has no overlapping masks (the labels are exclusive by definition), so `msd-liver`'s
liver surface is built from `labels in {liver, tumour}`. This changes the
`liver_39` bundle compared with Phase 2. The change is intended.

## D-P1-03 Which NIfTI header affine to trust

2026-11-05 · task 1.2 · proposed

```mermaid
flowchart TD
  Q{sform vs qform vs neither; units}
  Q --> A[nibabel default img.affine]
  Q --> B[Explicit policy: sform, else qform, else refuse;<br/>conflict refuses unless chosen; units to mm or refuse]
  A -->|silently invents a pixel-size affine when both codes are 0;<br/>no unit check| AX[Rejected]
  B --> B1{Accepts all real data?}
  B1 -->|all 50 MSD files: mm units, sform = qform;<br/>hepaticvessel_424 rebuild byte-identical to Phase 2| BY[Chosen]
```

## D-P1-04 Tracking in a worker: how, and default?

2026-11-05 · tasks 3.2, G5 · proposed · ADR [0005](0005-tracking-worker.md)

```mermaid
flowchart TD
  Q{Run MediaPipe in a worker?}
  Q --> A[Classic worker]
  Q --> B[Module worker]
  A -->|tasks-vision ships as an ES module| AX[Rejected]
  B --> B1{Measured: 'Module scripts don't support importScripts'}
  B1 -->|sync-XHR importScripts shim: CPU and GPU both run| B2[Built behind ?track=worker]
  B2 --> D{Make it the default?}
  D -->|headless: no jank on main, worker adds ~1 frame + drops;<br/>needs target-hardware numbers| DK[Not yet: keep main-thread default]
```

## D-P1-05 A camera restart froze the board

2026-11-05 · tasks 3.3, G3 · proposed

```mermaid
flowchart TD
  Q{After a simulated unplug and recovery, models could no longer be staged. Why?}
  Q --> F[Page error: MediaPipe 'ROI width and height must be > 0']
  F --> R[The video is 0x0 while the camera restarts;<br/>the uncaught throw ends the rAF frame loop]
  R --> X{Fix where?}
  X -->|stage.html frame loop| XA[Rejected: upstream zone]
  X -->|tracker wrapper: skip frames with no picture;<br/>a throw on one frame returns no hands| XB[Chosen: tracking.js noPicture]
```

The browser suite now stages a model **after** an unplug/recovery, which is what
caught this. The C-key camera switch opens the same 0×0 window. That's plausible
but not reproduced here (a single fake camera).

## D-P1-06 Lighting (2.2): change it?

2026-11-05 · task 2.2 · proposed, **pending your review of the contact sheet**

```mermaid
flowchart TD
  Q{Do scan bundles need different lighting?}
  Q --> M[Measure 20 renders: 5 models x solid/cut/isolate/x-ray]
  M -->|clip <= 0.43 %, crush 0 %, mean L 123-222| N[No lighting change]
  M --> S{What looks wrong then?}
  S -->|voxel staircase on 1-1.6 mm liver surfaces| G[Smoothing is refused by the 1 mm placeholder bound: a G2 tolerance decision, not lighting]
```
