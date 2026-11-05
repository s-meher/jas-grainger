# tests — the heart acceptance suite

For Windows prerequisites and commands, see
[`docs/nova-integration.md`](../docs/nova-integration.md#validation).
The visual suite accepts a `CHROME` executable override; the contract suite
accepts a `BASH` executable override on Windows.

Two scripts, no dependencies beyond the stdlib (plus Pillow for the visual
one). **The server must be running** (`python3 server.py`); both drive the
live board on 127.0.0.1:8794 and drain the state bus when they finish.

```
python3 tests/test_contract.py     # ~97 assertions, ~5 seconds
python3 tests/test_visual.py       # 17 renders + a contact sheet, ~5 minutes
```

## test_contract.py — everything that can be judged without eyes

Exit code 0 means every assertion passed (97 when a local `barehands.json`
exists; one config check is skipped otherwise). It covers:

- **Every medical verb's valid forms** (204) and **every malformed argument
  class** (400): bad enums, a zero-length plane normal, an out-of-range
  origin, non-numeric numbers, ids with the wrong case or punctuation or
  length, an over-cap label list, `off` values other than `1`.
- **The airlock**, which must never widen: parent escapes, absolute paths,
  and deep traversal all 400. Note the deliberate case —
  `{"src": "heart.glb"}` **400s**, because every organ exists twice (in
  `models/` and `holo/`), so a bare organ basename is ambiguous by design
  and the self-heal must refuse rather than guess.
- **Answer isolation**: `/case-render` is checked not just for the absence
  of the private *field names* but for the absence of the answer *text* —
  every accepted diagnosis phrasing, the vignette, and each lesion's
  `finding` are grepped for in the response body.
- **Asset serving (1.7)**: `.glb`/`.json`/`.nrrd` content types, and the
  git-ignored research areas (`data/`, `artifacts/`, `private-data/`), `.git/`
  and `barehands.json` 404 for GET and HEAD under every URL spelling tried
  (`..`, `%2e%2e`, `//`, query strings). Real probe files are created and
  removed so a 404 means refused, not absent.
- **The sidecar**: `validate.py` on both the anatomy/GLB pair and the case,
  plus structural checks the validator doesn't make — no dangling
  parent/child/`connects` references, every alias resolving, every
  structure carrying a `teach.function` and at least one source.
- **`board-state.sh`**: that it reports cut/isolate/hide/label state and the
  `POINTING AT:` line, and — just as important — that a plain non-medical
  item produces no medical noise at all.

## test_visual.py — the render layer, one contact sheet

Posts synthetic heartbeats to `/state` and screenshots the OBS render page
(`?role=render`) once per state, then tiles them into
`tests/_shots/heart-visual-matrix.png` so a whole regression is one image.

Covers baseline, labels (a few and the 12-cap), isolate, hide, x-ray with and
without focus, layer depth, all three cut presets, a custom cut plane, the
lesion tint, a cut+lesion+label combination, and teardown.

**Reading the results:** rendering is deterministic — two identical states
are pixel-identical — so any difference between two frames of the same state
is meaningful. Two caveats learned the hard way:

- **The first frame of a run renders differently** (page/GL warm-up), which
  is why the script throws one away before measuring. A frame that
  disagrees with an otherwise-reproducible reference is usually a capture
  transient; confirm by re-rendering the same state rather than assuming a
  state leak.
- **A connected tracker owns the state bus.** It posts its own scene
  ~45x/sec, so a synthetic state injected by a test survives about 22ms.
  The board-state checks detect this and report SKIPPED rather than
  failing — close or background the barehands tab to run them. The same
  applies to any manual `curl` against `/state`, and it is why you cannot
  simulate a pointing hit while the board is open.
- **Use hardware ANGLE, not SwiftShader.** SwiftShader cannot compile the
  cut's stencil programs inside the screenshot budget and silently renders
  an uncut model. Just omit `--use-angle=swiftshader`.

## What these do NOT cover

The tracker page cannot boot headlessly — MediaPipe's hand tracker needs a
real camera, and upstream's unmodified page fails the same way, so this is
environmental rather than a regression. That leaves two things only a human
at the webcam can verify:

1. **Pointing** — hold an open finger on a structure, run
   `bin/board-state.sh`, and check the `POINTING AT:` line names the right
   one. If it names the mirror-image structure, `core.js` carries a marked
   one-line fix at the exact spot.
2. **The gesture thresholds** — every number in `js/medical/gesture.js` is
   provisional, fitted to no real hand. `skills/gesture-tuning/SKILL.md`
   runs the live clinic.

## test_pinch_point.mjs: verifying the existing pinch, point and manipulation (3.4–3.6)

```
node tests/test_pinch_point.mjs    # no server, no browser, ~10 s (pointing dwells in real time)
```

It slices the exact pinch-classifier, rotate and stretch code out of
`stage.html` between fixed anchor lines, so there is no copy to drift. If an
anchor moves, the suite fails. It drives that code with synthetic 21-point
hands (open, OK-sign, fist; scaled, moved, tilted, mirrored, sideways).
Pointing goes through `core.js`'s real `cursorFrame` against a stub scene.
`XFAIL` lines are **known gaps**, recorded in
`docs/validation/2026-11-04-3-4-3-6-gestures.md`. They don't fail the run,
and a fix shows up as `XPASS`.
