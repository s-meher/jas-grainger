/* barehands, anatomy edition — THE CUTTING HAND.
 *
 * The hand-driven half of the `cut` verb: the learner slices the organ
 * along a plane THEY choose, with a flat-palm swipe, and scrubs how deep
 * it goes by spreading two fingers. core.js owns the state; this file is
 * nothing but hand math and a state machine, and it never touches
 * sc.med.st directly — every edit leaves through core's cutFromGesture()
 * so the hand's cut and the assistant's cut are the same verb.
 *
 * THE ARMING LAW. None of this runs until an assistant says
 * {"a":"cut","arm":1}. That is not politeness, it is the false-positive
 * defense: while armed, core suspends the grab vocabulary over that one
 * model (THE SUSPENSION LAW below), so the cutting hand physically cannot
 * also grab, throw or explode-scrub the organ. Upstream's v13 dissolved
 * its zone conflicts the same way — by removing the ambiguity, not by
 * stacking one more fragile threshold on top of it.
 *
 * ===================================================================
 * EVERY THRESHOLD IN THIS FILE IS PROVISIONAL — NOT FITTED TO A REAL
 * HAND. Unlike every other number in this codebase, none of these came
 * out of a P-sample: the track that wrote them had no webcam, and
 * headless Chrome cannot boot MediaPipe's tracker. Each one carries a
 * `PROVISIONAL` comment naming the shipped gate whose proven range it
 * was reasoned from. They are starting points for a live session, not
 * evidence. Run skills/gesture-tuning/SKILL.md with a real hand before
 * believing any gesture here "works". The MATH is unit-tested; the
 * NUMBERS are guesses with a pedigree.
 * ===================================================================
 *
 * Contracts: schemas/verbs.md (`cut`: plane/t/arm/off),
 *            js/medical/render.js applyCut() (the {o,n} custom plane).
 */

import { toast, armedScene, cutFromGesture, noteCutActivity } from "./core.js";

// ------------------------------------------------------------ the gates
// (every constant below: PROVISIONAL — not fitted to a real hand)

// A finger reads STRAIGHT. Same curl metric as the claw's v3.4 gate (the
// dot of the distal segment against the proximal one, measured in 3D so
// foreshortening can't fake it). PROVISIONAL 0.70 — the glossary puts a
// straight finger at ~+0.90 and the claw's ENTER ceilings sit at
// c8<0.60 / c12<0.35 / c16<0.55; 0.70 clears the loosest claw ceiling
// with margin and still sits below a truly straight finger. Expect the live
// session to move it: a relaxed hand's curls were never sampled up here.
const FLAT_CURL = 0.70;
// A finger reads FOLDED (the scissors' ring + pinky). PROVISIONAL 0.35 —
// borrowed whole from the claw's c12 enter bar, the most-fitted fold
// number in the codebase.
const FOLD_CURL = 0.35;
// Arch ratio (tip-from-wrist ÷ knuckle-from-wrist) for "this finger
// reaches out" — 1.45 is upstream's own extFingers rule, verbatim.
const EXT_ARCH = 1.45;
// ...and for "this finger is tucked". PROVISIONAL 1.32 — the pinch
// corpus put every fist's folded fingers at ≤1.24 and every reaching
// finger at ≥1.45; 1.32 is that canyon's midpoint.
const FOLD_ARCH = 1.32;

// The palm plane held STILL across the swipe. dot of this frame's palm
// normal against the swipe's running mean. PROVISIONAL 0.93 (≈21° of
// total wander) — no shipped gate measures normal stability, so this one
// has no pedigree at all; it is a first guess sized to allow a natural
// wrist arc while rejecting a hand that turns over mid-sweep. THE most
// likely number to be wrong in this file.
const STAB_DOT = 0.93;
// ...and frame to frame, which catches jitter the running mean absorbs.
// PROVISIONAL 0.97 (≈14° in 33ms).
const FRAME_DOT = 0.97;

// Genuine travel: the swipe must cross a real fraction of the model's own
// card, so the fraction is scale-proof (the clap's fractions-of-innerWidth
// idiom, applied to the card instead of the window). PROVISIONAL 0.55.
const TRAVEL_FRAC = 0.55;
const SWIPE_MIN_MS = 120;      // PROVISIONAL — ~4 frames at 30fps: below
                               // this it is a tracking pop, not a stroke
