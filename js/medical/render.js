/* barehands, anatomy edition — THE MEDICAL PIXELS.
 *
 * core.js decides WHAT is true of a model (isolated, cut, x-rayed, tinted);
 * this file makes it visible. Imported lazily by core.js the first time a
 * medical model or verb shows up, so a plain barehands board never loads it.
 *
 * Three rules hold the whole file together:
 *  1. NEVER mutate a shipped material. Every effect clones; `restore()`
 *     puts the originals back and disposes the clones. That keeps GLB
 *     materials shared between meshes honest and makes paint() idempotent —
 *     it always repaints from a clean slate, so state order never matters.
 *  2. Labels are HTML, not sprites. They live inside the card element, so
 *     they inherit its transform for free (scale with the card, mirror with
 *     nothing) and stay crisp on the OBS overlay at any size.
 *  3. Clipping planes are WORLD space but the cut is defined in MODEL space
 *     — the plane is rebuilt from its model-local twin every tick, because
 *     the hologram is always turning.
 *
 * three.js comes off `sc.THREE` (the page's single instance) — never
 * imported here. See ../../schemas/verbs.md for the verb contract.
 */

import { kin } from "./core.js";

const CSS_ID = "medical-css";
const FADE_A = 0.06;           // a below-depth layer, faded not gone

// scratch — reused every frame so a 45Hz tick allocates nothing
let _v, _m1, _m2, _b1, _b2;

function css(THREE) {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  // the board's glass aesthetic, shrunk: teal monospace with the same dark
  // halo the on-air card text wears (readability rides the halo, not a slab)
  s.textContent = `
  .med-labels { position:absolute; inset:0; pointer-events:none; z-index:2; }
  .med-labels .ml { position:absolute; transform:translate(-50%,-50%);
      white-space:nowrap; padding:2px 7px; border-radius:7px;
      font:11.5px/1.1 "SF Mono",Menlo,monospace; letter-spacing:0.07em;
      text-transform:uppercase; color:#8ff0e4;
      background:rgba(4,22,20,0.34);
      border:1px solid rgba(140,240,225,0.30);
      text-shadow:0 1px 3px rgba(2,14,12,0.95), 0 0 10px rgba(2,14,12,0.85); }
  .med-labels .ml.on { color:#eafff9; background:rgba(12,56,50,0.60);
      border-color:rgba(140,240,225,0.85);
      box-shadow:0 0 18px rgba(111,229,214,0.35); }`;
  document.head.appendChild(s);
}

// ------------------------------------------------------------ materials
function asArr(m) { return Array.isArray(m) ? m : m ? [m] : []; }

function setPlanes(mat, planes) {
  for (const m of asArr(mat)) {
    // a change in PLANE COUNT recompiles the shader; a change in the plane's
    // own numbers does not (it's a uniform) — so only flag it when it flips
    const had = m.clippingPlanes && m.clippingPlanes.length ? 1 : 0;
    const now = planes && planes.length ? 1 : 0;
    m.clippingPlanes = planes || null;
    if (had !== now) m.needsUpdate = true;
  }
}

function restore(sc) {
  const M = sc.med;
  M.orig.forEach((mat, m) => { m.material = mat; setPlanes(mat, null); });
  M.vis0.forEach((v, m) => { m.visible = v; });
  M.clones.forEach(c => { try { c.dispose(); } catch (e) {} });
  M.clones.clear();
}

