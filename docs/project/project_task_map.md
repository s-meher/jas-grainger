# Project Task Map: Barehands Medical 3D Viewer

## Project Overview
**Goal:** A browser-based application allowing medical professionals to manipulate, slice, and identify 3D anatomical structures (liver, vessels, tumors) using only hand gestures via a webcam. No installations, headsets, or controllers required.
**Tech Stack:** Python 3 (Data Pipeline/Backend), Three.js/WebGL (Rendering), Google MediaPipe (Computer Vision), JavaScript/React or Vite (Frontend UI).
**Datasets:** 3D-IRCADb-01 (DICOM), MSD Task08 HepaticVessel (NIfTI), MSD Task03 Liver (NIfTI).

---

## Coder Roles & Responsibilities

*   **Coder 1: Data Pipeline & Backend Engineer (Python / Medical Data)**
    *   *Domain:* Python 3, `pydicom`, `nibabel`, `scikit-image`, `trimesh`, FastAPI/Flask.
    *   *Focus:* Processing raw DICOM/NIfTI files, extracting meshes and volumes, and serving these assets to the frontend.
*   **Coder 2: 3D Graphics Engineer (Three.js / WebGL)**
    *   *Domain:* JavaScript, Three.js, GLSL (Shaders), 3D Math (Matrices/Quaternions).
    *   *Focus:* Rendering the GLB meshes and NRRD volumes, setting up lighting, clipping planes, and raycasting geometry.
*   **Coder 3: Frontend, CV & UI Engineer (MediaPipe / Web App)**
    *   *Domain:* JavaScript/TypeScript (React/Vite), Google MediaPipe, Web Speech API.
    *   *Focus:* Hand tracking, gesture math (converting coordinates to commands), UI overlays, Text-to-Speech, and bridging the CV state to the 3D scene.

---

## Phase 1: Foundation & Data Ingestion (Weeks 1-2)

### Coder 1: Backend 
*   [ ] **Task 1.1: DICOM Sanitizer.** Write a Python script to unzip IRCADb datasets, recursively rename files to remove special characters, and sort files by `SliceLocation`/`InstanceNumber`.
*   [ ] **Task 1.2: NIfTI Loader.** Implement `nibabel` extraction for MSD datasets to access the 3D numpy arrays and affine matrices.
*   [ ] **Task 1.3: Isotropic Resampling.** Create a normalization function using `scipy.ndimage.zoom` to ensure all voxels are 1x1x1mm to prevent visual distortion.

### Coder 2: 3D Graphics
*   [ ] **Task 2.1: Scene Scaffold.** Initialize a basic Three.js scene (Canvas, WebGLRenderer, PerspectiveCamera, OrbitControls for initial mouse testing).
*   [ ] **Task 2.2: Lighting Rig.** Set up Ambient and Directional lighting optimized for organic, medical-looking surfaces (soft shadows, slight specular highlights).

### Coder 3: Frontend & CV
*   [ ] **Task 3.1: App Scaffold.** Set up the frontend architecture (e.g., Vite + React) and establish the project directory structure.
*   [ ] **Task 3.2: MediaPipe Init.** Integrate `HandLandmarker` via Web Workers to ensure video processing does not block the main UI thread.
*   [ ] **Task 3.3: Webcam Feed.** Build the UI component to request camera permissions and display the raw video feed in a small picture-in-picture corner.

---

## Phase 2: Asset Generation & Basic Rendering (Weeks 3-4)

### Coder 1: Backend
*   [ ] **Task 1.4: Surface Extraction.** Implement Marching Cubes (`scikit-image`) on segmentation masks to generate 3D vertices and faces.
*   [ ] **Task 1.5: Mesh Optimization.** Apply Laplacian smoothing and decimation to the meshes to ensure high framerates on the web.
*   [ ] **Task 1.6: GLB & NRRD Export.** Export surface meshes as `.glb` (via `trimesh`) and raw density data as `.nrrd` files.
*   [ ] **Task 1.7: Local Asset Server.** Create a simple FastAPI/Flask server to serve these static assets to the frontend locally.

