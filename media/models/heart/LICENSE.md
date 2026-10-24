# heart.glb — License and Provenance

## Model
**Human Heart (multi-part assembly)** — chambers, great vessels, coronary
arteries, coronary sinus, and cardiac valves, assembled as 16 separately
named meshes from segmented anatomical surface data.

## Source
**BodyParts3D** — The Database Center for Life Science (DBCLS), Japan.
- Project / database home: https://lifesciencedb.jp/bp3d/
- Download page (data used): https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Data file used: `partof_BP3D_4.0_obj_99.zip` (PART-OF tree structure, OBJ
  format, 99% polygon-reduced export), specifically the OBJ "element" files
  belonging to the FMA (Foundational Model of Anatomy) concepts listed below,
  per the official ID-correspondence table
  `partof_element_parts.txt` (concept id → English name → element file id).
- Original author/creator credited by the database: Kousaku Okubo (BodyParts3D).

## License
**Creative Commons Attribution 4.0 International (CC-BY 4.0)**
https://creativecommons.org/licenses/by/4.0/

Per the BodyParts3D license page (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html,
"Last updated: 2025/02/27"), the current license for this database is CC-BY
4.0 International, and the required attribution is:

> "BodyParts3D, © The Database Center for Life Science licensed under CC
> Attribution 4.0 International"

Note: the individual OBJ element files themselves still carry an older
in-file header referencing "Creative Commons Attribution-Share Alike 2.1
Japan" (the license in effect at the time those files were generated,
2011–2013). The database's live license page supersedes this and now states
CC-BY 4.0 International. Either license is compatible with attribution-only
redistribution and modification; this project attributes under the current
(CC-BY 4.0) terms stated by the licensor.

**Download date of source data:** 2026-08-20

## Modifications made for this project
1. Downloaded `partof_BP3D_4.0_obj_99.zip` and the accompanying
   `partof_element_parts.txt` / `partof_parts_list_e.txt` ID-correspondence
   tables from the BodyParts3D archive.
2. Selected 16 FMA concepts relevant to the heart (see mesh list below) and,
   for each concept, concatenated its constituent OBJ "element" files
   (BodyParts3D represents each anatomical concept as a set of one or more
   element meshes) into a single named object group per concept, using a
   Python script (vertex/face index remapping only — no geometry was
   altered at this step).
3. Converted the combined multi-object OBJ to glTF binary (.glb) using
   `obj2gltf` (no textures/materials were present or added; geometry only).
4. Ran `gltf-transform weld` to merge coincident vertices.
5. Ran `gltf-transform simplify --ratio 0.75 --error 0.0015 --lock-border true`
   (meshoptimizer-based decimation, border-locked to preserve part seams) to
   bring the model from 171,314 triangles down to 130,464 triangles, under
   the project's 150k triangle budget. No Draco or meshopt runtime
   compression extensions were applied — output is plain glTF, compatible
   with a plain `GLTFLoader`.
6. Ran `gltf-transform prune` to remove unused data.
7. No color/material/texture information was added; meshes are plain
   untextured geometry, one mesh per named anatomical part, intended for
   the Renderer/Pathologist tracks to assign materials, colors, and
   explode-view offsets per part.
8. Copied the resulting `heart.glb` unchanged into both
   `media/models/heart/heart.glb` and `media/holo/heart/heart.glb`.

No other content (textures, rigging, animation) was added or removed beyond
what is described above. Vertex coordinates are unmodified from the source
data (millimeters, original BodyParts3D whole-body coordinate frame).

## Mesh / node list (16 named parts, verbatim, in scene order)
1. `right_atrium` — FMA7096
2. `left_atrium` — FMA7097
3. `right_ventricle` — FMA7098
4. `left_ventricle` — FMA7101
5. `ascending_aorta` — FMA3736
6. `aortic_arch` — FMA3768
7. `pulmonary_trunk` — FMA8612
8. `superior_vena_cava` — FMA4720
9. `inferior_vena_cava` — FMA10951
10. `right_coronary_artery` — FMA50039
11. `left_coronary_artery` — FMA50040
12. `coronary_sinus` — FMA4706
13. `tricuspid_valve` — FMA7234
14. `mitral_valve` — FMA7235
15. `aortic_valve` — FMA7236
16. `pulmonary_valve` — FMA7246

## Stats
- Triangles: 130,464
- Meshes / nodes: 16 (one mesh per node, all under a single scene)
- File size: 1,574,064 bytes (~1.5 MB)
- Materials/textures: none (untextured geometry)