const SWIPE_MAX_MS = 1600;     // PROVISIONAL — past this the anchor
                               // re-seats: a slow drift is not an incision
const POSE_GRACE_MS = 200;     // one-frame pose dropouts don't kill a
                               // swipe (the claw's fp.lost 300ms idiom)
const CUT_COOL_MS = 700;       // PROVISIONAL — no second incision inside
                               // this window (the clap's cooldown idiom)

// The two-finger spread, as index-tip↔middle-tip gap ÷ span (the claw's
// tipGap/span idiom). PROVISIONAL: fingers together ride ~0.15, a wide V
// ~0.80, so the usable stroke is ~0.6 of ratio.
const SPREAD_ENGAGE = 0.12;    // PROVISIONAL — deliberate travel before
                               // it takes hold, mirroring the explode
                               // scrub's 30px-of-340 (~9%); 0.12 of a
                               // ~0.6 stroke is ~20%, deliberately stiffer
                               // because a cut is destructive
const SPREAD_RANGE = 0.55;     // PROVISIONAL — spread ratio that sweeps
                               // t across its whole 0..1 (the scrub's 340px)
const SPREAD_DIR = +1;         // wider = deeper. The explode scrub's
                               // MIR = -1 does NOT transfer here: MIR
                               // un-mirrors SCREEN X, and a spread is a
                               // ratio between two fingertips, which the
                               // mirror leaves alone. If the live session
                               // reports it backwards, flip this one char.
const SCRUB_MS = 66;           // ~15Hz — every t write repaints the model
                               // (caps and all), so the scrub is throttled
const SCRUB_EPS = 0.004;       // and ignores sub-pixel wobble

// The swipe midpoint decides where the plane starts, in units of the
// model's own bbox half-extent. PROVISIONAL 2.0, derived from the render
// geometry rather than a hand: the card camera (35° at z=3.2) shows
// ±1.01 world units, and buildModelScene fits every model to a 1.3-unit
// bbox DIAGONAL, so a typical per-axis half-extent is ~0.45–0.65 world
// units — the card is about twice the model.
const OFFSET_GAIN = 2.0;
const OFFSET_MAX = 0.95;       // never start the plane fully off the model

// THE PRAYER VETO: the clap (reset) approaches with two open, vertical
// palms closing on each other, and an incision is one flat palm — the
// poses are cousins. While a second hand is open and this close, no
// incision commits. PROVISIONAL 0.30 of window width — outside the clap's
// own fire distance (0.11W wrists / 0.09W knuckles) with room to spare.
const PRAYER_VETO_W = 0.30;

// ------------------------------------------------------- landmark math
// All of it mirrors stage.html's idioms on purpose: the same span
// yardstick, the same 3D segment dots, the same arch ratios. A metric the
// D overlay and the P sampler already speak is a metric someone can tune.

const W = 0, MCP = 9;          // wrist, middle-knuckle: the span endpoints

function span2(l) { return Math.hypot(l[W].x - l[MCP].x, l[W].y - l[MCP].y); }

function seg(l, a, b) {
  const dx = l[b].x - l[a].x, dy = l[b].y - l[a].y,
        dz = (l[b].z || 0) - (l[a].z || 0);
  const n = Math.hypot(dx, dy, dz) || 1;
  return [dx / n, dy / n, dz / n];
}

/** the claw's CURL: ~+0.9 straight, ~0 bent, negative folded back */
export function curl(l, mcp, pip, dip, tip) {
  const p = seg(l, mcp, pip), d = seg(l, dip, tip);
  return p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
}

/** the pinch corpus's ARCH ratio: >1.45 = this finger reaches out */
export function arch(l, tip, mcp) {
  const td = Math.hypot(l[tip].x - l[W].x, l[tip].y - l[W].y);
  const md = Math.hypot(l[mcp].x - l[W].x, l[mcp].y - l[W].y);
  return md > 0 ? td / md : 9;
}

/** index-tip↔middle-tip gap ÷ span — the scissors' one number */
export function spreadRatio(l) {
  const s = span2(l);
  if (!(s > 0)) return 0;
  return Math.hypot(l[8].x - l[12].x, l[8].y - l[12].y,
                    (l[8].z || 0) - (l[12].z || 0)) / s;
}

