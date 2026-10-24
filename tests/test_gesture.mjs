/* Unit harness for the cut gesture — the MATH, not the thresholds.
 *
 * No camera exists on this machine, so nothing here proves a gesture
 * feels right; it proves the geometry is not lying. Run:
 *   node tests/test_gesture.mjs
 * (it copies js/medical/*.js into tests/cutgest/ so the relative imports
 * and the lazy import("./gesture.js") resolve, then drives a synthetic hand.)
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "js", "medical");
const BOX = join(HERE, "cutgest");   // generated sandbox, gitignored
mkdirSync(BOX, { recursive: true });
for (const f of ["core.js", "gesture.js"])
  execSync(`cp ${JSON.stringify(join(SRC, f))} ${JSON.stringify(join(BOX, f))}`);
// render.js is imported lazily by paint(); a no-op stand-in keeps the
// console quiet without dragging three.js into node
writeFileSync(join(BOX, "render.js"),
  "export function paint(){} export function tick(){} export function dispose(){}\n");
writeFileSync(join(BOX, "package.json"), '{"type":"module"}\n');

// ---------------------------------------------------------- browser stubs
globalThis.location = { search: "" };
globalThis.document = { getElementById: () => null };
globalThis.innerWidth = 1920;
globalThis.innerHeight = 1080;
globalThis.addEventListener = () => {};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra ? "  " + extra : "")); }
};
const close = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const vclose = (a, b, e = 1e-6) =>
  a && b && a.length === b.length && a.every((v, i) => close(v, b[i], e));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const G = await import("./cutgest/gesture.js");
const CORE = await import("./cutgest/core.js");

// ------------------------------------------------------- synthetic hand
// Built in the CARD'S WORLD BASIS (+x right, +y up, +z toward the viewer)
// and converted back to raw MediaPipe landmark space with the exact
// inverse of palmNormal's mapping: raw.x = -X/A, raw.y = -Y, raw.z = -Z/A.
const A = 16 / 9;                       // the camera aspect under test
const add = (...vs) => vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]]);
const mul = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const unit = v => { const m = Math.hypot(...v); return m ? mul(v, 1 / m) : v; };
const toRaw = p => ({ x: -p[0] / A, y: -p[1], z: -p[2] / A });

/** u = wrist→knuckles ("up the palm"), w = index knuckle→pinky knuckle
 *  ("across it"). fold = which fingers curl back. splay = index/middle
 *  scissors angle. The palm normal of this hand is exactly u × w. */
function hand({ u, w, fold = [], splay = 0, span = 0.2 }) {
  u = unit(u); w = unit(w);
  const z = span / 0.2;                   // the whole hand scales together,
  const P = new Array(21).fill(null);     // so every ratio is distance-proof
  P[0] = [0, 0, 0];
  const m9 = mul(u, span);
  const mcp = { 5: add(m9, mul(w, -0.05 * z)), 9: m9,
                13: add(m9, mul(w, 0.025 * z)), 17: add(m9, mul(w, 0.05 * z)) };
  const splayOf = { 5: -splay, 9: splay, 13: 0, 17: 0 };
  for (const m of [5, 9, 13, 17]) {
    const base = mcp[m];
    P[m] = base;
    const dir = unit(add(u, mul(w, splayOf[m] || 0)));
    if (fold.includes(m)) {
      // folded: the distal segment points BACK against the proximal one
      P[m + 1] = add(base, mul(dir, 0.06 * z));
      P[m + 2] = add(base, mul(dir, 0.04 * z));
      P[m + 3] = add(base, mul(dir, 0.01 * z));
    } else {
      P[m + 1] = add(base, mul(dir, 0.06 * z));
      P[m + 2] = add(base, mul(dir, 0.10 * z));
      P[m + 3] = add(base, mul(dir, 0.13 * z));
    }
  }
  // thumb — off to the index side, out of the palm plane. No gate in
  // gesture.js reads it; it exists so the array is a real 21-hand.
  const n = unit(cross(u, w));
  for (let k = 1; k <= 4; k++)
    P[k] = add(mul(u, 0.04 * k * z), mul(w, (-0.06 - 0.02 * k) * z),
               mul(n, 0.01 * k * z));
  return P.map(toRaw);
}
/** what palmNormal SHOULD return for a hand built this way: u × w, turned
 *  to open toward the learner */