// the x-ray shell: one shared fresnel ghost for the whole model, modeled on
// stage.html's holo ghost (same visual family) minus the scan beam — an
// x-ray that pulses reads as decoration, not as looking through something.
// Clipping chunks are wired in by hand: a ShaderMaterial only clips when
// `clipping:true` AND the four chunks are present.
function ghost(sc) {
  const M = sc.med, THREE = sc.THREE;
  if (M.ghost) return M.ghost;
  M.ghost = new THREE.ShaderMaterial({
    uniforms: {
      cBase: { value: new THREE.Color(0.42, 0.72, 0.70) },
      cRim:  { value: new THREE.Color(0.80, 1.00, 0.97) },
      rimPow: { value: 2.6 }, baseA: { value: 0.07 }, rimA: { value: 0.55 },
    },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <skinbase_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * objectNormal);
        vV = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 cBase; uniform vec3 cRim;
      uniform float rimPow; uniform float baseA; uniform float rimA;
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <clipping_planes_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), rimPow);
        vec3 col = mix(cBase, cRim, f) * (0.55 + f * 1.2);
        gl_FragColor = vec4(col, clamp(baseA + f * rimA, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, clipping: true,
    side: THREE.DoubleSide,
  });
  return M.ghost;
}

// ------------------------------------------------------------- the cut
// The model's own AABB in GROUP space — the scrub range for `t`, and the
// frame `plane.o` is normalized against. Measured once: geometry bounds
// pushed through each mesh's matrix relative to the group, so the group's
// live rotation never leaks into it.
function localBox(sc) {
  const M = sc.med, THREE = sc.THREE;
  if (M.lb3) return M.lb3;
  sc.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(sc.group.matrixWorld).invert();
  const b = new THREE.Box3(), t = new THREE.Box3(), mm = new THREE.Matrix4();
  sc.group.traverse(n => {
    if (!n.isMesh || !n.geometry) return;
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    if (!n.geometry.boundingBox) return;
    t.copy(n.geometry.boundingBox);
    mm.multiplyMatrices(inv, n.matrixWorld);
    t.applyMatrix4(mm);
    b.union(t);
  });
  if (b.isEmpty())
    b.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
  return (M.lb3 = b);
}

/** Build the clip plane for the current cut state, in model-local space
 *  (M.planeL) plus its live world twin (M.plane, refreshed every tick).
 *  Returns the world plane, or null when nothing is cut.
 *
 *  THE CAP SEAM — this is a CLIP-ONLY cut today: the model reads hollow
 *  where the plane passes through it. The "solid ink" / stencil cap pass
 *  slots in right here, at the end of this function: everything a cap
 *  needs is in scope (the world plane, sc.renderer, sc.scene, and the
 *  clipped meshes are exactly those paint() gave clippingPlanes to).
 *  Nothing else in this file has to move for caps to land. */
export function applyCut(sc, st) {
  const M = sc.med, THREE = sc.THREE;
  const cut = st.cut;
  if (!cut) { M.plane = null; M.planeL = null; return null; }
  const lb = localBox(sc);
  const c = lb.getCenter(new THREE.Vector3());
  const h = lb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  let n, pt;
  const p = cut.plane;
  if (typeof p === "string") {
    // the preset planes map to MODEL-local axes: sagittal splits left from
    // right (x), coronal front from back (z), axial top from bottom (y)
    n = new THREE.Vector3(p === "sagittal" ? 1 : 0,
                          p === "axial" ? 1 : 0,
                          p === "coronal" ? 1 : 0);
    if (n.lengthSq() === 0) n.set(0, 1, 0);
    // t = 0..1 slides the plane across the model's own extent; 0.5 = center
    const lo = c.clone().sub(h).dot(n), hi = c.clone().add(h).dot(n);
    const t = cut.t == null ? 0.5 : Math.max(0, Math.min(1, cut.t));
    pt = n.clone().multiplyScalar(lo + (hi - lo) * t);   // n is a unit axis
  } else if (p && p.n) {
    // the custom form: n arrives pre-normalized from the server, o is in
    // normalized model space (-1..1 across the bbox on each axis). o is the
    // anchor and t is ignored here — an explicit origin already says where
    // the plane sits (the gesture track's scrub will drive o, not t).
    n = new THREE.Vector3().fromArray(p.n);
    if (n.lengthSq() < 1e-9) n.set(0, 1, 0);
    n.normalize();
    const o = p.o || [0, 0, 0];
    pt = new THREE.Vector3(c.x + (+o[0] || 0) * h.x,
                           c.y + (+o[1] || 0) * h.y,
                           c.z + (+o[2] || 0) * h.z);
  } else { M.plane = null; M.planeL = null; return null; }
  M.planeL = new THREE.Plane().setFromNormalAndCoplanarPoint(n, pt);
  if (!M.plane) M.plane = new THREE.Plane();
  sc.group.updateMatrix();
  M.plane.copy(M.planeL).applyMatrix4(sc.group.matrix);
  return M.plane;
}

