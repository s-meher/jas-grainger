# Phase 1 session: protocol and results sheet (about 45 min)

This is the manual evidence for 2.1, 2.2, 3.2 and 3.3. The automated suites
already cover the plumbing (`tests/test_tracker_browser.py`, 18 checks, using a fake
camera). This session covers what only a real camera, real hands and your eyes
can judge.

Copy this file to `docs/validation/YYYY-MM-DD-phase1-session.md`, fill in the
**Result** cells, and hand it back. Keep screenshots and recordings local;
scan-derived content must not go in Git.

## 0. Session info

| Field | Value |
| --- | --- |
| Date / tester | |
| Commit (`git rev-parse --short HEAD`) | |
| Computer, OS, Chrome version | |
| Camera(s) (built-in / USB model) | |
| Lighting | |

## 1. Setup

```bash
cd ~/jas-grainger && git fetch && git switch feat/phase1-m1 && git pull
~/.venvs/jas/bin/pip install -r pipeline/requirements.txt
export JAS_DATA_ROOT="$HOME/Library/CloudStorage/GoogleDrive-amohammed20@hawk.illinoistech.edu/My Drive/NOVA-data"
~/.venvs/jas/bin/python -m pipeline.build --dataset ircadb --case 3Dircadb1.13 --out media/local/ircadb_13
python3 server.py                                  # terminal 1
```

## 2. The new data (1.1). This is what you were missing.

```bash
bin/board.sh '{"a":"hand","src":"local/ircadb_13/model.glb"}'
```

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| D1 | Look at it | One model: brown liver, blue portal vein, a vena cava, a red artery, plus a small RGB axis marker | |
| D2 | `bin/board.sh '{"a":"xray","focus":"liver_tumor_01"}'` | See-through liver; yellow tumour(s) and the vessel tree inside it | |
| D3 | Press **X**, then flat-palm swipe through it | It cuts open. (If not: say exactly what happened; this is the "can't cut the liver" report) | |
| D4 | Point an open hand still at the tumour | `bin/board-state.sh` shows `POINTING AT: liver_tumor_01` | |

## 3. Lighting and appearance review (2.2), about 10 min

Run `python3 tests/test_lighting_matrix.py` (server running) and open
`tests/_shots/lighting/lighting-matrix.png`.

| # | Question | Your answer |
| --- | --- | --- |
| L1 | Heart: does anything look different from before? (it shouldn't) | |
| L2 | Scan livers: are surfaces readable in solid, cut, isolate and x-ray? | |
| L3 | The liver shows a "staircase" (the 1–1.6 mm CT slices). Smoothing it away moves the surface ~1 mm, which is over today's placeholder limit. Keep it faithful, or allow a smoother display mesh? | keep / smooth |
| L4 | Colours: tumour yellow, veins blue, artery red, liver brown. OK? | |

## 4. Camera states (3.3)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| C1 | Press **V** | Camera picture disappears, a "preview hidden" note appears, and **hands still track** | |
| C2 | Press **V** again | Picture back | |
| C3 | Press **K** (if you have 2 cameras: pick the other with its number) | A list of cameras by name; the current one ticked; switching works | |
| C4 | **Unplug** the USB camera (or close the lid) for ~5 s, then reconnect | A "Camera disconnected" banner; it resumes **by itself** after reconnecting, and models can still be grabbed and staged | |
| C5 | Open FaceTime/Photo Booth first (camera busy), then reload the stage | A "camera is in use by another app" screen + Retry. Close FaceTime, press Retry, and it starts | |
| C6 | Chrome address bar → camera icon → **Block**, then reload | A "Camera access is blocked" screen with how-to + Retry. Allow, Retry, and it starts | |

## 5. Tracker performance (3.2), about 10 min

Open each URL in turn. Move **both hands** for ~30 s, then copy the four lines
from the bottom-right overlay.

| Mode | URL | frame p50 / p95 | long % | detect avg / p95 | result age p95 | dropped |
| --- | --- | --- | --- | --- | --- | --- |
| main | `http://127.0.0.1:8794/stage.html?perf=1` | | | | | |
| worker | `http://127.0.0.1:8794/stage.html?perf=1&track=worker` | | | | | |

| # | Question | Answer |
| --- | --- | --- |
| P1 | Does grabbing feel different between the two? (laggy / same / smoother) | |
| P2 | Overlay line 1 says GPU or CPU? | |

ADR 0005's rule: the worker becomes the default only if main has long frames
over 5 % (or p95 over 25 ms) **and** the worker fixes that with a result age p95
under 50 ms.

## 6. Baseline (2.1)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| B1 | Heart: grab, hold-still rotate, two-hand scale, R reset | As before | |
| B2 | Mouse: drag, Shift-drag, wheel, double-click on a model | Move / rotate / scale / reset | |

## 7. Sign-off

| Item | Decision |
| --- | --- |
| 1.1 IRCADb model accepted for teaching use? | |
| 2.2 lighting OK? Staircase: keep or smooth? | |
| 3.2 default stays main-thread (or adopt worker per ADR 0005)? | |
| 3.3 camera states accepted? | |
