/* Tasks 3.4 / 3.5 / 3.6: VERIFY the existing pinch, point and manipulation
 * logic. These tests don't rewrite it.
 *
 *   node tests/test_pinch_point.mjs
 *
 * No copies, so nothing can drift. The pinch classifier and the rotate/
 * stretch mappings are inline in stage.html (an upstream barehands file
 * we don't refactor), so this harness SLICES the exact source text between
 * fixed anchor lines and runs it with synthetic hands. If an anchor moves or
 * disappears, the suite fails loudly instead of testing stale code.
 * Pointing lives in js/medical/core.js and is driven through its real
 * export, against a stub scene.
 *
 * Synthetic hands are built in an isotropic space and converted to raw
 * MediaPipe coordinates with the 16:9 x-compression a webcam frame has
 * (raw.x = X * 9/16). That compression is what makes a frontal palm read
 * aspect ≈ 2.2, inside the corpus range the code was fitted on.
 *
 * Outcomes: ok / FAIL, plus XFAIL for KNOWN GAPS (findings documented in
 * docs/validation/2026-11-04-3-4-3-6-gestures.md). An XFAIL is current
 * behaviour that misses a plan.md / G3 requirement. It doesn't fail the run,
 * but it turns into XPASS the day someone fixes it.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, copyFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGE = readFileSync(join(HERE, "..", "stage.html"), "utf8");
let pass = 0, fail = 0, xfail = 0, xpass = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log("  ok    " + n))
                                 : (fail++, console.log("  FAIL  " + n + "  " + d)); };
const gap = (id, n, c) => { c ? (xpass++, console.log(`  XPASS ${n}  [${id} fixed? update the record]`))
                              : (xfail++, console.log(`  XFAIL ${n}  [${id}]`)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** exact source between two anchor lines (start inclusive, end exclusive) */
function slice(startAnchor, endAnchor, inclusiveEnd = false) {
  const a = STAGE.indexOf(startAnchor);
  if (a < 0) throw new Error("anchor gone from stage.html: " + startAnchor);
  const b = STAGE.indexOf(endAnchor, a);
  if (b < 0) throw new Error("anchor gone from stage.html: " + endAnchor);
  return STAGE.slice(a, inclusiveEnd ? b + endAnchor.length : b);
}

// ===================================================== synthetic hands
const W = 1920, H = 1080, XC = 9 / 16;
const toScreen = l => ({ x: (1 - l.x) * W, y: l.y * H });   // mirrored, as stage.html
/** pose: open | ok | fist | fistFree. cx,cy = wrist (0..1), s = span
 *  (wrist→middle knuckle, isotropic units), ang = palm-axis angle (0 = fingers
 *  up), mirror = the other hand, gap = thumb-tip→index-tip distance / s */
function hand({ pose = "open", cx = 0.5, cy = 0.7, s = 0.2, ang = 0, mirror = false,
                gapR = 0.1, collapse = false, thumbFar = false } = {}) {
  const u = [Math.sin(ang), -Math.cos(ang)];                 // wrist -> fingers
  let w = [Math.cos(ang), Math.sin(ang)];                    // across the knuckles
  if (mirror) w = [-w[0], -w[1]];
  const P = [], at = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sc = (v, k) => [v[0] * k, v[1] * k];
  const lin = (o, ku, kw) => at(o, at(sc(u, ku * s), sc(w, kw * s)));
  const W0 = [0, 0];
  P[0] = W0;
  const kw = collapse ? [0, 0, 0.01, 0.02] : [-0.4, 0, 0.35, 0.7];   // 5, 9, 13, 17
  [5, 9, 13, 17].forEach((m, k) => { P[m] = lin(W0, 1.0, kw[k]); });
  for (const m of [5, 9, 13, 17]) {
    const folded = pose === "fist" || pose === "fistFree" || (pose === "ok" && m === 5);
    const L = folded ? [0.12, 0.08, 0.04] : [0.35, 0.6, 0.85];
    for (let j = 1; j <= 3; j++) P[m + j] = lin(P[m], L[j - 1], 0);
  }
  if (pose === "ok") P[8] = lin(W0, 1.25, -0.25);            // index curled in
  if (pose === "fist" || pose === "fistFree") P[8] = lin(W0, 0.95, -0.2);
  const thumbTip = thumbFar ? lin(W0, 0.5, -1.4)
                 : (pose === "open" ? lin(W0, 0.45, -0.95) : at(P[8], sc(u, -gapR * s)));   // along the
  // palm axis, which the 16:9 x-compression leaves alone, so gapR is the raw ratio
  P[4] = thumbTip;
  P[1] = lin(W0, 0.2, -0.25); P[2] = lin(W0, 0.35, -0.45); P[3] = at(P[2], sc(at(thumbTip, sc(P[2], -1)), 0.5));
  return P.map(([x, y]) => ({ x: cx + x * XC, y: cy + y, z: 0 }));
}