// -------------------------------------------------------------- paint
/** Full repaint from sc.med.st. Restore-then-apply, so it is idempotent
 *  and the order verbs arrived in can never matter. */
export function paint(sc) {
  const M = sc.med;
  if (!M || !M.idx) return;
  const THREE = sc.THREE, st = M.st;
  css(THREE);
  restore(sc);

  const plane = applyCut(sc, st);
  const planes = plane ? [plane] : null;
  // local clipping is per-renderer; each model owns its own renderer, so
  // turning it on here never touches another hologram on the board
  sc.renderer.localClippingEnabled = !!plane;

  const iso = st.iso ? kin(M, st.iso) : null;
  const hid = new Set();
  st.hid.forEach(id => kin(M, id).forEach(x => hid.add(x)));
  const focus = st.xray && st.xray.focus ? kin(M, st.xray.focus) : null;
  let les = null, lesCol = null;
  if (st.les) {
    les = new Set();
    for (const id of [st.les.structure, ...(st.les.spread || [])])
      kin(M, id).forEach(x => les.add(x));
    lesCol = new THREE.Color(st.les.color);
  }
  const gm = st.xray ? ghost(sc) : null;
  if (gm) setPlanes(gm, planes);

  for (const m of M.idx.meshes) {
    if (!M.orig.has(m)) M.orig.set(m, m.material);   // the shipped material
    if (!M.vis0.has(m)) M.vis0.set(m, m.visible);
    const s = M.idx.meshSid.get(m);
    // ISOLATE hides everything that isn't the structure (an orphan mesh
    // matches nothing, so it goes too); HIDE subtracts from what's left
    let vis = M.vis0.get(m);
    if (iso && !(s && iso.has(s))) vis = false;
    if (s && hid.has(s)) vis = false;
    m.visible = vis;
    if (!vis) continue;

    const deep = st.layer != null && s && (M.structs[s].layer || 0) > st.layer;
    const gz = !!st.xray && !(focus && s && focus.has(s));
    const tint = !!(les && s && les.has(s));
    if (gz) { m.material = gm; continue; }           // x-ray beats the rest
    if (!deep && !tint && !planes) continue;         // untouched: restore() left it

    const base = M.orig.get(m);
    const out = asArr(base).map(o => {
      // the holo ghost is ONE shared ShaderMaterial whose scan-beam uniform
      // stage.html drives by reference — cloning it would freeze the beam
      if (o === sc.ghostMat) { setPlanes(o, planes); return o; }
      const c2 = o.clone();
      M.clones.add(c2);
      if (tint && c2.color) {
        c2.color.lerp(lesCol, st.les.intensity);
        if (c2.emissive) c2.emissive.lerp(lesCol, st.les.intensity * 0.5);
      }
      if (deep) { c2.transparent = true; c2.opacity = FADE_A; c2.depthWrite = false; }
      setPlanes(c2, planes);
      return c2;
    });
    m.material = Array.isArray(base) ? out : out[0];
  }
  labels(sc);
}

// -------------------------------------------------------------- labels
function box(sc) {
  const M = sc.med;
  if (M.lbox && M.lbox.isConnected) return M.lbox;
  const card = sc.canvas.parentElement;
  const d = document.createElement("div");
  d.className = "med-labels";
  card.appendChild(d);
  return (M.lbox = d);
}

