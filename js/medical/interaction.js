// js/medical/interaction.js: closes the Phase 2 gesture gaps (3.4–3.6, G3)
// that tests/test_pinch_point.mjs found in the existing board.
// Every entry point is called through an optional `MED.fn?.()` MEDICAL HOOK
// in stage.html. If this file fails to load, the board behaves exactly as
// upstream barehands does.
//
//   G3-1  holdLost / foundCursor: a hand that drops out of tracking for a
//         moment FREEZES whatever it holds (shown as a dimmed cursor), and
//         is only let go after LOST_GRACE_MS. The final let-go is velocity-
//         free and tap-free, so a tracking dropout can never fling, open or
//         close anything.
//   3.5-1 handSlots: cursor identity comes from MediaPipe's handedness
//         label (Left -> 0, Right -> 1), not from its per-frame list order,
//         so when one hand leaves, the other doesn't inherit its grab.
//   3.6-1 installMouse: a mouse fallback for models. Drag = move,
//         Shift/right-drag = rotate, wheel = scale, double-click = reset
//         pose. It reuses the board's own constants (0.012 rad/px,
//         0.12–12x), so mouse and hand stay one interaction contract.
// (G3-2 / 3.5-2, the stale point and ambiguity, live in core.js beside
// the pointing code they fix.)

export const LOST_GRACE_MS = 500;   // ~15 frames: covers blinks/occlusion, short enough to feel live

let _css = false;
function lostCss() {
  if (_css || typeof document === "undefined" || !document.head) return;
  _css = true;
  const s = document.createElement("style");
  s.textContent = ".cursor.lost{opacity:.3;filter:grayscale(1);transition:opacity .15s}";
  document.head.appendChild(s);
}

/** stage.html: once per frame for each cursor NOT seen this frame.
 *  true = keep it, frozen; false = drop it now (grace expired). */
export function holdLost(cur, now) {
  if (!cur) return false;
  if (!cur.lostT) {
    cur.lostT = now;
    lostCss();
    try { cur.el && cur.el.classList.add("lost"); } catch (e) {}
    return true;
  }
  if (now - cur.lostT < LOST_GRACE_MS) return true;
  // the real drop: no fling (no history = no release velocity) and no tap
  // (probKill = the board's existing "this release is not a gesture" flag)
  cur.history = [];
  cur.probKill = true;
  return false;
}

/** stage.html: the cursor's hand is visible this frame. */
export function foundCursor(cur) {
  if (!cur || !cur.lostT) return;
  cur.lostT = 0;
  // a re-acquired hand resumes from where it is NOW, never interpolating
  // across the gap (that would read as a fast swipe)
  cur.history = [];
  try { cur.el && cur.el.classList.remove("lost"); } catch (e) {}
}

/** -> one stable slot per detected hand: Left=0, Right=1. Falls back to
 *  the list index when labels are missing or both hands claim the same
 *  side (a known MediaPipe confusion), so it never merges two hands. */
export function handSlots(res) {
  const n = (res && res.landmarks && res.landmarks.length) || 0;
  const hd = (res && (res.handedness || res.handednesses)) || [];
  const lab = Array.from({ length: n }, (_, i) => {
    const c = hd[i] && hd[i][0];
    return c && (c.categoryName || c.label);
  });
  const slot = lab.map(l => (l === "Left" ? 0 : l === "Right" ? 1 : -1));
  const ok = slot.every(s => s >= 0) && new Set(slot).size === slot.length;
  return ok ? slot : slot.map((_, i) => i);
}

// --------------------------------------------------------- mouse fallback
const ROT = 0.012, SMIN = 0.12, SMAX = 12;

/** Pure step function so tests can drive it without a DOM.
 *  st = {mode, it, x0, y0, ox, oy, rx0, ry0}; returns the item patch. */
export function mouseStep(st, x, y) {
  const it = st.it;
  if (st.mode === "move") { it.x = x + st.ox; it.y = y + st.oy; }
  else if (st.mode === "rotate") {
    it.ry = st.ry0 + (x - st.x0) * ROT;                       // models spin freely
    it.rx = Math.max(-1.2, Math.min(1.2, st.rx0 + (y - st.y0) * ROT));
    it.rvy = 0;                                                // no coasting after a mouse turn
  }
  return it;
}
export function wheelScale(it, deltaY) {
  it.scale = Math.max(SMIN, Math.min(SMAX, (it.scale || 1) * Math.exp(-deltaY * 0.0015)));
  return it.scale;
}

/** stage.html (tracker page only): getItems() -> the live items array.
 *  Only model cards respond, and never while a hand holds the same item. */
export function installMouse(getItems, opts = {}) {
  if (typeof addEventListener === "undefined") return;
  const pickAt = (x, y) => {
    const its = getItems() || [];
    for (let k = its.length - 1; k >= 0; k--) {
      const c = its[k];
      if (c.type !== "model" || !c.el || !c.el.isConnected) continue;
      const r = (opts.hitRect && opts.hitRect(c)) || c.el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
    }
    return null;
  };
  let st = null;
  addEventListener("contextmenu", e => { if (pickAt(e.clientX, e.clientY)) e.preventDefault(); });
  addEventListener("mousedown", e => {
    const it = pickAt(e.clientX, e.clientY);
    if (!it || (it.grabbedBy && it.grabbedBy.length)) return;
    e.preventDefault();
    const rotate = e.shiftKey || e.button === 2;
    st = { it, mode: rotate ? "rotate" : "move", x0: e.clientX, y0: e.clientY,
           ox: it.x - e.clientX, oy: it.y - e.clientY, rx0: it.rx || 0, ry0: it.ry || 0 };
    it.flying = false; it.vx = 0; it.vy = 0;
  });
  addEventListener("mousemove", e => { if (st) mouseStep(st, e.clientX, e.clientY); });
  addEventListener("mouseup", () => { st = null; });
  addEventListener("wheel", e => {
    const it = pickAt(e.clientX, e.clientY);
    if (!it || (it.grabbedBy && it.grabbedBy.length)) return;
    e.preventDefault();
    wheelScale(it, e.deltaY);
  }, { passive: false });
  addEventListener("dblclick", e => {
    const it = pickAt(e.clientX, e.clientY);
    if (!it) return;
    it.rx = -0.15; it.ry = 0.6; it.rz = 0; it.rvy = 0; it.scale = 1;   // makeModel's pose
  });
}
