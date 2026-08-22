/* barehands, anatomy edition — THE MEDICAL BRAIN.
 *
 * Everything the seven medical verbs need that is NOT pixels: the
 * anatomy.json sidecar, the mesh→structure index, the per-model medical
 * state, verb application, cursor pointing, and the state-bus
 * (de)serialization. The pixels live next door in ./render.js, which is
 * imported LAZILY — a board with no medical model never pays for it.
 *
 * The law here is FAIL SOFT. A model with no anatomy.json sidecar is
 * simply a normal barehands hologram: every entry point below early-outs
 * and the page behaves exactly as it did upstream. Nothing in this file
 * may ever throw into the tracker's frame loop.
 *
 * three.js is never imported here: every scene bundle carries its own
 * `sc.THREE` namespace (see stage.html's buildModelScene), so this module
 * shares the page's single three instance without a second import.
 *
 * Contracts: schemas/verbs.md (verbs + bus field names),
 *            schemas/anatomy.schema.md (the sidecar).
 */

const VERBS = new Set(["cut", "isolate", "hide", "label", "xray",
                       "lesion", "layer"]);
// the render page is ON AIR — a toast there is a caption the audience reads
const IS_RENDER = new URLSearchParams(location.search).get("role") === "render";
const LABEL_CAP = 12;          // schemas/verbs.md caps a label list at 12

const BY_EL = new Map();       // card element -> scene bundle
const SCENES = new Set();      // every live medical-capable scene bundle
const EMPTY = Object.freeze({});

let R = null, _rp = null;      // ./render.js, once a medical model appears
function needRender() {
  if (R) return Promise.resolve(R);
  if (!_rp) _rp = import("./render.js")
    .then(m => (R = m))
    .catch(e => { console.warn("[medical] render.js failed to load", e); return null; });
  return _rp;
}

// ./gesture.js — the cutting HAND. Lazier still than render.js: a board
// that never arms a cut never loads a line of hand math.
let G = null, _gp = null;
function needGesture() {
  if (G || _gp) return;
  _gp = import("./gesture.js")
    .then(m => (G = m))
    .catch(e => { console.warn("[medical] gesture.js failed to load", e); });
}

export function toast(msg, ms = 2500) {
  if (IS_RENDER) return;
  try {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.style.display = "none"), ms);
  } catch (e) {}
}

// ---------------------------------------------------------------- globs
// anatomy.json's `meshes` patterns are fnmatch (schemas/anatomy.schema.md),
// which the client has to honor identically or validate.py and the board
// disagree about which mesh is which. */?/[seq], case-sensitive.
export function globRe(p) {
  let out = "^";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "*") out += "[\\s\\S]*";
    else if (ch === "?") out += "[\\s\\S]";
    else if (ch === "[") {
      let j = i + 1, neg = false;
      if (p[j] === "!") { neg = true; j++; }
      if (p[j] === "]") j++;                       // a leading ] is literal
      while (j < p.length && p[j] !== "]") j++;
      if (j >= p.length) out += "\\[";             // unterminated = literal
      else {
        let body = p.slice(i + 1, j);
        if (neg) body = "^" + body.slice(1);
        out += "[" + body + "]";
        i = j;
      }
    } else out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(out + "$");
}

// exact names beat globs, then longer patterns beat shorter ones — so
// "lv_wall" wins over "lv_*" and "LV_apex_*" wins over "LV_*"
function patScore(p) { return /[*?[\]]/.test(p) ? p.length : 1000 + p.length; }

// ------------------------------------------------------------ structures
// a structure id, or the alias that points at one (null if neither)
export function sid(M, id) {
  if (!id || !M) return null;
  if (M.structs[id]) return id;
  const a = M.aliases && M.aliases[id];
  return a && M.structs[a] ? a : null;
}