// The camera's aspect. MediaPipe normalizes x by frame WIDTH and y by
// frame HEIGHT, so raw landmark space is stretched — harmless for the
// ratios upstream measures (they compare like with like) but fatal to a
// cross product, which mixes the axes. z rides the x scale, so it takes
// the same correction.
let _asp = 0, _aspT = 0;
function camAspect() {
  const now = Date.now();
  if (_asp && now - _aspT < 2000) return _asp;
  _aspT = now;
  try {
    const v = document.getElementById("cam");
    if (v && v.videoWidth && v.videoHeight) _asp = v.videoWidth / v.videoHeight;
  } catch (e) {}
  return _asp || 16 / 9;       // a sane default beats a NaN normal
}

/** THE PALM NORMAL — wrist(0), index knuckle(5), pinky knuckle(17)
 *  crossed, returned as a unit vector in the model card's WORLD basis
 *  (three's: +x right, +y up, +z toward the viewer).
 *
 *  Raw landmark axes → that basis: toScreen() draws x as (1 - lm.x), so
 *  raw +x is screen LEFT = world −x; raw +y is screen DOWN = world −y;
 *  and MediaPipe's z grows AWAY from the camera = world −z. All three
 *  negate. The two palm edges are mapped FIRST and crossed after, so the
 *  handedness of the result is whatever the mapped triangle really has
 *  (crossing first and negating would silently give the mirror image).
 *
 *  This is a real 3D read, which is the point: it survives the model
 *  being turned, and a palm rolled edge-on gives a sagittal plane where a
 *  palm facing the camera gives a coronal one. It also inherits monocular
 *  z's weakness — see the claw's v3.4 note. z error tilts this normal; it
 *  does not spin it, and STAB_DOT is the guard.
 *
 *  Sign convention: the returned normal points AWAY from the viewer, so
 *  three's clipping keeps the far half and the near half comes off — the
 *  cut always opens toward the learner. */
export function palmNormal(l, aspect) {
  const A = aspect || camAspect();
  const P = k => [-l[k].x * A, -l[k].y, -(l[k].z || 0) * A];
  const o = P(0), a = P(5), b = P(17);
  const u = [a[0] - o[0], a[1] - o[1], a[2] - o[2]];
  const v = [b[0] - o[0], b[1] - o[1], b[2] - o[2]];
  let n = [u[1] * v[2] - u[2] * v[1],
           u[2] * v[0] - u[0] * v[2],
           u[0] * v[1] - u[1] * v[0]];
  const m = Math.hypot(n[0], n[1], n[2]);
  if (!(m > 1e-9)) return null;             // a degenerate palm triangle
  n = [n[0] / m, n[1] / m, n[2] / m];
  if (n[2] > 0) n = [-n[0], -n[1], -n[2]];  // open it toward the learner
  return n;
}

function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

/** World → the model's LOCAL space. sc.group carries the live rotation
 *  (renderModels writes it from the item's rx/ry/rz every frame), so a
 *  plane the hand drew on screen has to come back through its inverse or
 *  the organ would slice itself differently every time it is turned.
 *  Rotation only: the group's scale is uniform (buildModelScene's `fit`),
 *  and uniform scale leaves a direction alone. */
export function toLocalDir(sc, n) {
  const THREE = sc.THREE;
  const q = sc.group.getWorldQuaternion(new THREE.Quaternion()).invert();
  const v = new THREE.Vector3(n[0], n[1], n[2]).applyQuaternion(q).normalize();
  return [v.x, v.y, v.z];
}

/** render.js's custom plane ignores `t` and anchors on `o` (a point in
 *  NORMALIZED model space, -1..1 across the bbox per axis). So `t` lives
 *  on exactly one line: it slides the origin along the plane's own
 *  normal, 0 = one edge, 0.5 = centre, 1 = the other. */
export function originFor(nL, t) {
  const s = Math.max(-1, Math.min(1, (t == null ? 0.5 : t) * 2 - 1));
  return [+(nL[0] * s).toFixed(4), +(nL[1] * s).toFixed(4),
          +(nL[2] * s).toFixed(4)];
}

