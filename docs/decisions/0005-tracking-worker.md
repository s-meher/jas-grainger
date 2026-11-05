# ADR 0005: Hand tracking on the main thread vs in a worker

- **Status:** proposed. **The default stays main-thread** until the target-hardware measurement is in.
- **Date:** 2026-11-05
- **Tasks:** 3.2, G5
- **Deciding reviewers:** UI owner, using numbers from the Phase 1 webcam session

## Context
`stage.html` runs MediaPipe `detectForVideo` inside its requestAnimationFrame
loop. If detection takes longer than about 16 ms, it delays rendering and
gestures. plan.md 3.2 asks for a worker prototype with backpressure and a
fallback, measured before anyone adopts it.

## What was built
- `?track=worker`: a module worker runs the same pinned HandLandmarker.
  - Frames are sent as transferred ImageBitmaps.
  - **Backpressure:** one frame in flight; newer frames are dropped, never queued.
  - The worker result is returned on the next video frame (about one frame of extra latency).
  - If the worker fails to start, the board stays on the main thread.
- tasks-vision's wasm loader needs `importScripts`, which module workers don't
  have. A sync-XHR shim was **measured** to make it work on CPU and GPU.
- GPU→CPU fallback for either mode.
- `?perf=1`: frame interval, detection ms, result age, dropped frames, and
  frames skipped with no picture.

## Measurements so far (headless Chrome, fake camera, no hands. NOT target hardware)

| Mode | frame p50 / p95 ms | long frames | detect avg ms | result age p95 ms | dropped |
| --- | --- | --- | --- | --- | --- |
| main | 16.7 / 16.8 | 1.3 % | 13.6 | 13.6 | 0 / 73 |
| worker | 16.7 / 16.7 | 1.1 % | 16.1 | 16.1 | 11 / 83 |

Reading these numbers:
- Headless detection with no hands costs about 14 ms. At that cost the main
  thread still holds 60 fps, so the worker shows no jank benefit here. It does
  add drops and about one frame of latency.
- Real hands trigger the landmark model on top of palm detection, on real
  hardware with a real camera. That is the case this ADR has to decide on.

## Decision rule (to apply in the webcam session)
Adopt the worker as the default only if, on the target machine with two hands moving:
- main-mode `long_frames_pct` > 5 % or frame p95 > 25 ms, **and**
- worker mode brings frame p95 under 20 ms with result age p95 < 50 ms.

Otherwise keep main-thread and leave `?track=worker` as an option.