### Coder 2: 3D Graphics
*   [ ] **Task 2.3: GLB Loading.** Implement `GLTFLoader` to ingest Coder 1's mesh files. Group the liver, tumors, and vessels into a single parent object.
*   [ ] **Task 2.4: Centering & Scaling.** Write logic to automatically compute the bounding box of the loaded datasets, center them at the scene's origin `(0,0,0)`, and scale them to a normalized view size.

### Coder 3: Frontend & CV
*   [ ] **Task 3.4: Gesture Math - Pinch.** Calculate Euclidean distance between thumb tip (Landmark 4) and index tip (Landmark 8). Create a boolean state for `isPinching`.
*   [ ] **Task 3.5: Gesture Math - Point.** Calculate finger extension logic (index straight, others curled) to trigger an `isPointing` state.
*   [ ] **Task 3.6: Bridging Coder 2 & 3.** Connect the `isPinching` state + hand movement delta (X/Y) to the Three.js parent object's rotation. (Replaces mouse OrbitControls with hand rotation).

---

## Phase 3: Advanced Mechanics (Weeks 5-6)

### Coder 1: Backend
*   [ ] **Task 1.8: Metadata Mapping.** Create a JSON mapping file that associates GLB mesh IDs with their anatomical names and brief pathology descriptions (to be used by the UI/TTS).

### Coder 2: 3D Graphics
*   [ ] **Task 2.5: Volumetric Rendering.** Implement a raymarching shader or use AMI.js to render the `.nrrd` density volume inside or alongside the surface meshes.
*   [ ] **Task 2.6: Slicing Plane.** Add `LocalClippingPlanes` to the Three.js materials. Expose a JavaScript function `setClipDepth(z)` that moves the plane through the organ.
*   [ ] **Task 2.7: Raycasting Logic.** Implement a `Raycaster`. Expose a function `castRay(x, y)` that returns the intersected sub-mesh (e.g., detecting if the pointer hits a tumor vs. the hepatic vein).

### Coder 3: Frontend & CV
*   [ ] **Task 3.7: Gesture Math - Slicing.** Map the Z-depth of a flat palm (or hand bounding box size) to call Coder 2's `setClipDepth(z)` function.
*   [ ] **Task 3.8: Gesture Math - Raycasting.** When `isPointing` is true, map the index fingertip's screen coordinates to Normalized Device Coordinates (NDC) and pass them to Coder 2's `castRay(x, y)`.

---

## Phase 4: UI, Audio, & Polish (Weeks 7-8)

### Coder 1: Backend
*   [ ] **Task 1.9: Pipeline Automation.** Refactor scripts so that dropping a new zipped DICOM/NIfTI dataset into a folder automatically runs the whole pipeline and outputs the GLB/NRRD/JSON bundle.

### Coder 2: 3D Graphics
*   [ ] **Task 2.8: Visual Polish.** Add post-processing (e.g., subtle bloom for UI highlights, antialiasing) and adjust material opacities for better internal visibility.
*   [ ] **Task 2.9: Memory Management.** Ensure proper disposal of Three.js geometries, materials, and textures when switching between datasets to prevent memory leaks.

### Coder 3: Frontend & CV
*   [ ] **Task 3.9: UI Overlays.** Build the clean, medical-grade UI layer displaying the current pathology case, instructions, and dynamic labels based on Raycaster intersections.
*   [ ] **Task 3.10: Text-to-Speech (TTS).** Hook into the Web Speech API. When the Raycaster hits an object, read its metadata name aloud (e.g., "Portal Vein"). Add debounce logic so it doesn't stutter.
*   [ ] **Task 3.11: Smoothing & Efficiency.** Apply Exponential Moving Average (EMA) or One Euro filters to the MediaPipe coordinate data to eliminate hand-tracking jitter before passing it to Three.js. 