function labels(sc) {
  const M = sc.med, want = M.st.lb;
  if (!want.length) {
    if (M.lbox) M.lbox.remove();
    M.lbox = null; M.labels.clear(); M.anchors.clear();
    return;
  }
  const b = box(sc);
  for (const [id, d] of M.labels)
    if (!want.includes(id)) { d.remove(); M.labels.delete(id); }
  for (const id of want) {
    if (M.labels.has(id)) continue;
    const d = document.createElement("div");
    d.className = "ml";
    d.textContent = (M.structs[id] && M.structs[id].name) || id;
    b.appendChild(d);
    M.labels.set(id, d);
  }
  M.anchorT = 0;                     // force an anchor pass on the next tick
}

// A structure's tag point: the bbox center of its meshes, in GROUP space.
// Recomputed at ~5Hz (cheap, and it tracks explode/animation drift) while
// the per-frame projection below rides the live rotation — so labels glide
// smoothly instead of stepping at the refresh rate.
function anchors(sc, mw) {
  const M = sc.med, THREE = sc.THREE;
  const inv = (_m1 || (_m1 = new THREE.Matrix4())).copy(mw).invert();
  const b = _b1 || (_b1 = new THREE.Box3());
  const t = _b2 || (_b2 = new THREE.Box3());
  const mm = _m2 || (_m2 = new THREE.Matrix4());
  for (const id of M.labels.keys()) {
    b.makeEmpty();
    for (const s of kin(M, id))
      for (const m of M.idx.byStruct.get(s) || []) {
        if (!m.visible || !m.geometry) continue;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (!m.geometry.boundingBox) continue;
        t.copy(m.geometry.boundingBox);
        mm.multiplyMatrices(inv, m.matrixWorld);
        t.applyMatrix4(mm);
        b.union(t);
      }
    if (b.isEmpty()) M.anchors.delete(id);
    else M.anchors.set(id, b.getCenter(new THREE.Vector3()));
  }
}

/** Per frame, per scene. Two jobs: keep the world clip plane glued to the
 *  turning model, and project the labels onto the canvas. */
export function tick(sc) {
  const M = sc.med;
  if (!M) return;
  if (!M.plane && !M.labels.size) return;         // nothing medical on screen
  const THREE = sc.THREE;
  // the group sits directly under the scene root, so its local matrix IS
  // its world matrix — one node to update instead of the whole model
  sc.group.updateMatrix();
  const mw = sc.group.matrix;
  if (M.plane && M.planeL) M.plane.copy(M.planeL).applyMatrix4(mw);
  if (!M.labels.size) return;

  const now = performance.now();
  if (now - M.anchorT > 200) { M.anchorT = now; anchors(sc, mw); }
  const v = _v || (_v = new THREE.Vector3());
  for (const [id, d] of M.labels) {
    const p = M.anchors.get(id);
    if (!p) { d.style.display = "none"; continue; }
    v.copy(p).applyMatrix4(mw).project(sc.camera);
    // behind the camera, or well off the canvas: don't paint a stray tag
    if (v.z > 1 || Math.abs(v.x) > 1.25 || Math.abs(v.y) > 1.25) {
      d.style.display = "none"; continue;
    }
    d.style.display = "";
    // percentages, not px — the card scales and the tags ride it for free
    d.style.left = ((v.x * 0.5 + 0.5) * 100).toFixed(2) + "%";
    d.style.top = ((-v.y * 0.5 + 0.5) * 100).toFixed(2) + "%";
    d.classList.toggle("on", M.ptS === id);       // pointed-at tag lights up
  }
}

/** Called from core's onDispose, BEFORE stage.html's disposeScene walks the
 *  scene disposing geometry and materials — originals go back on their
 *  meshes first so disposeScene disposes those (and only those). */
export function dispose(sc) {
  const M = sc.med;
  if (!M) return;
  try { restore(sc); } catch (e) {}
  try { if (M.ghost) M.ghost.dispose(); } catch (e) {}
  try { if (M.lbox) M.lbox.remove(); } catch (e) {}
  try { sc.renderer.localClippingEnabled = false; } catch (e) {}
  M.ghost = null; M.lbox = null; M.plane = null; M.planeL = null;
  M.labels.clear(); M.anchors.clear();
}