function expectN(u, w) {
  let n = unit(cross(unit(u), unit(w)));
  return n[2] > 0 ? mul(n, -1) : n;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]];
}

// ============================================================ 1. the palm
console.log("\n1. palm normal (known triangles)");
{
  // fingers up, knuckle row along +x: u × w = Y × X = −Z, a palm facing
  // the camera → a coronal-style plane, and already opening toward the
  // learner (z < 0), so no flip
  ok("palm to camera -> -Z", vclose(
    G.palmNormal(hand({ u: [0, 1, 0], w: [1, 0, 0] }), A), [0, 0, -1], 1e-9));
  // same palm, hand rotated 90° in the image: the plane must not care
  ok("rotated in-image -> still ±Z", vclose(
    G.palmNormal(hand({ u: [1, 0, 0], w: [0, 1, 0] }), A), [0, 0, -1], 1e-9));
  // palm edge-on (a karate chop): knuckles run away from the viewer
  ok("edge-on palm -> +X (sagittal)", vclose(
    G.palmNormal(hand({ u: [0, 1, 0], w: [0, 0, 1] }), A), [1, 0, 0], 1e-9));
  // 45° roll
  ok("45° roll -> (√½,0,−√½)", vclose(
    G.palmNormal(hand({ u: [0, 1, 0], w: unit([1, 0, 1]) }), A),
    [Math.SQRT1_2, 0, -Math.SQRT1_2], 1e-9));
  // an arbitrary, fully 3D orientation — the general case
  {
    const u = [0.2, 1, 0.35], w = [1, 0.15, -0.4];
    ok("arbitrary orientation matches u × w",
       vclose(G.palmNormal(hand({ u, w }), A), expectN(u, w), 1e-9));
  }
  // the returned normal is always unit and always opens toward the learner
  const many = [[0, 1, 0.3], [0.4, 1, -0.2], [-1, 0.2, 0.6]].map(
    uu => G.palmNormal(hand({ u: uu, w: unit(cross(uu, [0.3, 0.2, 1])) }), A));
  ok("always unit length", many.every(n => close(Math.hypot(...n), 1, 1e-9)));
  ok("always opens toward the learner (z<=0)", many.every(n => n[2] <= 1e-12));
  // THE ASPECT CORRECTION EARNS ITS KEEP: read that same hand with the
  // correction off and the plane comes back visibly turned — landmark x
  // and y are normalized against different extents, and a cross product
  // is exactly the operation that notices
  {
    const u = [0.2, 1, 0.35], w = [1, 0.15, -0.4];
    const want = expectN(u, w);
    const bad = G.palmNormal(hand({ u, w }), 1);
    const off = Math.acos(Math.min(1, Math.abs(dot(bad, want)))) * 180 / Math.PI;
    ok("aspect correction is not cosmetic (>5° when omitted)", off > 5,
       `off by ${off.toFixed(1)}°`);
  }
}

