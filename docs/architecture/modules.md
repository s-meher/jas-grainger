# Browser module boundaries (task 3.1)

Status: describes the code as built on `feat/phase1-m1`, 2026-11-05.
Decision record: [ADR 0001](../decisions/0001-frontend-modules-no-bundler.md),
which keeps vanilla JS plus an import map with no bundler. Keep this file in step
with any change to a `MED.*` hook or a `js/medical/*` export.

## The two zones

| Zone | Files | Rule |
| --- | --- | --- |
| **Upstream barehands** | `stage.html` (one page, one inline module) | Owned by the Renderer track. Medical code enters **only** as `MED.fn?.(...)` calls on lines marked `MEDICAL HOOK`. Every call is optional, so if a medical module fails to load, the board behaves exactly as upstream does. |
| **Medical layer** | `js/medical/*.js` (ES modules, no build step) | All anatomy, scan, camera and tracking additions. stage.html imports only `core.js`; core.js re-exports what the page needs. |

Third-party code is pinned in the page's import map / URLs: three.js `0.160.0`,
`@mediapipe/tasks-vision` `0.10.14`, plus the hand model `.task` file (float16/1).
All of it loads from public CDNs, so the browser needs network on first load (G4).

## Modules

| Module | Owns | Exports used by stage.html (via core.js) |
| --- | --- | --- |
| `core.js` | sidecar loading, mesh→structure index, medical state, verbs, pointing, state-bus (de)serialization; read-only `structureName`/`boardInfo` views for the HUD | `onModelLoaded`, `tick`, `onDispose`, `handles`, `applyCmd`, `toggleArm`, `armedScene`, `stillModel`, `hitRect`, `cursorFrame`, `itemState`, `pointState`, `applyRemote`, `installHud` + re-exports below |
| `gesture.js` | armed-cut hand geometry (palm plane, swipe, spread) | (imported lazily by core.js) |
| `render.js` | cut planes/caps, x-ray, isolate/hide, labels | (imported lazily by core.js) |
| `bundle.js` | jas-bundle/1 verification before parse; mm view transform (2.3/2.4) | `bundleFor` |
| `interaction.js` | tracking-loss freeze, handedness slots, mouse fallback, shared `resetPose` (G3/3.5/3.6/3.9) | `holdLost`, `foundCursor`, `handSlots`, `installMouse` |
| `camera.js` | camera error screens + Retry, unplug recovery, picker, preview privacy (3.3) | `bootFailed`, `watchCamera`, `cameraMenu`, `togglePreview` |
| `tracking.js` | GPU→CPU fallback, `?track=worker`, `?perf=1`, empty-frame guard (3.2) | `createLandmarker`, `wrapTracker` |
| `track-worker.js` | the MediaPipe worker (module worker + `importScripts` shim) | — (loaded by tracking.js) |
| `hud.js` | demo overlay: whitelisted model/case state, pointed name, mode, tracking, speech; M/N/H keys, Reset pose (3.9) | — (loaded lazily by core.js `installHud`) |
| `speech.js` | browser speech: dwell/cooldown narrator, Web Speech adapter, voice choice (3.10, ADR 0006) | — (imported by hud.js) |
| `smoothing.js` | One Euro cursor filter, opt-in `?smooth=oneeuro` in place of the EMA (3.11) | `smoothCursor` |

## Hook points in stage.html

There are 27 `MED.*` calls (25 distinct hooks) in all. Search `MEDICAL HOOK` to find them.

| Phase of the page | Hooks |
| --- | --- |
| Boot | `createLandmarker`, `wrapTracker`, `togglePreview` (restore), `bootFailed` (in boot's catch), `installMouse` (before boot), `installHud` (tracker page only) |
| Camera | `watchCamera` (in `startCam`), `cameraMenu` (K), `togglePreview` (V) |
| Model load / dispose | `bundleFor` (before parse, in `buildModelScene`), `onModelLoaded`, `onDispose` |
| Every frame | `handSlots`, `foundCursor`, `smoothCursor` (no-op unless `?smooth=oneeuro`), `cursorFrame`, `holdLost`, `tick`, `stillModel` |
| Commands / state bus | `handles`, `applyCmd`, `itemState`, `pointState`, `applyRemote`, `armedScene`, `toggleArm` (X), `hitRect` |

## Rules for new code

1. A new capability goes in `js/medical/<name>.js` and is reached through one optional hook.
   A hook must never be required for the board to boot.
2. Pure logic gets a pure exported function (e.g. `explainCameraError`, `handSlots`,
   `verifyBundle`), so the node suites can test it without a browser.
3. `tests/test_gesture.mjs` and `tests/test_pinch_point.mjs` copy **every** `js/medical/*.js`
   into a sandbox. A new static import in core.js needs no harness change.
4. A framework, bundler or backend migration needs an ADR with measured evidence
   (AGENTS.md); ADR 0001 records why there is none today.