// ======================================================== 3.4 the pinch
// Region: from the gap read to the end of PINCH PROBATION. Inputs it needs
// from the enclosing frame(): lms, span, tip, thumb, cur, items, i, now.
const PINCH_SRC = slice("const gap = Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y);",
                        "} else cur.badRun = 0;", true);
const pinchStep = new Function("cur", "lms", "items", "i", "now", `
  const W = ${W}, H = ${H}, toScreen = ${toScreen.toString()};
  const tip = toScreen(lms[8]), thumb = toScreen(lms[4]);
  const span = Math.hypot(lms[0].x - lms[9].x, lms[0].y - lms[9].y);
  ${PINCH_SRC}
  return cur;`);
const newCur = () => ({ x: W / 2, y: H / 2, pinched: false, history: [], pinchT: 0 });
/** run frames (33 ms apart) and return the per-frame pinched trace */
function run(cur, frames, { items = [], t0 = 1000, dt = 33 } = {}) {
  const trace = [];
  frames.forEach((lms, k) => {
    const now = t0 + k * dt;
    const was = cur.pinched;
    pinchStep(cur, lms, items, 0, now);
    if (cur.pinched && !was) cur.pinchT = now;   // stage.html sets this right after
    trace.push(cur.pinched);
  });
  return trace;
}
const rep = (lms, n) => Array.from({ length: n }, () => lms);