// a structure AND everything nested inside it — every verb that names one
// structure means "this and its children" (isolate the ventricle, its
// papillary muscles come with it)
export function kin(M, id) {
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    const s = stack.pop();
    if (!s || out.has(s) || !M.structs[s]) continue;
    out.add(s);
    for (const c of M.structs[s].children || []) stack.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- state
function newState(src) {
  return {
    src: src || "",
    doc: null, structs: {}, aliases: {}, idx: null, ready: null,
    // the medical state itself — the only thing the bus carries
    st: { cut: null, iso: null, hid: new Set(), lb: [],
          xray: null, layer: null, les: null },
    // render.js's bookkeeping (originals, clones, overlay, clip plane)
    orig: new Map(), vis0: new Map(), clones: new Set(), ghost: null,
    labels: new Map(), anchors: new Map(), lbox: null, anchorT: 0,
    plane: null, planeL: null, lb3: null,
    ptS: null,                   // structure this scene is pointed at
    rsig: "",                    // last bus signature (render-page diffing)
  };
}

function paint(sc) { needRender().then(m => { try { if (m) m.paint(sc); } catch (e) { console.warn("[medical] paint", e); } }); }

// -------------------------------------------------------------- sidecar
// The sidecar sits next to the GLB. A model staged out of media/holo/
// falls back to the same subpath under media/models/, so the blue-wire
// copy of an organ still finds the anatomy the solid copy owns.
function sidecarURLs(src) {
  const q = (src || "").split("?")[0];
  const i = q.lastIndexOf("/");
  if (i < 0) return [];
  const dir = q.slice(0, i + 1);
  const out = [dir + "anatomy.json"];
  if (/^\/?media\/holo\//i.test(dir))
    out.push(dir.replace(/^(\/?)media\/holo\//i, "$1media/models/") + "anatomy.json");
  return out;
}

async function loadSidecar(sc, src) {
  const M = sc.med;
  for (const u of sidecarURLs(src)) {
    let doc = null;
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) continue;                 // 404 = an ordinary, non-medical model
      doc = await r.json();
    } catch (e) { continue; }
    if (!doc || doc.schema !== "barehands-anatomy/1" || !doc.structures) {
      console.warn("[medical] ignoring malformed sidecar", u);
      continue;
    }
    M.doc = doc;
    M.structs = doc.structures;
    M.aliases = doc.aliases || {};
    M.idx = buildIndex(sc);
    return M.idx;
  }
  return null;
}

// mesh/node name -> structure id, built ONCE per loaded model. Patterns
// are matched against every NAMED node (not just meshes) so a sidecar may
// name the group a structure lives under; a mesh then inherits the
// nearest named ancestor's structure.
function buildIndex(sc) {
  const M = sc.med, pats = [];
  for (const id in M.structs)
    for (const p of M.structs[id].meshes || [])
      pats.push({ re: globRe(p), sid: id, raw: p, score: patScore(p) });

  const nodeSid = new Map(), amb = [];
  sc.scene.traverse(n => {
    if (!n.name) return;
    let best = null, tie = null;
    for (const p of pats) {
      if (!p.re.test(n.name)) continue;
      if (!best || p.score > best.score) { best = p; tie = null; }
      else if (p.score === best.score && p.sid !== best.sid) tie = p;
    }
    if (!best) return;
    // longest-pattern-wins settles it, but a true tie is an authoring bug
    // in the sidecar — say so out loud rather than picking silently
    if (tie) amb.push(`${n.name}: "${best.raw}"→${best.sid} vs "${tie.raw}"→${tie.sid}`);
    nodeSid.set(n, best.sid);
  });

  const meshes = [], meshSid = new Map(), byStruct = new Map();
  sc.scene.traverse(n => {
    if (!n.isMesh) return;
    meshes.push(n);
    let p = n, s;
    while (p && s === undefined) { s = nodeSid.get(p); p = p.parent; }
    if (s === undefined) return;
    meshSid.set(n, s);
    if (!byStruct.has(s)) byStruct.set(s, []);
    byStruct.get(s).push(n);
  });

  if (amb.length)
    console.warn("[medical] ambiguous mesh→structure match in " + M.src +
                 "\n  " + amb.join("\n  "));
  const orphan = meshes.length - meshSid.size;
  if (orphan)
    console.warn(`[medical] ${orphan}/${meshes.length} meshes in ${M.src} ` +
                 "match no structure (run schemas/validate.py)");
  return { meshes, meshSid, byStruct, nodeSid };
}

// THE MISSING-NORMALS FIX. Segmented medical exports routinely ship
// POSITION and nothing else — the BodyParts3D-derived heart does. glTF says
// render a normal-less primitive flat, and three's GLTFLoader obliges by
// flat-shading the standard material, so the SOLID view looks perfectly
// fine and the gap stays invisible. A custom shader does not get that
// courtesy: it reads the `normal` attribute, receives zeroes, and
// normalize(vec3(0)) is NaN — which is why the x-ray ghost drew literally
// nothing (zero non-white pixels) until this ran. Compute them once, at
// load, for any medical model that arrives without them.
function ensureNormals(sc) {
  let fixed = 0;
  sc.scene.traverse(n => {
    const g = n.isMesh && n.geometry;
    if (!g || !g.attributes || !g.attributes.position) return;
    if (g.attributes.normal) return;
    try { g.computeVertexNormals(); fixed++; } catch (e) {}
  });
  if (fixed)
    console.info(`[medical] computed vertex normals for ${fixed} mesh(es) in ` +
                 `${sc.med.src} — the file shipped none`);
}

/** True for a model this layer owns (one that found an anatomy sidecar).
 *  stage.html's idle spin asks before turning: upstream drifts every model
 *  a slow +0.12 rad/s because "a hologram that sits dead-still reads as a
 *  picture" — right for a prop, wrong for a specimen. You cannot point at a
 *  structure that is sliding out from under the cursor (the pointing gate
 *  wants the same structure held for 150ms, which a drifting model never
 *  gives), and a cross-section you are studying should stay where you cut
 *  it. Only the constant idle drift is removed — spin it by hand and the
 *  momentum still coasts down exactly as upstream does. */
export function stillModel(it) {
  try {
    const sc = it && it.el && BY_EL.get(it.el);
    return !!(sc && sc.med && sc.med.idx);
  } catch (e) { return false; }
}

// THE GRAB SHRINK. A model card is a fixed 480px square whatever the organ
// inside it looks like, and the heart fills less than half of it — so most
// of the grab area is empty air, and it grows with scale: blown up 6x, the
// card claims a ~2880px zone with an organ floating in the middle of it.
// Field consequence: you cannot pinch NEAR the heart without seizing it,
// which is exactly the empty pinch the explode scrub needs. So hit-testing
// a medical model uses the organ's own projected silhouette instead of its
// card. Recomputed on a short TTL because explode moves the parts.
const HIT_TTL = 250, HIT_PAD = 14;

function modelBox(sc) {
  const M = sc.med, THREE = sc.THREE, now = performance.now();
  if (M.hitBox !== undefined && now - (M.hitBoxT || 0) < HIT_TTL) return M.hitBox;
  M.hitBoxT = now;
  const b = new THREE.Box3(), t = new THREE.Box3(), mm = new THREE.Matrix4();
  sc.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(sc.group.matrixWorld).invert();
  for (const m of M.idx.meshes) {
    if (!m.visible || !m.geometry) continue;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    if (!m.geometry.boundingBox) continue;
    t.copy(m.geometry.boundingBox);
    mm.multiplyMatrices(inv, m.matrixWorld);
    t.applyMatrix4(mm);
    b.union(t);
  }
  return (M.hitBox = b.isEmpty() ? null : b);
}

/** The organ's silhouette in screen space, or null to fall back to the card
 *  (stage.html's hitTest asks). Null for anything non-medical, so upstream
 *  props keep their generous card-sized grab exactly as before. */
export function hitRect(it) {
  try {
    const sc = it && it.el && BY_EL.get(it.el);
    const M = sc && sc.med;
    if (!M || !M.idx || !sc.canvas) return null;
    const el = sc.canvas.parentElement;
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    const b = modelBox(sc);
    if (!b) return null;
    const THREE = sc.THREE, v = new THREE.Vector3();
    sc.group.updateMatrix();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {          // the box's own eight corners
      v.set(i & 1 ? b.max.x : b.min.x,
            i & 2 ? b.max.y : b.min.y,
            i & 4 ? b.max.z : b.min.z);
      v.applyMatrix4(sc.group.matrix).project(sc.camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const sx = n => r.left + (n * 0.5 + 0.5) * r.width;
    const sy = n => r.top + (-n * 0.5 + 0.5) * r.height;
    // clamped to the card: a projection can run off it, and a grab zone
    // larger than the card would be worse than the thing we are fixing
    return {
      left: Math.max(r.left, sx(x0) - HIT_PAD),
      right: Math.min(r.right, sx(x1) + HIT_PAD),
      top: Math.max(r.top, sy(y1) - HIT_PAD),
      bottom: Math.min(r.bottom, sy(y0) + HIT_PAD),
    };
  } catch (e) { return null; }
}

// ----------------------------------------------------------- entry points
export function handles(a) { return VERBS.has(a); }

/** Called once per model scene, from BOTH pages. Fire-and-forget: a model
 *  with no sidecar leaves `sc.med.idx` null and every verb below toasts
 *  instead of touching it. */
export function onModelLoaded(sc, src) {
  try {
    if (!sc || !sc.canvas) return null;
    if (sc.med) return sc.med.ready;
    const M = (sc.med = newState(src));
    const el = sc.canvas.parentElement;
    if (el) BY_EL.set(el, sc);
    SCENES.add(sc);
    ensureNormals(sc);          // before any custom shader can read them
    M.ready = loadSidecar(sc, src)
      .catch(e => { console.warn("[medical] sidecar", e); return null; });
    return M.ready;
  } catch (e) { return null; }
}

/** Per model scene, per frame (tracker: renderModels; render page: folded
 *  into applyRemote). Cheap by design — it only touches scenes that have
 *  a live cut plane or labels on screen. */
export function tick(sc) {
  try {
    const M = sc && sc.med;
    if (!M || !M.idx) return;
    // THE IDLE DISARM — checked here (not in gestureFrame) because it has
    // to fire with NO hands in frame: that is exactly the case it exists
    // for, a mode someone armed and walked away from.
    if (M.st.cut && M.st.cut.arm &&
        performance.now() - (M.cutT || 0) > ARM_IDLE_MS)
      disarmCut(sc, "cut mode timed out — say the word to arm it again");
    if (!R) return;
    const base = M.src.split("/").pop();
    M.ptS = PT.pub && PT.pub.model === base ? PT.pub.structure : null;
    R.tick(sc);
  } catch (e) {}
}

/** stage.html's disposeScene hands the scene over before it tears down the
 *  geometry, so originals go back on their meshes and only OUR clones get
 *  disposed here (disposeScene disposes the originals right after). */
export function onDispose(sc) {
  try {
    if (!sc) return;
    const el = sc.canvas && sc.canvas.parentElement;
    if (el) BY_EL.delete(el);
    SCENES.delete(sc);
    if (sc.med && R) R.dispose(sc);
    sc.med = null;
  } catch (e) {}
}

// ------------------------------------------------------- ARMED CUT MODE
// The hand only ever cuts a model that was EXPLICITLY ARMED
// ({"a":"cut","arm":1} — the assistant says "let's cut it open"). That one
// bit is the whole false-positive defense: while armed, the grab
// vocabulary is suspended over that model (gesture.js's SUSPENSION LAW),
// so a cutting hand cannot also throw the organ across the room. Nothing
// here stacks a threshold to tell cutting from grabbing; the mode does it.
// A forgotten armed mode must not eat gestures forever — but 20s was set
// by guesswork and field use killed it immediately: a learner lines up a
// cut, thinks, adjusts the organ, and the mode is gone before the first
// swipe, with no way back except asking the agent to re-arm. Three minutes
// is long enough to actually work and still short enough that a walked-away
// board returns to normal on its own.
const ARM_IDLE_MS = 180000;

/** The scene whose cut is armed, or null. Topmost wins if two ever are
 *  (same "latest among #behind's children" rule pick() uses). */
export function armedScene() {
  let best = null, z = -1;
  for (const s of SCENES) {
    const M = s.med;
    if (!M || !M.idx || !M.st.cut || !M.st.cut.arm) continue;
    const e = s.canvas && s.canvas.parentElement;
    if (!e || !e.isConnected) continue;
    const d = e.parentElement
      ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
    if (d > z) { z = d; best = s; }
  }
  return best;
}

/** gesture.js's ONLY write path — it never touches sc.med.st itself, so
 *  every cut (agent's or hand's) lands through the same verb. */
export function cutFromGesture(sc, patch) {
  try {
    if (!sc || !sc.med) return;
    sc.med.cutT = performance.now();          // the idle clock, reset
    applyVerb(sc, Object.assign({ a: "cut" }, patch));
  } catch (e) { console.warn("[medical] cutFromGesture", e); }
}

/** Hand activity that isn't itself a cut edit (a swipe forming, a scrub
 *  engaging) still counts as "someone is using this" for the idle clock. */
export function noteCutActivity(sc) {
  if (sc && sc.med) sc.med.cutT = performance.now();
}

/** Toggle cut mode from the keyboard (X on the tracker). Arming used to
 *  require the agent to POST a command, which is a preposterous thing to
 *  need mid-gesture — you are standing with your hands in the air. This is
 *  the same idiom R / C / D / P already use, and it carries zero
 *  false-positive risk, which no new hand pose could promise: the obvious
 *  candidate, holding a flat palm at the organ, is the POINTING pose, so it
 *  would arm the cut every time someone asked what a structure was. */
export function toggleArm() {
  try {
    const on = armedScene();
    if (on) { disarmCut(on, "cut disarmed — grab is yours again"); return; }
    // the freshest medical model on the board, matching how the verbs target
    let sc = null, z = -1;
    for (const s of SCENES) {
      if (!s.med || !s.med.idx) continue;
      const e = s.canvas && s.canvas.parentElement;
      if (!e || !e.isConnected) continue;
      const d = e.parentElement
        ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
      if (d > z) { z = d; sc = s; }
    }
    if (!sc) { toast("no anatomy model on the board to cut", 2400); return; }
    const st = sc.med.st;
    st.cut = st.cut || { plane: "axial", t: 0.5, arm: 0 };
    st.cut.arm = 1;
    noteCutActivity(sc);
    toast("cut ARMED — flat palm swipes the plane, scissors spread it", 3000);
    paint(sc);
  } catch (e) {}
}

export function disarmCut(sc, why) {
  try {
    const st = sc && sc.med && sc.med.st;
    if (!st || !st.cut || !st.cut.arm) return;
    st.cut.arm = 0;                            // the plane STAYS; only the
    if (why) toast(why, 2000);                 // hands let go of it
  } catch (e) {}
}

/** Per cursor per frame, from cursorFrame below — the raw landmarks come
 *  with it because palm geometry can't be read off a cursor dot. All the
 *  hand math lives in gesture.js; this is only the doorway. */
export function gestureFrame(cur, i, lms) {
  try { if (G && lms) G.gestureFrame(cur, i, lms); } catch (e) {}
}

// ------------------------------------------------------------- the verbs
/** applyCmds' medical branch. ctx = {items, findItem} — the same targeting
 *  the explode verb uses: title-match first, else the freshest model. */
export function applyCmd(c, ctx) {
  try {
    let t = c.title ? ctx.findItem(c.title) : null;
    if (!t || t.type !== "model")
      t = ctx.items.filter(k => k.type === "model" && k.el.isConnected).pop();
    if (!t) { toast("no model on the board", 2200); return; }
    const sc = BY_EL.get(t.el);
    if (!sc) { toast("the model is still loading", 1800); return; }
    // verbs may land before the sidecar fetch settles — queue on it
    (sc.med.ready || Promise.resolve()).then(() => applyVerb(sc, c));
  } catch (e) { console.warn("[medical] applyCmd", e); }
}

function applyVerb(sc, c) {
  const M = sc.med, st = M.st;
  if (!M.idx) { toast("no anatomy data for this model", 2400); return; }
  // an unknown structure on a model that HAS a sidecar is a no-op + a
  // toast, never a silent nothing (schemas/verbs.md)
  const need = id => {
    const s = sid(M, id);
    if (!s) toast(`unknown structure: ${id}`, 2400);
    return s;
  };
  switch (c.a) {
    case "cut": {
      if (c.off) { st.cut = null; break; }
      const cut = st.cut || { plane: "axial", t: 0.5, arm: 0 };
      if (c.plane != null) cut.plane = c.plane;   // server already normalized {o,n}
      if (c.t != null) cut.t = c.t;
      if (c.arm != null) {
        const was = cut.arm;
        cut.arm = c.arm ? 1 : 0;
        M.cutT = performance.now();               // arm/disarm restarts the clock
        if (cut.arm && !was) {
          needGesture();                          // the hand math loads HERE
          toast("cut armed — flat-palm swipe across it to slice; " +
                "two fingers spread to scrub the depth", 3600);
        } else if (!cut.arm && was) toast("cut mode off", 1400);
      }
      st.cut = cut;
      break;
    }
    case "isolate": {
      if (c.off) { st.iso = null; break; }
      const s = need(c.structure); if (!s) return;
      st.iso = s;
      break;
    }
    case "hide": {
      if (c.off) { st.hid.clear(); break; }       // off clears the whole set
      const s = need(c.structure); if (!s) return;
      st.hid.add(s);
      break;
    }
    case "label": {
      if (c.off) { st.lb = []; break; }
      let ids;
      if (c.structures === "all") {
        // "all" on a deep model is unreadable soup — shallowest first,
        // capped, and say what got dropped
        ids = Object.keys(M.structs).sort(
          (a, b) => (M.structs[a].layer || 0) - (M.structs[b].layer || 0));
        if (ids.length > LABEL_CAP) {
          toast(`${ids.length} structures — labelling the ${LABEL_CAP} shallowest`, 2800);
          ids = ids.slice(0, LABEL_CAP);
        }
      } else {
        ids = (c.structures || []).map(x => sid(M, x)).filter(Boolean);
        if (!ids.length) { toast("no known structures in that list", 2400); return; }
      }
      st.lb = ids;
      break;
    }
    case "xray": {
      if (c.off) { st.xray = null; break; }
      const f = c.focus ? need(c.focus) : null;
      if (c.focus && !f) return;
      st.xray = { focus: f };
      break;
    }
    case "layer":
      st.layer = c.off ? null : (c.depth | 0);
      break;
    case "lesion":
      if (c.off) { st.les = null; break; }
      loadLesion(sc, c.case, c.lesion);           // async — repaints itself
      return;
    default:
      return;
  }
  paint(sc);
}

// /case-render is the LEARNER-VISIBLE slice of a case (never the vignette,
// never the diagnosis — see schemas/case.schema.md). Both pages fetch it
// themselves so the bus only carries the two ids.
async function loadLesion(sc, cid, lid) {
  const M = sc.med;
  try {
    const r = await fetch("/case-render?id=" + encodeURIComponent(cid),
                          { cache: "no-store" });
    if (!r.ok) { toast(`case not found: ${cid}`, 2600); return; }
    const doc = await r.json();
    const l = (doc.lesions || []).find(x => x && x.id === lid);
    if (!l) { toast(`no lesion "${lid}" in ${cid}`, 2600); return; }
    const rn = l.render || {};
    if (rn.kind !== "tint") {
      toast(`lesion render "${rn.kind || "?"}" not yet supported`, 2800);
      return;
    }
    const s = sid(M, l.structure);
    if (!s) { toast(`lesion structure not on this model: ${l.structure}`, 2800); return; }
    M.st.les = {
      case: cid, lesion: lid, structure: s,
      // `spread` is optional — a lesion that reads across neighbours
      spread: (rn.spread || []).map(x => sid(M, x)).filter(Boolean),
      color: rn.color || "#b23b3b",
      intensity: Math.max(0, Math.min(1, +rn.intensity || 0.7)),
    };
    paint(sc);
  } catch (e) { toast("lesion load failed", 2200); }
}

// ------------------------------------------------------------- the bus
/** Merged into each serialized item by pushState. Short keys on purpose —
 *  the heartbeat has a 256KB budget (schemas/verbs.md). Absent when
 *  default, so a non-medical item serializes byte-for-byte as before. */
export function itemState(i) {
  try {
    const sc = i && i.el && BY_EL.get(i.el);
    const M = sc && sc.med;
    if (!M || !M.idx) return EMPTY;
    const st = M.st, o = {};
    if (st.cut) o.cut = { plane: st.cut.plane, t: +(+(st.cut.t ?? 0.5)).toFixed(3) };
    if (st.iso) o.iso = st.iso;
    if (st.hid.size) o.hid = [...st.hid];
    if (st.lb.length) o.lb = st.lb.slice();
    // xr/ly/les are NOT in schemas/verbs.md's four documented fields — they
    // are additive, and they exist because the render page has no /cmd
    // path: without them xray/layer/lesion could never reach the overlay.
    // xr is the focus id, or 1 for a focus-less x-ray.
    if (st.xray) o.xr = st.xray.focus || 1;
    if (st.layer != null) o.ly = st.layer;
    if (st.les) o.les = { case: st.les.case, lesion: st.les.lesion };
    return o;
  } catch (e) { return EMPTY; }
}

/** Top-level `pt` on the heartbeat — what the cursor is pointing at across
 *  the whole board. null when nothing is (pushState drops the key). */
export function pointState() { return PT.pub || null; }

/** The render page's ONLY driver: it never runs applyCmds, so bus state IS
 *  its command channel. Idempotent — a signature diff means a repaint only
 *  happens when a field actually changed. */
export function applyRemote(sc, it) {
  try {
    if (!sc || !sc.canvas || !it) return;
    if (!sc.med) {
      // nothing medical has ever been true of this item: stay out entirely
      if (!it.cut && !it.iso && !it.hid && !it.lb &&
          it.xr == null && it.ly == null && !it.les) return;
      onModelLoaded(sc, it.src);
    }
    const M = sc.med;
    if (!M) return;
    const sig = [it.cut ? JSON.stringify(it.cut) : "", it.iso || "",
                 (it.hid || []).join(","), (it.lb || []).join(","),
                 it.xr == null ? "" : it.xr, it.ly == null ? "" : it.ly,
                 it.les ? it.les.case + "/" + it.les.lesion : ""].join("|");
    if (sig !== M.rsig) {
      M.rsig = sig;
      (M.ready || Promise.resolve()).then(() => {
        if (!M.idx) return;                  // no sidecar on this page either
        const st = M.st, les = it.les;
        st.cut = it.cut
          ? { plane: it.cut.plane, t: it.cut.t == null ? 0.5 : it.cut.t, arm: 0 }
          : null;
        st.iso = it.iso ? sid(M, it.iso) : null;
        st.hid = new Set((it.hid || []).map(x => sid(M, x)).filter(Boolean));
        st.lb = (it.lb || []).map(x => sid(M, x)).filter(Boolean);
        st.xray = it.xr == null ? null
                : { focus: typeof it.xr === "string" ? sid(M, it.xr) : null };
        st.layer = it.ly == null ? null : it.ly;
        if (!les) { st.les = null; paint(sc); }
        else if (!st.les || st.les.case !== les.case || st.les.lesion !== les.lesion)
          loadLesion(sc, les.case, les.lesion);   // paints when it lands
        else paint(sc);
      });
    }
    tick(sc);                                 // labels + clip plane, on air
  } catch (e) {}
}

// ------------------------------------------------------------- POINTING
// The core product interaction: an un-pinched fingertip over a model asks
// "what is this?". One raycast per cursor per ~40ms, debounced so a
// wobbling hand doesn't strobe the bus.
const HITS = new Map();        // cursor index -> {v, t, seen}
const PT = { candKey: "", candT: 0, cand: null, pubKey: "", pub: null };
const CAST_MS = 40;            // ~25Hz per cursor — a raycast is not free
// THE DWELL. 150ms of "same structure" was the original gate, and it was
// the wrong question: a hand sweeping across the organ stays on one big
// structure for the whole sweep, so moving your hand around narrated
// everything it brushed past. The real signal that someone is ASKING about
// a structure is that the hand STOPS on it. So the cursor must also hold
// still — the drift re-anchor idiom stage.html already uses for its
// hold-to-rotate latch.
const HOLD_MS = 600;           // stillness before it reaches the bus
const STILL_PX = 26;           // drift past this and the dwell restarts
let _rc = null;

/** One tracker cursor, once per frame, AFTER its pinch state settles.
 *  `lms` = that hand's raw MediaPipe landmarks (stage.html line ~2215) —
 *  the cutting hand needs palm geometry, not just the cursor dot. */
export function cursorFrame(cur, i, lms) {
  try {
    // THE PHYSICAL pinch, read BEFORE the gesture layer can clear it.
    // Armed cut mode suspends the pinch so the grab vocabulary lets go of
    // the organ — but a suspended pinch is still a CLOSED hand, and
    // pointing must not read it as an open one asking "what is this?"
    // (field-caught: with a cut armed, every pinch triggered narration).
    const closed = !cur || cur.pinched;
    gestureFrame(cur, i, lms);   // may suspend the pinch — runs after the read
    const now = performance.now();
    let h = HITS.get(i);
    if (!h) HITS.set(i, (h = { v: null, t: 0, seen: now }));
    h.seen = now;
    // the dwell anchor: any real movement restarts it, so only a hand that
    // has come to rest can name anything
    if (cur && (h.sx === undefined ||
                Math.hypot(cur.x - h.sx, cur.y - h.sy) > STILL_PX)) {
      h.sx = cur.x; h.sy = cur.y; h.still = now;
    }
    // a pinched hand is GRABBING, not asking — pointing is the open hand
    if (closed) { h.v = null; h.t = now; h.still = now; }
    else if (now - h.t >= CAST_MS) { h.v = pick(cur); h.t = now; }
    h.settled = !closed && now - (h.still ?? now) >= HOLD_MS;

    let merged = null;
    for (const [k, e] of HITS) {
      if (now - e.seen > 400) { HITS.delete(k); continue; }   // hand left frame
      if (e.v && e.settled && !merged) merged = e.v;
    }
    const key = merged
      ? merged.model + "|" + merged.structure + "|" + merged.mesh : "";
    if (key !== PT.candKey) { PT.candKey = key; PT.candT = now; PT.cand = merged; }
    else if (now - PT.candT >= HOLD_MS && PT.pubKey !== key) {
      PT.pubKey = key; PT.pub = merged;
    }
  } catch (e) {}
}

function pick(cur) {
  let sc = null, el = null, z = -1;
  for (const s of SCENES) {
    const M = s.med;
    if (!M || !M.idx) continue;
    const e = s.canvas && s.canvas.parentElement;
    if (!e || !e.isConnected) continue;
    const r = e.getBoundingClientRect();
    if (cur.x < r.left || cur.x > r.right || cur.y < r.top || cur.y > r.bottom)
      continue;
    // topmost = latest among #behind's children (a grab re-appends its card)
    const d = e.parentElement
      ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
    if (d > z) { z = d; sc = s; el = e; }
  }
  if (!sc) return null;
  const r = el.getBoundingClientRect();
  // Screen -> the model canvas's own NDC. The card is a fixed 480px square
  // scaled about its center, so this rect form is algebraically identical
  // to the item form nx = (cur.x - it.x) / (240 * scale*hs*inS) — without
  // needing any of the item's transform terms.
  // NOT x-flipped: toScreen() already un-mirrors the landmark, so cursors
  // and cards share one screen space and the canvas draws un-mirrored
  // inside it. UNVERIFIED LIVE — if pointing reads x-flipped in Chrome,
  // negate nx on the next line and nothing else moves.
  const nx = ((cur.x - r.left) / r.width) * 2 - 1;
  const ny = -(((cur.y - r.top) / r.height) * 2 - 1);
  if (Math.abs(nx) > 1 || Math.abs(ny) > 1) return null;
  return castAt(sc, nx, ny);
}

function castAt(sc, nx, ny) {
  const M = sc.med;
  try {
    if (!_rc) _rc = new sc.THREE.Raycaster();
    _rc.setFromCamera({ x: nx, y: ny }, sc.camera);
    const hits = _rc.intersectObjects(sc.scene.children, true);
    for (const h of hits) {
      const o = h.object;
      if (!o || !o.isMesh) continue;
      // three's raycaster ignores .visible, so isolate/hide/layer would
      // otherwise still be pointable through
      let p = o, gone = false;
      while (p) { if (p.visible === false) { gone = true; break; } p = p.parent; }
      if (gone) continue;
      // an armed cut removed this fragment on screen; it can't be pointed at
      if (M.plane && M.plane.distanceToPoint(h.point) < 0) continue;
      let n = o, s;
      while (n && s === undefined) { s = M.idx.nodeSid.get(n); n = n.parent; }
      if (s === undefined) continue;           // an orphan mesh names nothing
      return { model: M.src.split("/").pop(), structure: s, mesh: o.name || "" };
    }
  } catch (e) {}
  return null;
}