// --------------------------------------------------------- hand state
// One record per cursor index, pruned when the hand leaves frame — the
// same shape core.js's HITS map uses.
const HANDS = new Map();
function handState(i, now) {
  let h = HANDS.get(i);
  // commitT starts in the deep past, not at 0: on the render page and in
  // any harness, performance.now() is still small when the first hand
  // arrives, and a 0 would silently hold the cooldown closed
  if (!h) HANDS.set(i, (h = { ph: 0, sus: false, sp: null, lost: 0,
                              commitT: -1e9, wrX: 0, wrY: 0, open: false }));
  h.seen = now;
  for (const [k, e] of HANDS) if (now - e.seen > 400) HANDS.delete(k);
  return h;
}

function cardRect(sc) {
  const el = sc.canvas && sc.canvas.parentElement;
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

function inside(r, x, y) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** The clap's approach, seen from one hand: is ANOTHER open palm closing
 *  in on this one? (Each hand records its own wrist + openness here, so
 *  the check costs nothing extra.) */
function prayerNearby(i, h) {
  for (const [k, e] of HANDS) {
    if (k === i || !e.open) continue;
    if (Math.hypot(e.wrX - h.wrX, e.wrY - h.wrY) < innerWidth * PRAYER_VETO_W)
      return true;
  }
  return false;
}

// ------------------------------------------------------------- the loop
/** Called from core.cursorFrame, once per cursor per frame, BEFORE the
 *  pointing raycast and before stage.html's grab block reads cur.pinched.
 *  Fails soft and silent: nothing here may throw into the frame loop. */
export function gestureFrame(cur, i, lms) {
  const now = performance.now();
  let h;
  try {
    h = handState(i, now);
    if (!lms || lms.length < 21) return;

    // --- the pose reads (computed every frame: the G sampler wants them
    // whether a cut is armed or not)
    const c8 = curl(lms, 5, 6, 7, 8), c12 = curl(lms, 9, 10, 11, 12);
    const c16 = curl(lms, 13, 14, 15, 16), c20 = curl(lms, 17, 18, 19, 20);
    const f8 = arch(lms, 8, 5), f12 = arch(lms, 12, 9);
    const f16 = arch(lms, 16, 13), f20 = arch(lms, 20, 17);
    const ext = [f8, f12, f16, f20].filter(v => v > EXT_ARCH).length;
    const sp = spreadRatio(lms);
    const n = palmNormal(lms);
    // the clap's own verticality read, recorded (never gated) so the
    // tuning session can see how close an incision palm sits to a
    // prayer palm — the one impostor gesture.js cannot settle alone
    const sn = span2(lms);
    const up = sn > 0 ? (lms[0].y - lms[9].y) / sn : 0;

    h.wrX = cur.x; h.wrY = cur.y;
    h.open = ext >= 3;                       // the prayer veto's own read

    // THE FLAT PALM — the incision pose. Every finger straight (the
    // pinky abstains: the claw corpus proved it is the least reliable
    // finger on the hand) and reaching out. Note what this is NOT: the
    // claw folds these same fingers (c12 < 0.35), so the two poses sit on
    // opposite ends of one metric and cannot be confused.
    const flat = ext >= 3 && c8 > FLAT_CURL && c12 > FLAT_CURL &&
                 c16 > FLAT_CURL && !!n;
    // THE SCISSORS — index + middle out, ring + pinky tucked. Mutually
    // exclusive with `flat` by construction (f16/f20 cannot be both
    // above 1.45 and below 1.32), which is why neither needs to know
    // about the other.
    const scis = f8 > EXT_ARCH && f12 > EXT_ARCH &&
                 f16 < FOLD_ARCH && f20 < FOLD_ARCH &&
                 c8 > FLAT_CURL && c12 > FLAT_CURL &&
                 c16 < FOLD_CURL && c20 < FOLD_CURL;

    sample(now, { c8, c12, c16, c20, ext, sp, up, n, flat, scis });

    const sc = armedScene();
    if (!sc) { reset(h); return; }
    const r = cardRect(sc);
    if (!r) { reset(h); return; }
    const over = inside(r, cur.x, cur.y);

    // ---- THE SUSPENSION LAW. While the cut is armed and this hand is
    // over the organ, the hand cannot grab, throw, or explode-scrub it:
    // core's caller reads cur.pinched three lines after we return, so
    // clearing it here removes the whole grab vocabulary for this hand,
    // this frame. The `sus` latch is the courtesy: suspension only
    // begins once the hand has been seen OPEN inside the card, so
    // arming a cut can never rip an item out of a hand that was already
    // carrying it (that would fling it at drag speed — see v3.9.8).
    if (over) {
      if (!cur.pinched) h.sus = true;
      if (h.sus && cur.pinched) {
        cur.pinched = false;
        try { cur.el.classList.remove("pinched"); } catch (e) {}
      }
    } else h.sus = false;

    // ---- THE INCISION: a flat-palm swipe across the organ.
    if (flat) {
      h.lost = 0;
      if (h.ph === 2) {
        // spent: this stroke already cut. It has to leave the card (or
        // the pose) before another incision is possible.
        if (!over) h.ph = 0;
      } else if (h.ph === 0) {
        if (over && now - h.commitT > CUT_COOL_MS) {
          h.ph = 1; h.ax = cur.x; h.ay = cur.y; h.t0 = now;
          h.nm = n.slice(); h.np = n.slice();
          noteCutActivity(sc);
        }
      } else if (h.ph === 1) {
        const mean = norm3(h.nm);
        // the palm must hold its plane: wobble is not an incision
        if (!mean || dot3(n, mean) < STAB_DOT || dot3(n, h.np) < FRAME_DOT) {
          h.ph = 0;
        } else {
          h.np = n.slice();
          h.nm = [h.nm[0] + n[0], h.nm[1] + n[1], h.nm[2] + n[2]];
          const travel = Math.hypot(cur.x - h.ax, cur.y - h.ay);
          if (now - h.t0 > SWIPE_MAX_MS) {        // a drift, not a stroke
            h.ax = cur.x; h.ay = cur.y; h.t0 = now;
            h.nm = n.slice();
          } else if (travel > TRAVEL_FRAC * r.width &&
                     now - h.t0 > SWIPE_MIN_MS) {
            if (prayerNearby(i, h)) {
              // the other hand is closing in — this is a clap forming,
              // not an incision. Drop the stroke, say why once.
              h.ph = 0; h.commitT = now;
              toast("that read as a clap — cut with ONE hand", 1600);
            } else {
              commit(sc, h, mean, cur, r);
              h.ph = 2; h.commitT = now;
            }
          }
        }
      }
    } else if (h.ph) {
      // a one-frame pose dropout is tracking noise, not a change of mind
      if (!h.lost) h.lost = now;
      else if (now - h.lost > POSE_GRACE_MS) { h.ph = 0; h.lost = 0; }
    }

    // ---- RETRACTION: the two-finger spread scrubs how deep the cut
    // sits. Same shape as the explode scrub — it re-anchors the moment
    // it engages, and it demands deliberate travel first, so a hand
    // passing through the pose changes nothing.
    if (scis && over) {
      const st = sc.med.st, cut = st.cut;
      if (!cut) { h.sp = null; }
      else if (!h.sp) {
        h.sp = { s0: sp, base: cut.t == null ? 0.5 : cut.t, live: false, wT: 0 };
        noteCutActivity(sc);
      } else {
        if (!h.sp.live && Math.abs(sp - h.sp.s0) > SPREAD_ENGAGE) {
          h.sp.live = true;
          h.sp.s0 = sp;                        // re-anchor at engage
          h.sp.base = cut.t == null ? 0.5 : cut.t;
          toast("scrubbing the cut — spread wider to go deeper", 900);
        }
        if (h.sp.live) {
          const t = Math.max(0, Math.min(1,
            h.sp.base + SPREAD_DIR * (sp - h.sp.s0) / SPREAD_RANGE));
          if (Math.abs(t - (cut.t == null ? 0.5 : cut.t)) > SCRUB_EPS &&
              now - h.sp.wT > SCRUB_MS) {
            h.sp.wT = now;
            const p = cut.plane;
            // a preset plane honors t directly; a hand-cut {o,n} plane
            // has no t at all, so t rides its origin (originFor)
            cutFromGesture(sc, (p && p.n)
              ? { t, plane: { o: originFor(p.n, t), n: p.n.slice() } }
              : { t });
          }
        }
      }
    } else h.sp = null;
  } catch (e) {
    // never throw into the frame loop; a broken cut gesture must leave
    // the rest of the board working
    if (h) reset(h);
    if (!gestureFrame._warned) {
      gestureFrame._warned = true;
      console.warn("[medical] gesture", e);
    }
  }
}

function reset(h) { h.ph = 0; h.sp = null; h.sus = false; h.lost = 0; }

function norm3(v) {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m > 1e-9 ? [v[0] / m, v[1] / m, v[2] / m] : null;
}

/** THE COMMIT — the swipe became a plane. The mean normal (not the last
 *  frame's) carries the orientation, and the stroke's MIDPOINT decides
 *  where the plane starts: swipe across the top of the organ and the cut
 *  lands high, across the middle and it halves it. */
function commit(sc, h, mean, cur, r) {
  try {
    const nL = toLocalDir(sc, mean);
    // the stroke midpoint in the card's own NDC (core.pick()'s form)
    const mx = (((h.ax + cur.x) / 2 - r.left) / r.width) * 2 - 1;
    const my = -(((((h.ay + cur.y) / 2) - r.top) / r.height) * 2 - 1);
    // how far that midpoint sits along the cutting direction, in units
    // of the model's own half-extent. The screen offset has no z, so
    // only the normal's on-screen part can shift it — which is exactly
    // right: a palm facing the camera cuts a plane whose depth the
    // screen cannot express, and it lands at the centre.
    const s = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX,
      (mx * mean[0] + my * mean[1]) * OFFSET_GAIN));
    const t = (s + 1) / 2;
    cutFromGesture(sc, {
      // n is normalized here because this path never passes through the
      // server, which is where /cmd planes get theirs (schemas/verbs.md)
      plane: { o: originFor(nL, t), n: [+nL[0].toFixed(4), +nL[1].toFixed(4),
                                        +nL[2].toFixed(4)] },
      t: +t.toFixed(3),
    });
    toast("incision — spread two fingers to scrub how deep it cuts", 2200);
  } catch (e) { console.warn("[medical] commit", e); }
}