console.log("\n3.4 pinch: the existing classifier, sliced from stage.html");
{
  ok("open palm never pinches", !run(newCur(), rep(hand(), 10)).some(Boolean));
  const t = run(newCur(), rep(hand({ pose: "ok" }), 4));
  ok("OK-sign pinch enters on the 2nd clean frame, not the 1st", !t[0] && t[1], JSON.stringify(t));
  ok("one lucky OK frame between open frames buys nothing",
     !run(newCur(), [hand(), hand({ pose: "ok" }), hand(), hand()]).some(Boolean));
  ok("closed fist with the thumb on the index never pinches",
     !run(newCur(), rep(hand({ pose: "fist" }), 12)).some(Boolean));
  // normalized hand-size metric: span is the ruler, so distance/position don't matter
  for (const [s, cx, cy] of [[0.08, 0.2, 0.8], [0.2, 0.5, 0.7], [0.32, 0.75, 0.75]])
    ok(`scale/position invariant (span ${s}, at ${cx},${cy})`,
       run(newCur(), rep(hand({ pose: "ok", s, cx, cy }), 3))[2]);
  ok("other hand (mirrored) pinches the same",
     run(newCur(), rep(hand({ pose: "ok", mirror: true }), 3))[2]);
  ok("tilted hand (30°) still pinches",
     run(newCur(), rep(hand({ pose: "ok", ang: 0.52 }), 3))[2]);
  // hysteresis: enter below 0.32 (frontal), hold until the gap ratio reaches 0.55
  {
    const c = newCur();
    run(c, rep(hand({ pose: "ok" }), 3));
    const mid = run(c, rep(hand({ pose: "ok", gapR: 0.45 }), 3), { t0: 2000 });
    ok("hysteresis: a half-open hand (gap 0.45) keeps a pinch", mid.every(Boolean));
    const fresh = run(newCur(), rep(hand({ pose: "ok", gapR: 0.45 }), 4));
    ok("...but the same half-open hand cannot START one", !fresh.some(Boolean));
    const out = run(c, rep(hand({ pose: "ok", gapR: 0.75 }), 2), { t0: 3000 });
    ok("hysteresis: opening past the release bar lets go", !out[0]);
  }
  // PINCH PROBATION: a fresh pinch that loses its signature within 400 ms drops
  {
    const c = newCur();
    run(c, rep(hand({ pose: "ok" }), 2));
    const t2 = run(c, rep(hand({ pose: "fistFree" }), 5), { t0: 1066 });
    ok("probation: fold-through into a fist within 400 ms drops the grab",
       t2.includes(false) && c.probKill === true, JSON.stringify(t2));
    const d = newCur();
    run(d, rep(hand({ pose: "ok" }), 2));
    const t3 = run(d, rep(hand({ pose: "fistFree" }), 3), { t0: 1600 });
    ok("...after 400 ms an established grip may close into a fist (carry)", t3.every(Boolean));
  }
  // sanity bound: geometrically impossible hand (knuckle row collapsed) = tracker guessing
  {
    const c = newCur();
    run(c, rep(hand({ pose: "ok" }), 3));
    const g = run(c, [hand({ pose: "ok", collapse: true })], { t0: 2000 });
    ok("garbage hand (aspect > 6) drops a held pinch immediately", !g[0] && c.probKill);
  }
  // speed-aware release: a fast hand must open wider, two frames running
  {
    const c = newCur();
    run(c, rep(hand({ pose: "ok" }), 3));
    const fast = [0, 1, 2, 3].map(k => hand({ pose: "ok", gapR: 0.62, cx: 0.5 - (k + 1) * 0.08 }));   // keeps moving one way
    const tr = run(c, fast, { t0: 1099 });      // continuous with the grab (no time jump)
    ok("fast drag: a blur-inflated gap (0.62) does not drop the grab", tr.every(Boolean), JSON.stringify(tr));
    const slow = newCur();
    run(slow, rep(hand({ pose: "ok" }), 3));
    ok("...while the same 0.62 gap on a slow hand does release",
       !run(slow, rep(hand({ pose: "ok", gapR: 0.62 }), 1), { t0: 1099 })[0]);
  }
  // holding an item exempts the signature (force-pull carry is a fist)
  ok("a hand already holding may (re)pinch without the OK signature",
     run(newCur(), rep(hand({ pose: "fist" }), 2), { items: [{ grabbedBy: [0] }] })[1]);
  // fingers pointing sideways: the 16:9 compression now shrinks the SPAN, so
  // palm aspect < 2 and the code switches to its profile rule (thumb far
  // from the ring knuckle, tRel > 0.95) instead of the contrast law
  {
    const side = hand({ pose: "ok", ang: Math.PI / 2, gapR: 0.05 });
    const span = Math.hypot(side[0].x - side[9].x, side[0].y - side[9].y);
    const palmW = Math.hypot(side[5].x - side[17].x, side[5].y - side[17].y);
    ok("sideways hand really is in the profile regime (aspect < 2)", span / palmW < 2, (span / palmW).toFixed(2));
    ok("profile regime: a sideways OK-sign pinch is admitted",
       run(newCur(), rep(side, 3))[2]);
    // synthetic finding, NOT proven on a real hand: this generator only
    // rotates a frontal hand in-plane and doesn't wrap the thumb the way
    // a real fist does. It needs a webcam sample before anyone tunes tRel.
    gap("3.4-1", "profile regime: a sideways-pointing fist is refused",
        !run(newCur(), rep(hand({ pose: "fist", ang: Math.PI / 2 }), 6)).some(Boolean));
  }
}

