---
name: gesture-tuning
description: Live tuning session for the HAND-DRIVEN cut gesture (js/medical/gesture.js) — the flat-palm incision and the two-finger retraction scrub. Every threshold in that file was written without a camera and is unfitted; this file walks an AI assistant through fitting them to the person in front of the webcam, using the P and G samplers and TROUBLESHOOTING.md's tuning clinic. Load it and run it interactively, with the person at the board. Do not skip phases. Do not guess a number.
version: 1.0
author: the barehands anatomy-education fork
---

# gesture-tuning: fitting the cutting hand

You are reading a system builder file. You, an AI assistant, will run it
live with the person at the board. Do not summarize it. Execute it.

## 0. The situation, stated honestly

Every gesture number in `stage.html` was fitted from real-hand samples.
**Every number in `js/medical/gesture.js` was not.** It was written by a
track with no webcam, on a machine where headless Chrome cannot boot
MediaPipe's tracker, so not one of its thresholds has ever seen a hand.
The math in that file is unit-tested (`scratch/cut-gesture-test.mjs`,
51 assertions: palm normals against known triangles, the screen→model
transform against known rotations, the spread metric, the whole
armed/disarmed state machine). The math is sound. The **numbers are
guesses with a pedigree** — each one names, in a comment, the shipped
gate whose proven range it was reasoned from.

So: do not tell the person the gesture works. Tell them you are going to
fit it to their hand, and that this will take about fifteen minutes.
Then run the phases below in order.

**The one rule, from TROUBLESHOOTING.md:** measure first, edit second.
Never move a threshold from theory. Sample the correct pose, sample the
impostor, find the metric whose ranges do not overlap, and cut
mid-canyon. If nothing separates them, change the pose you ask for — do
not stack another threshold.

---

## Phase 1: Get the board live and armed

1. Server up (`python3 server.py`), tracker open in **Chrome** at
   `http://127.0.0.1:8794/stage.html`, cursor following their hand.
2. Stage a model that has an `anatomy.json` sidecar:
   `bin/board.sh '{"a":"present","title":"Heart","src":"models/heart/heart.glb"}'`
3. Arm the cut — this is what loads `gesture.js` at all:
   `bin/board.sh '{"a":"cut","arm":1}'`
   The board should toast *"cut armed — flat-palm swipe across it to
   slice; two fingers spread to scrub the depth"* and the organ should
   already be showing its default axial cut.
4. Tell them the three keys they will be pressing:
   - **D** — the debug overlay (fps, pinch, claw flags).
   - **P** — the omni-sampler: the claw + pinch metric families.
   - **G** — the CUT sampler: the incision's own metrics. New in this
     file; it lives in `gesture.js`, so it only exists once a cut has
     been armed.
5. **Arming times out.** ~20 seconds with no cut activity and the board
   disarms itself ("cut mode timed out"). During a sampling phase that
   will happen constantly — that is correct behaviour, not a bug. Re-arm
   with the same command whenever you are about to test a live gesture.
   Sampling with **G** does not need the cut armed at all *(it does need
   `gesture.js` to have loaded once, so arm before the first G press)*.

## Phase 2: Read the instruments

Press **G**, hold one pose for 4 seconds, and the board toasts three
lines, each metric as `min–median–max`:

```
CUT   c8 <…> · c12 <…> · c16 <…> · c20 <…> · ext <…>
PLANE ns <…> · nd <…> · spread <…> · up <…>
GATES flat <…>% · scissors <…>% · frames <…>
```