// ------------------------------------------------------- THE G SAMPLER
// The P omni-sampler records the pinch and claw families; none of its
// lines separate a flat palm from a prayer palm, or a scissors from a
// relaxed hand. G is the same instrument aimed at the cut's own gates:
// press G, hold ONE pose (one hand in frame) for 4 seconds, read
// min–median–max. skills/gesture-tuning/SKILL.md drives it.
let SAMP = null;
try {
  addEventListener("keydown", e => {
    if (e.key !== "g" && e.key !== "G") return;
    SAMP = { until: performance.now() + 4000, c8: [], c12: [], c16: [],
             c20: [], ext: [], sp: [], up: [], nd: [], N: [],
             flat: 0, scis: 0, n: 0 };
    toast("CUT sampler: hold the pose for 4 seconds…", 4000);
  });
} catch (e) {}

function sample(now, m) {
  if (!SAMP) return;
  if (now < SAMP.until) {
    SAMP.c8.push(m.c8); SAMP.c12.push(m.c12);
    SAMP.c16.push(m.c16); SAMP.c20.push(m.c20);
    SAMP.ext.push(m.ext); SAMP.sp.push(m.sp); SAMP.up.push(m.up);
    SAMP.n++;
    if (m.flat) SAMP.flat++;
    if (m.scis) SAMP.scis++;
    if (m.n) {
      if (SAMP.N.length) SAMP.nd.push(dot3(m.n, SAMP.N[SAMP.N.length - 1]));
      SAMP.N.push(m.n);
    }
    return;
  }
  const S = SAMP; SAMP = null;
  const stat = a => {
    if (!a.length) return "-";
    a = a.slice().sort((x, y) => x - y);
    const f = v => v.toFixed(2);
    return f(a[0]) + "–" + f(a[Math.floor(a.length / 2)]) + "–" + f(a[a.length - 1]);
  };
  // stability is measured against the window's MEAN normal, which is
  // what the swipe gate itself compares to
  let ns = [];
  const mean = norm3(S.N.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]],
                                [0, 0, 0]));
  if (mean) ns = S.N.map(v => dot3(v, mean));
  const pct = k => S.n ? Math.round(100 * k / S.n) + "%" : "-";
  toast(
    `CUT c8 ${stat(S.c8)} · c12 ${stat(S.c12)} · c16 ${stat(S.c16)}` +
    ` · c20 ${stat(S.c20)} · ext ${stat(S.ext)}\n` +
    `PLANE ns ${stat(ns)} · nd ${stat(S.nd)} · spread ${stat(S.sp)}` +
    ` · up ${stat(S.up)}\n` +
    `GATES flat ${pct(S.flat)} · scissors ${pct(S.scis)} · frames ${S.n}`,
    20000);
}