// ============================ fixed gaps: tracking loss + handedness
console.log("\nG3-1 / 3.5-1 fixes: js/medical/interaction.js + their stage.html hooks");
const IX = await import("../js/medical/interaction.js");
{
  // G3-1: freeze on loss, release only after the grace, and never as a fling/tap
  const cur = { x: 10, y: 10, history: [{ x: 1, t: 1 }, { x: 9, t: 2 }], el: null };
  ok("G3-1: first missed frame keeps the hand (frozen)", IX.holdLost(cur, 1000) === true && cur.lostT === 1000);
  ok("G3-1: still kept inside the grace", IX.holdLost(cur, 1000 + IX.LOST_GRACE_MS - 1) === true);
  ok("G3-1: dropped after the grace", IX.holdLost(cur, 1000 + IX.LOST_GRACE_MS) === false);
  ok("G3-1: the final drop carries no fling velocity and no tap",
     cur.history.length === 0 && cur.probKill === true);
  const back = { history: [{ x: 1, t: 1 }], el: null };
  IX.holdLost(back, 5000);
  IX.foundCursor(back);
  ok("G3-1: a hand that returns in time resumes, with no lost state and no stale history",
     back.lostT === 0 && back.history.length === 0);
  ok("G3-1: stage.html drops an unseen hand only when holdLost says so",
     STAGE.includes("if (!seen.has(i) && !MED.holdLost?.(cursors[i], now)) dropCursor(i);") &&
     !STAGE.includes("if (!seen.has(i)) dropCursor(i);"));
  ok("G3-1: stage.html marks a re-seen hand found", STAGE.includes("MED.foundCursor?.(cur);"));
  // 3.5-1: identity from handedness, robust to list order and label confusion
  const R = (...labs) => ({ landmarks: labs.map(() => []),
                            handedness: labs.map(l => (l ? [{ categoryName: l }] : [])) });
  ok("3.5-1: Left=0, Right=1 whatever the list order",
     JSON.stringify(IX.handSlots(R("Right", "Left"))) === "[1,0]" &&
     JSON.stringify(IX.handSlots(R("Left", "Right"))) === "[0,1]");
  ok("3.5-1: the right hand alone keeps slot 1, so it can't inherit the left hand's grab",
     JSON.stringify(IX.handSlots(R("Right"))) === "[1]");
  ok("3.5-1: both hands labelled the same falls back to list order (never merges)",
     JSON.stringify(IX.handSlots(R("Left", "Left"))) === "[0,1]");
  ok("3.5-1: a missing label falls back to list order",
     JSON.stringify(IX.handSlots(R("Left", null))) === "[0,1]");
  ok("3.5-1: stage.html keys cursors by MED.handSlots",
     STAGE.includes("const slots = MED.handSlots?.(res);") && STAGE.includes("if (slots) i = slots[i];"));
}

// ======================================== 3.6 rotate / stretch mapping
console.log("\n3.6 manipulation: the existing mappings, sliced from stage.html");
const ROT_SRC = slice("const ROT = 0.012;", '} else if (held.mode === "move" && held.grabbedBy[0] === i) {');
const rotate = new Function("held", "cur", ROT_SRC);
const STR_SRC = slice("const a = cursors[held.grabbedBy[0]], b = cursors[held.grabbedBy[1]];",
                      "held.x = (a.x + b.x) / 2; held.y = (a.y + b.y) / 2;", true);