| metric | what it is | reading it |
|---|---|---|
| `c8 c12 c16 c20` | per-finger CURL — identical to the P sampler's | ~+0.9 straight, ~0 bent, negative folded back |
| `ext` | how many fingers ARCH out past 1.45× their knuckle radius (upstream's own extFingers rule) | 4 = open hand, 2 = scissors, 0 = fist |
| `ns` | palm-normal STABILITY: this frame's normal dotted with the window's mean normal | 1.00 = a hand held perfectly flat; below ~0.9 the palm is wandering |
| `nd` | the same dot, frame to frame | the tracker's own jitter floor for this person's hand and lighting |
| `spread` | index-tip↔middle-tip gap ÷ span | the retraction scrub's one number |
| `up` | the CLAP's verticality read, recorded here but gated nowhere | >0.85 = fingers straight up = inside the clap's pose |
| `flat%` / `scissors%` | what fraction of the sampled frames the two gates ACCEPTED | the fastest read in the whole file: 100% = the gate takes this pose, 0% = it refuses it |

`flat%` and `scissors%` are your verdict line. A correct pose should
sample near 100%; an impostor should sample 0%. Everything below is
about moving a threshold until both of those are true at once.

---

## Phase 3: THE THREE IMPOSTOR PAIRS

This is the session. Each pair: sample the correct pose, sample the
impostor named with it, compare, cut mid-canyon, retest both.

### Pair 1 — the flat-palm incision vs. the CLAP's prayer approach

**Why they collide.** The clap (board reset) fires on two hands that are
both open (`softOpen`: ext ≥ 3), both vertical (`handUp > 0.85`), whose
wrists close inside 0.11 × window width having been 0.18 W apart in the
last 800 ms. An incision palm satisfies *"open"* by definition — it is
the same open hand. The only things standing between a cutting hand and
a board wipe are: the second hand, and verticality.

**Sample.** Both with **G**, one hand in frame:
- *correct:* the incision — flat palm, held as if slicing across the
  organ, and actually swiped.
- *impostor:* one hand held in the clap's approach pose — open, fingers
  straight up, as if about to clap.

**What you will find.** Curls and `ext` will NOT separate them; both are
open hands. The metric that separates is **`up`**: a prayer palm rides
0.85–1.0, a palm cutting across an organ rides lower (their number, not
mine — read it). `spread` and `ns` will not help either.

**What to do with it.**
- The veto that already exists is `PRAYER_VETO_W` (0.30 W) in
  `gesture.js`: while another OPEN hand is within that distance, an
  incision refuses to commit and toasts *"that read as a clap — cut with
  ONE hand"*. If the person cuts naturally with the other hand resting
  in frame and gets that toast, lower it toward the clap's own 0.18 W
  apart-distance. If a clap-shaped motion cuts the organ instead of
  resetting the board, raise it.
- **Scope note, say it out loud:** the reverse failure — the CLAP firing
  while they are cutting — cannot be fixed from `gesture.js`. The clap
  gate lives in `stage.html`, which the Gesture track may not edit. If
  that happens in the session, record it: the fix is a *"cut is armed"*
  disqualifier next to the clap's `recentPinch` disqualifier
  (`THE PRAYER LAW`, ~line 2740), and it belongs to whoever owns
  `stage.html`. In the meantime the honest instruction to the person is:
  **cut with one hand, keep the other out of frame.**

### Pair 2 — the flat-palm incision vs. the CLAW's open-hand flash

**Why they collide.** The claw (force-pull) arms only from a hand that
was OPEN in the last 900 ms — the transition law. A learner in cut mode
is holding an open flat palm more or less continuously, so the claw is
permanently one relaxation away from arming. The saving grace is that
the claw also refuses to arm while the cursor is over an item
(`!hitTest(cur)`), and a cutting hand is over the organ card by
definition; the exposure is the moment the hand relaxes *off* the card.

**Sample.** *correct:* the flat palm (**G**). *impostor:* their real
claw (**P** — the claw's own sampler line gives `c8 c12 c16 c20` in the
same units G reports, so the two are directly comparable).

**What you will find.** This is the easy pair, and the canyon is huge:
the flat palm's curls sit near +0.9, the claw's `c12` must be under 0.35
to arm at all. **`FLAT_CURL`** (currently 0.70) belongs in the middle of
that gap.

**The likely real failure here is the opposite one:** most people's
"flat" palm is not hyperextended, and their curls may sample 0.60–0.80.
If the incision never fires and `flat%` reads 0, this is why. Drop
`FLAT_CURL` to mid-canyon between *their* flat palm's minimum and *their*
claw's `c12` maximum, and re-sample both — the claw must still arm
afterwards, so retest the force-pull, not just the cut.

### Pair 3 — the two-finger scissors vs. the RELAXED hand

**Why they collide.** A hand at rest curls in a cascade: pinky most,
ring next, index and middle least. That is precisely the scissors'
signature — outer fingers folded, inner fingers out — at low contrast. A
scrub that engages off a resting hand would move the cut plane while the
person is talking with their hands.

**Sample.** *correct:* the scissors (index + middle out, ring + pinky
tucked into the palm), sampled at rest AND at full spread. *impostor:*
their hand simply relaxed, at their side of the board, doing nothing.

**What you will find.** The separator is contrast, not any single
finger: the scissors holds `c8`/`c12` high (straight) *while*
`c16`/`c20` are low. A relaxed hand drops all four together. Read four
numbers and place two thresholds:
- **`FLAT_CURL`** (0.70) is also the scissors' straight-finger bar for
  index and middle — mid-canyon between the relaxed hand's `c8`/`c12`
  maximum and the scissors' minimum.
- **`FOLD_CURL`** (0.35) / **`FOLD_ARCH`** (1.32) are the tuck bars —
  mid-canyon between the scissors' `c16`/`c20` maximum and the relaxed
  hand's minimum.

**Then fit the stroke.** With the scissors held, sample **G** twice more:
fingers together, then spread as wide as is comfortable. The two
`spread` medians are the person's usable stroke.
- `SPREAD_ENGAGE` (0.12) must be clearly inside that stroke — roughly a
  fifth of it — or the scrub either engages on a twitch or never engages
  at all.
- `SPREAD_RANGE` (0.55) is how much spread sweeps the cut from one edge
  of the organ to the other. Set it to about the width of their real
  stroke: too small and the plane leaps across the organ, too large and
  they run out of fingers before they reach the far side.

### The fourth pair, if it comes up

**The scissors vs. the PINCH.** A scissors has no thumb–index contact,
and the CONTRAST LAW needs `backMean − f8 > 0.18` with `backMean > 1.30`
— the scissors folds ring and pinky, which drags `backMean` under the
fist wall, so it should not read as a pinch. If it does anyway, do not
touch the pinch: over an armed model **THE SUSPENSION LAW** in
`gesture.js` already clears `cur.pinched` for that hand, and the correct
question is why suspension did not engage (see Phase 5).

---

## Phase 4: The thresholds, and where each one lives

All of them are at the top of `js/medical/gesture.js`, in one block,
each with a `PROVISIONAL` comment naming its pedigree. **When you change
one, rewrite its comment** with the evidence you just took — the ranges,
the person, the date. That is how every number in `stage.html` documents
itself, and it is the only way the next session knows what happened.

| constant | now | what it gates | move it when |
|---|---|---|---|
| `FLAT_CURL` | 0.70 | a finger reads STRAIGHT (incision + scissors) | the incision won't fire (down) · a relaxed hand cuts (up) |
| `FOLD_CURL` | 0.35 | ring/pinky read TUCKED | scissors won't engage (up) · a lazy hand scrubs (down) |
| `EXT_ARCH` | 1.45 | a finger reaches out — **upstream's own number, verbatim; leave it alone unless the P corpus says otherwise** | ~never |
| `FOLD_ARCH` | 1.32 | a finger is tucked | with `FOLD_CURL`, from the same samples |
| `STAB_DOT` | 0.93 | palm held flat across the whole swipe | **the least-founded number in the file** — set it from `ns` on a real swipe: a bit under their honest minimum |
| `FRAME_DOT` | 0.97 | frame-to-frame palm jitter | set from `nd`; it is a tracker-noise floor, not a pose |
| `TRAVEL_FRAC` | 0.55 | how far across the card the swipe must go | swipes die halfway (down) · idle drift cuts (up) |
| `SWIPE_MIN_MS` / `SWIPE_MAX_MS` | 120 / 1600 | a stroke, not a pop and not a drift | a slow deliberate cut gets dropped (raise MAX) |
| `CUT_COOL_MS` | 700 | no second incision inside the window | double-cuts on one stroke (up) |
| `SPREAD_ENGAGE` | 0.12 | deliberate travel before the scrub takes hold | from Phase 3's stroke |
| `SPREAD_RANGE` | 0.55 | spread that sweeps t across the whole organ | from Phase 3's stroke |
| `SPREAD_DIR` | +1 | wider = deeper | **if they report it backwards, flip this one character** |
| `OFFSET_GAIN` | 2.0 | where along the organ the swipe's midpoint lands the plane | cutting across the top halves it anyway (up) · cuts fly off the edge (down) |
| `PRAYER_VETO_W` | 0.30 | the clap veto | Pair 1 |
| `ARM_IDLE_MS` | 20 s, in `core.js` | how long a forgotten armed mode survives | it disarms mid-lesson (up) |

## Phase 5: Live symptoms → the checklist

Run these WITH the person, one at a time, re-arming before each test.

**"Nothing happens when I swipe."** In order:
1. Is it still armed? (`bin/board-state.sh`, or just re-arm.) The idle
   timeout is the most common answer.
2. **G** during the swipe: `flat%`. If 0 → Pair 2, drop `FLAT_CURL`.
3. `flat%` is high but no cut → `ns` on that same sample. If it dips
   below `STAB_DOT`, their swipe rolls the wrist (most people's does) —
   lower `STAB_DOT` toward their honest minimum, or ask for a stiffer
   wrist. Prefer lowering: the pose should fit the person.
4. Still nothing → travel. The swipe must cross `TRAVEL_FRAC` of the
   **card's on-screen width**, so a small, far-away model needs a
   proportionally small swipe and a big one needs a big swipe. Watch
   whether they are swiping across the *card* or across the *room*.
5. Do they get the *"that read as a clap"* toast? → Pair 1.

**"It cut, but along the wrong plane."**
- Perpendicular to what they meant → they were reading the palm's
  *facing*, not its plane. The plane IS the palm: fingers-up palm facing
  them cuts front-from-back; the same palm rolled edge-on (a karate
  chop) cuts left-from-right. Demonstrate, do not adjust.
- Mirrored (cut on the left when they swiped right) → the palm normal's
  sign chain. `palmNormal()` maps raw landmark axes to the card's world
  basis by negating all three (`toScreen` mirrors x; MediaPipe's y is
  down and its z grows away from the camera). That mapping is unit-
  tested but has **never been checked against a real camera**. If it is
  mirrored, the fix is in `palmNormal`, not in a threshold — and
  `scratch/cut-gesture-test.mjs` must be re-run after any change there.
- Right plane, wrong place along the organ → `OFFSET_GAIN`.
- Correct until they turn the model, then wrong → `toLocalDir`, the
  `sc.group` inverse. Re-run the harness; test 2 covers exactly this.

**"It grabbed/threw the organ instead of cutting."** Suspension did not
engage. It engages only once the hand has been seen OPEN inside the
card's rectangle (so arming can never rip an item out of a hand that was
already carrying it). If they arrive at the organ already pinched and
stay pinched, they grab. Have them open the hand first. If it still
grabs with an open hand over the model, the cursor is not inside the
card rectangle — check `cur.x/cur.y` against the card on the D overlay.

**"The scrub runs backwards / too fast / won't take."** `SPREAD_DIR`,
`SPREAD_RANGE`, `SPREAD_ENGAGE`, in that order. If the plane visibly
lurches rather than glides, that is the `SCRUB_MS` throttle (66 ms) —
raising it costs smoothness, lowering it costs frames, because every
scrub step repaints the model's cut caps.

**"The board reset itself mid-lesson."** The clap fired. Pair 1's scope
note. Record it; do not patch it from `gesture.js`.

## Phase 6: Close the session

1. Retest **both** halves of every pair you touched. The correct pose
   must fire; the impostor must not. A threshold that only fixed one
   direction has not been fitted, it has been moved.
2. Re-run the math harness — it must still be 51/51:
   `node scratch/cut-gesture-test.mjs`
3. Make sure every number you changed carries its new comment: the
   ranges you sampled, whose hand, what date. Delete the word
   `PROVISIONAL` from any threshold you actually fitted — that word is
   the file's honesty marker and it should shrink as the session
   succeeds.
4. Tell the person plainly which gates are now fitted to them and which
   are still guesses. If a pose pair never separated cleanly, say so and
   propose a different pose rather than a tighter number. That is the
   clinic's last rule and it is the one that keeps this file honest.
