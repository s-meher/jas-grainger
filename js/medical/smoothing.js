// js/medical/smoothing.js: task 3.11, cursor smoothing. OPT-IN prototype.
//
// The board already filters the cursor: stage.html runs a fixed EMA
// (alpha 0.45 per video frame) on the thumb-index midpoint. This file does
// NOT add a second filter on top of it. Under ?smooth=oneeuro, smoothCursor
// REPLACES that EMA's output with a One Euro filter on the same raw point
// (Casiez, Roussel & Vogel, CHI 2012): a low-pass whose cutoff rises with
// speed, so a resting hand is steadier AND a moving hand lags less.
//
// Measured on synthetic 30 fps signals (tests/test_smoothing.mjs prints the
// table; white 3 px jitter, ideal ramps/steps. NOT webcam data):
//                         raw    EMA 0.45   One Euro (1 Hz, 0.01, 1 Hz)
//   rest jitter, px sd    3.09   1.71       1.09
//   lag @ 100 px/s, px    -      4.1        4.7
//   lag @ 1500 px/s, ms   -      41         8
//   300 px step to 90%    -      100 ms     33 ms
//
// Default stays the EMA until a webcam A/B (docs/validation/phase1-webcam-
// session.md): the 26 px pointing stillness and the fling velocities read
// from cur.history were tuned by hand ON the EMA, and lower lag means faster
// measured flings. Decision: docs/decisions/phase4-decision-log.md D-P4-03.
//
// Tracking loss is untouched: holdLost/foundCursor (interaction.js) still
// own lostT, history and probKill. The one thing this changes at
// reacquisition is deliberate: after a gap > GAP_MS the filter restarts AT
// the new raw point, where the EMA glides 45% of the way per frame and
// writes that glide into cur.history as fake velocity (foundCursor's own
// comment says a reacquired hand "resumes from where it is NOW").

export const ONE_EURO = Object.freeze({ minCutoff: 1.0, beta: 0.01, dCutoff: 1.0 });
export const EMA_ALPHA = 0.45;   // stage.html's cursor EMA, mirrored for the comparison test
export const GAP_MS = 150;       // > 4 frames at 30 fps: a dropout, not jitter

const alpha = (cutoffHz, dtS) => 1 / (1 + 1 / (2 * Math.PI * cutoffHz * dtS));

/** One scalar One Euro filter. filter(value, tMs) -> smoothed value. */
export function oneEuro(p = ONE_EURO) {
  let x = null, dx = 0, t = 0;
  return {
    reset() { x = null; dx = 0; },
    filter(v, tMs) {
      if (x === null || !(tMs > t)) {          // first sample, or a clock that didn't advance
        if (x === null) { x = v; dx = 0; }
        t = tMs;
        return x;
      }
      const dt = (tMs - t) / 1000;
      t = tMs;
      dx += alpha(p.dCutoff, dt) * ((v - x) / dt - dx);
      x += alpha(p.minCutoff + p.beta * Math.abs(dx), dt) * (v - x);
      return x;
    },
  };
}

/** stage.html's EMA as a filter object, for side-by-side tests only. */
export function ema(a = EMA_ALPHA) {
  let x = null;
  return { reset() { x = null; },
           filter(v) { x = x === null ? v : x + a * (v - x); return x; } };
}

/** Pure: apply One Euro to a cursor. Only cur.x/cur.y (and the private
 *  cur._oe) are written; lostT, history, pinched are never touched. */
export function smoothWith(cur, px, py, now, p = ONE_EURO) {
  if (!cur || !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(now)) return false;
  let f = cur._oe;
  if (!f || f.p !== p) f = cur._oe = { p, x: oneEuro(p), y: oneEuro(p), t: -Infinity };
  if (now - f.t > GAP_MS) { f.x.reset(); f.y.reset(); }   // new hand or reacquired: start at the hand
  f.t = now;
  cur.x = f.x.filter(px, now);
  cur.y = f.y.filter(py, now);
  return true;
}

const ON = (() => {
  try { return /[?&]smooth=oneeuro(&|$)/.test(globalThis.location?.search || ""); }
  catch (e) { return false; }
})();

/** stage.html hook, right after its EMA line. A no-op unless ?smooth=oneeuro. */
export function smoothCursor(cur, px, py, now) {
  if (!ON) return false;
  try { return smoothWith(cur, px, py, now); } catch (e) { return false; }
}
export const smoothingMode = () => (ON ? "oneeuro" : "ema");
