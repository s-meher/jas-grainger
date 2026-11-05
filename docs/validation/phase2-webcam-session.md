# Phase 2 webcam session: protocol and results sheet

Fill this in during one sitting (about 30–40 min). It is the manual acceptance
evidence for 3.4, 3.5 and 3.6, and it decides open item 3.4-1. Copy it to
`docs/validation/YYYY-MM-DD-phase2-webcam.md`, fill in the **Result** columns,
and hand it back. Keep screen recordings local, never in Git: some content
on screen is scan-derived.

## 0. Session info

| Field | Value |
| --- | --- |
| Date / tester | |
| Commit (`git rev-parse --short HEAD`) | |
| Computer / OS / Chrome version | |
| Camera (built-in / USB model), resolution | |
| Lighting (window behind you? overhead?) | |
| Distance from camera to hands (approx.) | |
| FPS shown in the debug overlay (press D) | |

## 1. Setup (once)

```bash
cd ~/jas-grainger && git switch feat/phase2-m2 && git pull
cp -n barehands.json.example barehands.json
export JAS_DATA_ROOT="$HOME/Library/CloudStorage/GoogleDrive-amohammed20@hawk.illinoistech.edu/My Drive/NOVA-data"
~/.venvs/jas/bin/python -m pipeline.build --dataset msd-hepaticvessel --case hepaticvessel_424 --out media/local/hepaticvessel_424
python3 server.py                      # terminal 1, leave it running
```

Open **http://127.0.0.1:8794/stage.html** in Chrome, allow the camera, and wait
for the board. Press **D** to show the debug overlay, which shows the hand
count, the pinch ratio and OPEN/CLOSED.

In terminal 2, stage the test model and start a watcher for what the board
reports:

```bash
bin/board.sh '{"a":"hand","src":"local/hepaticvessel_424/model.glb"}'
while true; do clear; bin/board-state.sh | tail -4; sleep 0.5; done
```

## 2. Checks

Count attempts honestly: a "miss" is any try that didn't do what you meant.
Pass targets are starting proposals for G5. Write down what actually happens.

### A. Loading (2.3 / 2.4)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| A1 | Look at the staged model | Blue vessels plus a yellow tumour, plus a small red/green/blue axis marker at one corner | |
| A2 | `bin/board.sh '{"a":"hand","src":"models/phantom/model.glb"}'` | An L-shaped block appears | |
| A3 | `cp -R media/models/phantom media/local/bad && printf 'x' >> media/local/bad/model.glb`, then `bin/board.sh '{"a":"hand","src":"local/bad/model.glb"}'` | A "3D failed … hash" toast; **no** model appears | |

### B. Pinch (3.4). Do each with the right hand, then the left.

| # | Do | Expect / target | Right | Left |
| --- | --- | --- | --- | --- |
| B1 | 10× deliberate pinch (OK-sign) on the model, carry it a little, open | ≥ 9/10 grab and release | /10 | /10 |
| B2 | 10× make a **fist** over the model (fingers facing the camera) | 0 grabs | /10 | /10 |
| B3 | Pinch, then open your fingers only halfway | Still held (hysteresis) | | |
| B4 | Pinch-drag fast across the screen 5× | It never drops mid-drag | /5 | /5 |
| B5 | **3.4-1:** hand pointing sideways (palm to the camera), make a fist over the model 10× | 0 grabs. **Any grab here confirms 3.4-1** | /10 | /10 |
| B6 | Hand pointing sideways, OK-sign pinch 10× | ≥ 9/10 grab | /10 | /10 |

### C. Tracking loss (G3-1) and handedness (3.5-1)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| C1 | Hold the model and sweep your other hand in front of the holding hand for under ½ s | The model stays where it is; the cursor dims grey, then recovers and you keep the grip | |
| C2 | Hold the model, then drop that hand out of frame for 2 s | The model stays put and is released after about ½ s. **No** throw, and nothing opens or closes | |
| C3 | Hold the model in your RIGHT hand; bring your left hand in and out of frame 5× | The right hand keeps the model every time | /5 |
| C4 | Same with the hands swapped (hold in LEFT) | The left hand keeps it | /5 |
| C5 | Rough feel: is the ½ s freeze too long, too short or fine? | Note for `LOST_GRACE_MS` | |

### D. Rotate, scale, reset, mouse (3.6)

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| D1 | Pinch the model and hold still about 1 s | "spin mode" toast; moving your hand turns it | |
| D2 | Pinch with both hands, then spread or close them | It scales smoothly and stays between your hands | |
| D3 | Press **R** | The board respawns | |
| D4 | Mouse: drag the model | It moves | |
| D5 | Mouse: Shift-drag (or right-drag) | It rotates | |
| D6 | Mouse: scroll the wheel over it | It scales | |
| D7 | Mouse: double-click it | Its rotation and scale reset | |
| D8 | Hold it with a hand and try to mouse-drag it | The mouse is ignored while the hand holds it | |

### E. Pointing (3.5), watched in terminal 2

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| E1 | Open hand, fingertip still on the tumour | `POINTING AT: liver_tumor` within about 1.5 s | time: |
| E2 | Same on a vessel | `POINTING AT: hepatic_vessel` | |
| E3 | Sweep an open hand across the model without stopping | No POINTING line | |
| E4 | While pointing, pinch | The POINTING line disappears | |
| E5 | While pointing, take both hands out of frame | The POINTING line disappears within about 1 s (G3-2) | |
| E6 | One hand resting on the tumour, the other on a vessel | `POINTING: ambiguous between …` (3.5-2) | |
| E7 | Wrong-structure count over 10 deliberate points | 0 wrong names | /10 |

### F. Regression: the existing cut on the heart

| # | Do | Expect | Result |
| --- | --- | --- | --- |
| F1 | `bin/board.sh '{"a":"hand","src":"models/heart/heart.glb"}'`, press **X**, flat-palm swipe | The heart is cut as before | |

## 3. Notes

Anything odd: false grabs, jitter, lag, lighting effects, what felt wrong.

## 4. Sign-off

| Item | Decision |
| --- | --- |
| 3.4 pinch accepted? | |
| 3.4-1 confirmed (any B5 grab) or closed (0/20)? | |
| 3.5 point accepted? | |
| 3.6 manipulation + mouse accepted? | |
| G3-1 grace (keep 500 ms / change to ___ ms)? | |