// ================================================== 2. world -> model local
console.log("\n2. screen/world -> model-local (a known rotation)");
// A minimal three stand-in: only the two calls toLocalDir makes, with
// textbook quaternion math, so the assertions below are checked against
// closed-form expectations rather than against the stub.
class Q {
  constructor(x = 0, y = 0, z = 0, w = 1) { Object.assign(this, { x, y, z, w }); }
  setFromAxisAngle(a, r) {
    const h = r / 2, s = Math.sin(h);
    this.x = a[0] * s; this.y = a[1] * s; this.z = a[2] * s; this.w = Math.cos(h);
    return this;
  }
  invert() { this.x *= -1; this.y *= -1; this.z *= -1; return this; }
}
class V3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  applyQuaternion(q) {
    const { x, y, z } = this;
    const ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z,
          iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
    this.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
    this.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
    this.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
    return this;
  }
  normalize() {
    const m = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= m; this.y /= m; this.z /= m; return this;
  }
}
function fakeScene(yaw) {
  return { THREE: { Quaternion: Q, Vector3: V3 },
           group: { getWorldQuaternion: t => t.setFromAxisAngle([0, 1, 0], yaw) } };
}
{
  ok("no rotation -> unchanged",
     vclose(G.toLocalDir(fakeScene(0), [0, 0, -1]), [0, 0, -1], 1e-9));
  // model yawed by θ: a coronal-looking cut on screen is local (sinθ,0,−cosθ)
  for (const th of [Math.PI / 2, Math.PI / 4, -1.1]) {
    const got = G.toLocalDir(fakeScene(th), [0, 0, -1]);
    ok(`yaw ${th.toFixed(2)} -> (sinθ,0,−cosθ)`,
       vclose(got, [Math.sin(th), 0, -Math.cos(th)], 1e-9),
       "got " + got.map(v => v.toFixed(4)));
  }
  // the classic bug this test exists for: using the FORWARD rotation
  ok("it inverts (forward rotation would flip the sign of x)",
     G.toLocalDir(fakeScene(Math.PI / 2), [0, 0, -1])[0] > 0.99);
}