const stretch = new Function("held", "cursors", STR_SRC);
{
  const h = { type: "model", rot0x: 0, rot0y: 0, grabX0: 500, grabY0: 400 };
  rotate(h, { x: 600, y: 450, history: [{ x: 500, t: 0 }, { x: 600, t: 100 }] });
  ok("rotate: 100 px right = +1.2 rad yaw (0.012 rad/px)", Math.abs(h.ry - 1.2) < 1e-9);
  ok("rotate: 50 px down = +0.6 rad pitch", Math.abs(h.rx - 0.6) < 1e-9);
  ok("rotate: release momentum = hand x-velocity × 0.012", Math.abs(h.rvy - 12) < 1e-9);
  rotate(h, { x: 1500, y: 2000, history: [] });
  ok("rotate: model yaw is free (12 rad), pitch clamped to ±1.2", Math.abs(h.ry - 12) < 1e-9 && h.rx === 1.2);
  const p = { type: "img", rot0x: 0, rot0y: 0, grabX0: 0, grabY0: 0 };
  rotate(p, { x: -5000, y: 0, history: [] });
  ok("rotate: non-model panes clamp yaw to ±1.2 (text never mirrors)", p.ry === -1.2);
  const s = { grabbedBy: [0, 1], stretch: { s0: 1, d0: 200 } };
  const C = { 0: { x: 100, y: 500 }, 1: { x: 500, y: 500 } };
  stretch(s, C);
  ok("stretch: two hands 2× apart = 2× scale, centred between them",
     s.scale === 2 && s.x === 300 && s.y === 500);
  stretch(s, { 0: { x: 0, y: 0 }, 1: { x: 1e5, y: 0 } });
  ok("stretch: scale ceiling 12×", s.scale === 12);
  stretch(s, { 0: { x: 0, y: 0 }, 1: { x: 1, y: 0 } });
  ok("stretch: scale floor 0.12× (always pinchable again)", s.scale === 0.12);
  ok("reset: R respawns the board", /e\.key === "r" \|\| e\.key === "R"\) loadTree\(\)\.then\(\(\) => spawnStage\(\)\)/.test(STAGE));
  // 3.6-1 fixed: mouse fallback with the same constants as the hand
  const m = { x: 100, y: 100, rx: 0, ry: 0, scale: 1 };
  IX.mouseStep({ it: m, mode: "move", ox: -10, oy: 5 }, 300, 200);
  ok("3.6-1 mouse: drag moves the model (keeping the grab offset)", m.x === 290 && m.y === 205);
  IX.mouseStep({ it: m, mode: "rotate", x0: 0, y0: 0, rx0: 0, ry0: 0 }, 100, 50);
  ok("3.6-1 mouse: shift/right-drag rotates at the hand's 0.012 rad/px",
     Math.abs(m.ry - 1.2) < 1e-9 && Math.abs(m.rx - 0.6) < 1e-9 && m.rvy === 0);
  IX.mouseStep({ it: m, mode: "rotate", x0: 0, y0: 0, rx0: 0, ry0: 0 }, 0, 5000);
  ok("3.6-1 mouse: pitch clamps at ±1.2 like the hand", m.rx === 1.2);
  ok("3.6-1 mouse: wheel scales within the hand's 0.12–12× bounds",
     IX.wheelScale({ scale: 1 }, -1e6) === 12 && IX.wheelScale({ scale: 1 }, 1e6) === 0.12 &&
     IX.wheelScale({ scale: 1 }, -100) > 1);
  ok("3.6-1 mouse: installed on the tracker page (not the render page)",
     /MED\.installMouse\?\.\(\(\) => items[^\n]*\n\s*boot\(\)\.catch/.test(STAGE));
}

// ========================================================= 3.5 pointing
console.log("\n3.5 pointing: js/medical/core.js cursorFrame, stub scene");
const SRC = join(HERE, "..", "js", "medical"), BOX = join(HERE, "cutgest");
mkdirSync(BOX, { recursive: true });
// bundle.js only exists once 2.3 lands; copy what's present
for (const f of readdirSync(SRC).filter(f => f.endsWith(".js"))) copyFileSync(join(SRC, f), join(BOX, f));
writeFileSync(join(BOX, "render.js"), "export function paint(){} export function tick(){} export function dispose(){}\n");
writeFileSync(join(BOX, "package.json"), '{"type":"module"}\n');
Object.assign(globalThis, { location: { search: "" }, document: { getElementById: () => null },
  innerWidth: W, innerHeight: H, addEventListener: () => {} });
const CORE = await import("./cutgest/core.js");
const mesh = (name, extra = {}) => ({ name, isMesh: true, visible: true, parent: null, ...extra });
const liver = mesh("liver"), tumor = mesh("liver_tumor"), orphan = mesh("stray_scan_noise");
const hiddenParent = { name: "grp", visible: false, parent: null };
const hiddenLiver = mesh("liver", { parent: hiddenParent });
let AIM = [];                                     // what the stub raycaster hits
globalThis.fetch = async () => ({ ok: true, json: async () => ({
  schema: "barehands-anatomy/1", structures: {
    liver: { name: "Liver", meshes: ["liver"], parent: null, children: [], layer: 0 },
    liver_tumor: { name: "Liver tumor", meshes: ["liver_tumor"], parent: null, children: [], layer: 1 } },
  aliases: {} }) });