// ================================================ 3. origin / spread / gates
console.log("\n3. plane origin, spread metric, pose metrics");
{
  ok("t=0.5 -> centred", vclose(G.originFor([0, 0, -1], 0.5), [0, 0, -0], 1e-9));
  ok("t=1 -> +1 along the normal", vclose(G.originFor([0, 0, -1], 1), [0, 0, -1]));
  ok("t=0 -> -1 along the normal", vclose(G.originFor([0, 0, -1], 0), [0, 0, 1]));
  ok("origin is monotone in t",
     G.originFor([0, 1, 0], 0.7)[1] > G.originFor([0, 1, 0], 0.6)[1]);
  ok("origin stays inside the bbox for any t/normal",
     [0, 0.25, 0.5, 0.75, 1].every(t =>
       G.originFor(unit([1, 1, 1]), t).every(v => Math.abs(v) <= 1 + 1e-9)));

  const flat = hand({ u: [0, 1, 0], w: [1, 0, 0] });
  const CUT_COOL_MS_TEST = 800;   // mirrors gesture.js CUT_COOL_MS (700) + margin
  const sciNarrow = hand({ u: [0, 1, 0], w: [1, 0, 0], fold: [13, 17], splay: 0 });
  const sciWide = hand({ u: [0, 1, 0], w: [1, 0, 0], fold: [13, 17], splay: 0.30 });
  const fist = hand({ u: [0, 1, 0], w: [1, 0, 0], fold: [5, 9, 13, 17] });
  ok("flat palm: every curl straight",
     [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
       .every(f => G.curl(flat, ...f) > 0.9));
  ok("fist: every curl folded back",
     [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]
       .every(f => G.curl(fist, ...f) < -0.9));
  ok("flat palm: every finger reaches (arch > 1.45)",
     [[8, 5], [12, 9], [16, 13], [20, 17]].every(f => G.arch(flat, ...f) > 1.45));
  ok("fist: every finger tucked (arch < 1.32)",
     [[8, 5], [12, 9], [16, 13], [20, 17]].every(f => G.arch(fist, ...f) < 1.32));
  ok("scissors: index+middle out, ring+pinky tucked",
     G.arch(sciNarrow, 8, 5) > 1.45 && G.arch(sciNarrow, 12, 9) > 1.45 &&
     G.arch(sciNarrow, 16, 13) < 1.32 && G.arch(sciNarrow, 20, 17) < 1.32);
  const s0 = G.spreadRatio(sciNarrow), s1 = G.spreadRatio(sciWide);
  ok("spread ratio grows with the splay", s1 > s0,
     `${s0.toFixed(3)} -> ${s1.toFixed(3)}`);
  ok("spread stroke clears SPREAD_ENGAGE (0.12)", s1 - s0 > 0.12,
     `Δ=${(s1 - s0).toFixed(3)}`);
  // the yardstick claim: ratios are distance-proof
  const far = hand({ u: [0, 1, 0], w: [1, 0, 0], fold: [13, 17], splay: 0.30,
                     span: 0.08 });
  ok("spread ratio is camera-distance proof",
     close(G.spreadRatio(far), s1, 1e-9));
}

// ================================================ 4. the state machine
console.log("\n4. armed/disarmed state machine (synthetic driver)");
{
  const rect = { left: 100, top: 100, right: 580, bottom: 580,
                 width: 480, height: 480 };
  const el = { isConnected: true, getBoundingClientRect: () => rect };
  el.parentElement = { children: [el] };
  const sc = { canvas: { parentElement: el }, THREE: { Quaternion: Q, Vector3: V3 },
               group: { getWorldQuaternion: t => t.setFromAxisAngle([0, 1, 0], 0) },
               scene: { traverse: () => {} } };
  CORE.onModelLoaded(sc, "media/models/heart/heart.glb");
  await sc.med.ready;
  sc.med.idx = { meshes: [], meshSid: new Map(), byStruct: new Map(),
                 nodeSid: new Map() };            // stand in for a sidecar
  const ctx = { items: [{ type: "model", el, def: {}, grabbedBy: [] }],
                findItem: () => null };
  const cur = { x: 0, y: 0, pinched: false, el: { classList: { remove() {} } } };

  const swipe = async (lms) => {                  // a flat palm crossing it
    for (let k = 0; k < 16; k++) {
      cur.x = 180 + k * 25; cur.y = 340;
      CORE.cursorFrame(cur, 0, typeof lms === "function" ? lms(k) : lms);
      await sleep(15);
    }
  };
  const flat = hand({ u: [0, 1, 0], w: [1, 0, 0] });
  const CUT_COOL_MS_TEST = 800;   // mirrors gesture.js CUT_COOL_MS (700) + margin

  // --- disarmed: the same swipe must do nothing at all
  await swipe(flat);
  ok("DISARMED: a flat swipe writes no cut", sc.med.st.cut === null);

  // --- arm it
  CORE.applyCmd({ a: "cut", arm: 1 }, ctx);
  await sc.med.ready; await sleep(30);            // lets import(gesture.js) land
  ok("arm:1 -> armed", sc.med.st.cut && sc.med.st.cut.arm === 1);
  ok("arm:1 seeds a default plane (upstream cut behaviour)",
     sc.med.st.cut.plane === "axial");
  ok("armedScene() finds it", CORE.armedScene() === sc);

  // --- the incision
  await swipe(flat);
  const p = sc.med.st.cut.plane;
  ok("ARMED: the swipe wrote a CUSTOM plane", !!(p && p.n && p.o),
     "plane = " + JSON.stringify(p));
  ok("its normal is unit length", close(Math.hypot(...p.n), 1, 1e-3),
     JSON.stringify(p && p.n));
  ok("a palm facing the camera cuts across Z (coronal-ish)",
     Math.abs(p.n[2]) > 0.99, JSON.stringify(p && p.n));
  ok("origin components stay inside the bbox (-1..1)",
     p.o.every(v => Math.abs(v) <= 1));
  ok("t is published for the bus", typeof sc.med.st.cut.t === "number" &&
     sc.med.st.cut.t >= 0 && sc.med.st.cut.t <= 1);

  // --- one stroke = one cut (no re-cut every frame)
  const after = JSON.stringify(sc.med.st.cut);
  cur.x = 700; CORE.cursorFrame(cur, 0, flat);    // still flat, off the card
  cur.x = 400; CORE.cursorFrame(cur, 0, flat);
  ok("a spent stroke does not re-cut", JSON.stringify(sc.med.st.cut) === after);

  // --- THE SUSPENSION LAW
  cur.x = 300; cur.y = 300; cur.pinched = false;
  CORE.cursorFrame(cur, 0, flat);                 // seen open inside the card
  cur.pinched = true;
  CORE.cursorFrame(cur, 0, flat);
  ok("SUSPENSION: a pinch over the armed model is cleared", cur.pinched === false);
  cur.x = 900; cur.pinched = true;                // off the card: normal rules
  CORE.cursorFrame(cur, 0, flat);
  ok("off the model the pinch is left alone", cur.pinched === true);
  cur.pinched = false;

  // --- the scissors scrub
  const t0 = sc.med.st.cut.t;
  cur.x = 340; cur.y = 340;
  for (let k = 0; k <= 12; k++) {
    const sp = 0.30 * (k / 12);
    CORE.cursorFrame(cur, 0,
      hand({ u: [0, 1, 0], w: [1, 0, 0], fold: [13, 17], splay: sp }));
    await sleep(20);
  }
  const t1 = sc.med.st.cut.t;
  ok("SCRUB: spreading two fingers moved t", Math.abs(t1 - t0) > 0.02,
     `t ${t0} -> ${t1}`);
  ok("SCRUB: wider = deeper (SPREAD_DIR)", t1 > t0);
  ok("SCRUB: t stays in 0..1", t1 >= 0 && t1 <= 1);
  ok("SCRUB: it moved the plane ORIGIN too (custom planes ignore t)",
     JSON.stringify(sc.med.st.cut.plane.o) !== JSON.stringify(p.o));
  ok("SCRUB: it did not re-orient the plane",
     JSON.stringify(sc.med.st.cut.plane.n) === JSON.stringify(p.n));

  // --- THE RELEASE GUARD: a scrub ends by opening the hand while it is
  // still travelling, which is shaped exactly like an incision. Field bug:
  // "when I explode scrub it's getting cut".
  {
    const before = JSON.stringify(sc.med.st.cut);
    cur.pinched = true;                       // the scrub grip
    CORE.cursorFrame(cur, 0, flat); await sleep(15);
    cur.pinched = false;                      // released, hand opens flat...
    cur.lastPinchT = performance.now();       // ...and stage.html stamps this
    await swipe(flat);                        // ...and keeps travelling
    ok("RELEASE GUARD: a scrub's follow-through does not cut",
       JSON.stringify(sc.med.st.cut) === before);
    // and once the guard window passes, cutting works again. Reset to a
    // PRESET plane first: an identical pose over an identical path writes an
    // identical custom plane, so "the value changed" cannot see the cut.
    sc.med.st.cut.plane = "axial";
    await sleep(CUT_COOL_MS_TEST);            // let the previous commit's
                                              // cooldown expire, or the
                                              // stroke cannot even arm
    cur.lastPinchT = performance.now() - 2000;
    await swipe(flat);
    const p2 = sc.med.st.cut.plane;
    ok("RELEASE GUARD: a real swipe still cuts after the window",
       !!(p2 && p2.n && p2.o), "plane = " + JSON.stringify(p2));
  }

  // --- the idle disarm
  // just under the idle window: must still be armed (a cut being lined up
  // is not an abandoned one — this is the case 20s got wrong in the field)
  sc.med.cutT = performance.now() - 60000;
  CORE.tick(sc);
  ok("IDLE: a minute of thinking does NOT disarm", sc.med.st.cut.arm === 1);
  sc.med.cutT = performance.now() - 181000;
  CORE.tick(sc);
  ok("IDLE: 3min without cut activity disarms", sc.med.st.cut.arm === 0);
  ok("IDLE: the cut itself SURVIVES the disarm", !!sc.med.st.cut.plane);
  const frozen = JSON.stringify(sc.med.st.cut);
  await swipe(flat);
  ok("DISARMED again: hands no longer cut",
     JSON.stringify(sc.med.st.cut) === frozen);

  // --- explicit disarm + off
  CORE.applyCmd({ a: "cut", arm: 1 }, ctx); await sleep(10);
  ok("re-arm works", sc.med.st.cut.arm === 1);
  CORE.applyCmd({ a: "cut", arm: 0 }, ctx); await sleep(10);
  ok("arm:0 disarms", sc.med.st.cut.arm === 0);
  CORE.applyCmd({ a: "cut", arm: 1 }, ctx); await sleep(10);
  CORE.applyCmd({ a: "cut", off: 1 }, ctx); await sleep(10);
  ok("off:1 clears the cut entirely", sc.med.st.cut === null);
  ok("off:1 leaves nothing armed", CORE.armedScene() === null);
  cur.pinched = true; cur.x = 300;
  CORE.cursorFrame(cur, 0, flat);
  ok("with nothing armed the pinch is never suspended", cur.pinched === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