const el = { isConnected: true, getBoundingClientRect: () => ({ left: 700, top: 300, right: 1180, bottom: 780, width: 480, height: 480 }) };
el.parentElement = { children: [el] };
const scene = { children: [], traverse: fn => [liver, tumor, orphan, hiddenParent, hiddenLiver].forEach(fn) };
const sc = { canvas: { parentElement: el }, scene, camera: {},
  THREE: { Raycaster: class { setFromCamera() {} intersectObjects() { return AIM.map(o => ({ object: o, point: {} })); } } } };
await CORE.onModelLoaded(sc, "/media/models/phantom/model.glb");
const pcur = (x = 940, y = 540, pinched = false) => ({ x, y, pinched, history: [], el: { classList: { toggle() {} } } });
const lmsOpen = hand();
async function hold(cur, ms, i = 0, jitter = 0) {
  const t = performance.now();
  let k = 0;
  while (performance.now() - t < ms) {
    if (jitter) cur.x += (k++ % 2 ? -jitter : jitter);
    CORE.cursorFrame(cur, i, lmsOpen);
    await sleep(20);
  }
}
{
  AIM = [tumor];
  const c = pcur();
  await hold(c, 500);
  ok("point: nothing published before the hand has dwelt (~0.6 s still + 0.6 s stable)", CORE.pointState() === null);
  await hold(c, 1000);
  ok("point: a still open hand names the structure under it", CORE.pointState()?.structure === "liver_tumor");
  AIM = [hiddenLiver, tumor];
  const c2 = pcur(); await hold(c2, 1400);
  ok("point: a hidden structure in front is skipped (occlusion by isolate/hide)",
     CORE.pointState()?.structure === "liver_tumor");
  AIM = [orphan, liver];
  await hold(pcur(), 1400);
  ok("point: an unlisted mesh names nothing; the next real structure wins",
     CORE.pointState()?.structure === "liver");
  const pin = pcur(940, 540, true);
  await hold(pin, 1400);
  ok("point: a pinched (grabbing) hand clears the pointed-at structure", CORE.pointState() === null);
  AIM = [tumor];
  await hold(pcur(), 400, 0, 40);
  const sweep = pcur(); await hold(sweep, 1400, 0, 40);
  ok("point: a sweeping hand (40 px jitter) never settles, names nothing", CORE.pointState() === null);
  AIM = [tumor];
  await hold(pcur(), 1400, 1);
  ok("point: the second hand (index 1) points the same way", CORE.pointState()?.structure === "liver_tumor");
  await sleep(1000);                                   // both hands leave: no more frames
  ok("G3-2: tracking loss clears the published structure (no stale 'pointing at')",
     CORE.pointState() === null);
  // 3.5-2: two resting hands on different structures -> explicit ambiguity
  const h0 = pcur(), h1 = pcur(960, 560);
  const t0 = performance.now();
  while (performance.now() - t0 < 1500) {
    AIM = [tumor]; CORE.cursorFrame(h0, 0, lmsOpen);
    AIM = [liver]; CORE.cursorFrame(h1, 1, lmsOpen);
    await sleep(20);
  }
  const amb = CORE.pointState();
  ok("3.5-2: two hands on different structures publish ambiguity, naming neither",
     amb && amb.ambiguous === true && !("structure" in amb) &&
     amb.candidates.slice().sort().join() === "liver,liver_tumor", JSON.stringify(amb));
  const t1 = performance.now();
  while (performance.now() - t1 < 1500) {
    AIM = [tumor]; CORE.cursorFrame(h0, 0, lmsOpen); CORE.cursorFrame(h1, 1, lmsOpen);
    await sleep(20);
  }
  ok("3.5-2: two hands agreeing name the structure normally",
     CORE.pointState()?.structure === "liver_tumor" && !CORE.pointState().ambiguous);
}

console.log(`\n${pass} passed, ${fail} failed, ${xfail} known gaps (XFAIL), ${xpass} XPASS`);
process.exit(fail ? 1 : 0);
