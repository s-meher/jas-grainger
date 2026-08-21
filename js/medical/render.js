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
const CAP_DIM = 0.72;          // the cut face sits a shade under the lit skin
const CAP_FLESH = 0x9a6a66;    // fallback when a material carries no colour

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
  capsOff(sc);
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
    if (!n.isMesh || !n.geometry || n.userData.medCap) return;   // not our own caps
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

// The anatomical axis a preset cuts across, as a unit vector in model space.
// The plane NORMAL for each preset is the axis the cut separates along:
// sagittal separates left from right, coronal anterior from posterior, axial
// superior from inferior. Signs don't matter to a plane's orientation, but
// they do decide which half `t` slides toward, so they are honored.
const DEFAULT_AXES = { superior: "+y", left: "+x", anterior: "+z" };
const PRESET_AXIS = { sagittal: "left", coronal: "anterior", axial: "superior" };

function axisVec(THREE, M, preset) {
  const named = (M.doc && M.doc.axes) || DEFAULT_AXES;
  const spec = String(named[PRESET_AXIS[preset]] ||
                      DEFAULT_AXES[PRESET_AXIS[preset]] || "+y").toLowerCase();
  const s = spec[0] === "-" ? -1 : 1;
  const k = spec.replace(/^[-+]/, "");
  const v = new THREE.Vector3(k === "x" ? s : 0, k === "y" ? s : 0,
                              k === "z" ? s : 0);
  if (v.lengthSq() === 0) v.set(0, 1, 0);      // a malformed axes block
  return v;
}

/** Build the clip plane for the current cut state, in model-local space
 *  (M.planeL) plus its live world twin (M.plane, refreshed every tick).
 *  Returns the world plane, or null when nothing is cut.
 *
 *  THE CAP SEAM — the cut is no longer clip-only: caps() below fills the
 *  cut face. It does NOT run from here, because a cap has to know which
 *  meshes paint() actually left solid (isolate/hide/layer/x-ray all have
 *  a say), so paint() calls it once the visibility pass has settled. */
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
    // The preset planes are ANATOMICAL, so they can only be resolved against
    // the model's own orientation — sagittal splits left from right, coronal
    // front from back, axial top from bottom, whatever axes those happen to
    // be. The sidecar's `axes` states them (schemas/anatomy.schema.md); a
    // model that omits it is assumed to follow the glTF Y-up convention,
    // which segmented medical exports usually do NOT (this heart is Z-up
    // with anterior at -Y, so hardcoding Y-up cut it in the wrong places).
    n = axisVec(THREE, M, p);
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

// ------------------------------------------------------------- the caps
// Tear the cap rig down. Called from restore() — so paint() always rebuilds
// from nothing and stays idempotent — and from dispose() through it.
function capsOff(sc) {
  const M = sc.med;
  if (!M.cap) return;
  for (const n of M.cap.nodes) if (n.parent) n.parent.remove(n);
  for (const d of M.cap.junk) { try { d.dispose(); } catch (e) {} }
  M.cap = null;
}

/** THE CAP PASS — a cut organ has to read SOLID, not like a shell someone
 *  scooped out. Classic scene-graph stencil (three's webgl_clipping_stencil),
 *  but run PER STRUCTURE rather than once for the whole model: each
 *  structure gets its own quad, so the cut face can carry that structure's
 *  own colour (a lesion tint included) and a hidden/isolated-away structure
 *  simply never gets one.
 *
 *  Per structure, three passes: front faces DECREMENT the stencil, back
 *  faces INCREMENT it, both clipped by the cut plane and writing no colour
 *  and no depth — so any pixel where the eye ray entered more solid than it
 *  left ends up non-zero, i.e. inside the material. Then one quad lying ON
 *  the plane paints exactly those pixels and writes 0 back everywhere it
 *  covers, which hands the next structure a clean buffer for free.
 *
 *  This is exact ONLY for closed manifolds. media/models/heart/heart.glb is
 *  16 watertight parts, so it is exact here; a future model with holes in a
 *  shell would leave the count unbalanced and its cap would bleed across the
 *  silhouette. If that day comes, the fallback is per-structure: test the
 *  geometry for open edges at index time and leave the leaky ones clip-only.
 *
 *  `solids` is structure id -> the meshes paint() left opaque. */
function caps(sc, solids) {
  const M = sc.med, THREE = sc.THREE;
  if (!M.planeL || !M.plane || !solids.size) return;
  // The bloom path renders the scene into WebGLRenderTargets, and those
  // carry no stencil attachment — the writers would count into nothing and
  // every cap would flood the silhouette. Holo and glow-lift models keep
  // the clip-only cut; medical solids render straight to the canvas.
  if (sc.post) return;
  try {
    const a = sc.renderer.getContext().getContextAttributes();
    if (!a || !a.stencil) return;          // a renderer with no stencil buffer
  } catch (e) { return; }

  const lb = localBox(sc);
  // one quad geometry for every structure: the bbox diagonal is the widest
  // any cross-section can be, so it always covers the silhouette (the
  // stencil, not the quad's edge, is what shapes the cap)
  const d = lb.getSize(new THREE.Vector3()).length() * 1.05;
  const geo = new THREE.PlaneGeometry(d || 1, d || 1);
  const cap = { nodes: [], junk: [geo] };
  M.cap = cap;

  // everything below is GROUP-LOCAL, where M.planeL lives: the quads hang
  // off sc.group and the writers off the meshes themselves, so the turning
  // hologram (and an explode) carries the whole rig without a per-frame fix
  sc.group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(sc.group.matrixWorld).invert();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), M.planeL.normal);
  const org = M.planeL.projectPoint(lb.getCenter(new THREE.Vector3()),
                                    new THREE.Vector3());
  const bb = new THREE.Box3(), mm = new THREE.Matrix4();
  const writer = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false,
    depthTest: false,              // count EVERY face, not just visible ones
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
  });

  let i = 0;
  for (const [, meshes] of solids) {
    // a structure the plane misses entirely has no cut face to fill
    const cross = meshes.filter(m => {
      if (!m.geometry) return false;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (!m.geometry.boundingBox) return false;
      bb.copy(m.geometry.boundingBox);
      mm.multiplyMatrices(inv, m.matrixWorld);
      bb.applyMatrix4(mm);
      return M.planeL.intersectsBox(bb);
    });
    if (!cross.length) continue;

    // writers first, then this structure's quad, then the next structure —
    // the whole trick is that ordering. Model meshes sit at renderOrder 0
    // and so lay down depth before any of it.
    const ro = 2 + i * 2;
    let col = null;
    for (const m of cross) {
      for (const [side, op] of [[THREE.FrontSide, THREE.DecrementWrapStencilOp],
                                [THREE.BackSide, THREE.IncrementWrapStencilOp]]) {
        const mat = writer.clone();
        mat.side = side;
        mat.clippingPlanes = [M.plane];    // the live world plane, by reference
        mat.stencilFail = mat.stencilZFail = mat.stencilZPass = op;
        const w = new THREE.Mesh(m.geometry, mat);
        w.renderOrder = ro;
        w.userData.medCap = 1;
        w.raycast = () => {};              // "what is this?" must not hit it
        // parented to the mesh with an identity transform: exactly coincident,
        // and it inherits .visible, so hide/isolate can never desync
        m.add(w);
        cap.nodes.push(w); cap.junk.push(mat);
      }
      if (!col) {
        // the CURRENT material, not the shipped one — a lesion tint should
        // show on the cut face too
        const b = asArr(m.material)[0];
        if (b && b.color) col = b.color.clone();
      }
    }
    if (!col) col = new THREE.Color(CAP_FLESH);
    col.multiplyScalar(CAP_DIM);
    const cm = new THREE.MeshBasicMaterial({
      color: col, side: THREE.DoubleSide,
      // NotEqual 0 paints only inside-the-solid pixels; Replace with ref 0
      // then zeroes every pixel the quad covered, pass or fail
      stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
      // the quad is exactly coplanar with the clipped rim; without this the
      // two z-fight into a dotted black outline around the whole section
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      // NOT clipped by the cut plane — it IS the cut plane
      clippingPlanes: null,
    });
    const pm = new THREE.Mesh(geo, cm);
    pm.quaternion.copy(q);
    pm.position.copy(org);
    pm.renderOrder = ro + 1;
    pm.userData.medCap = 1;
    pm.raycast = () => {};
    sc.group.add(pm);
    cap.nodes.push(pm); cap.junk.push(cm);
    i++;
  }
  writer.dispose();
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
  // what the cap pass gets to fill: structure -> the meshes left OPAQUE.
  // A ghosted or faded-back mesh is deliberately see-through; a solid lid
  // on its cut face would just undo the effect.
  const solids = plane ? new Map() : null;
  const solid = (s, m) => {
    if (!solids || !s) return;             // an orphan mesh caps nothing
    if (!solids.has(s)) solids.set(s, []);
    solids.get(s).push(m);
  };

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
    if (!deep) solid(s, m);
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
  // after the visibility pass, so the cut face only ever gets filled where
  // something is actually on screen (and with its post-tint colour)
  if (solids) { try { caps(sc, solids); } catch (e) { console.warn("[medical] caps", e); } }
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
  const live = [];
  for (const [id, d] of M.labels) {
    const p = M.anchors.get(id);
    if (!p) { d.style.display = "none"; continue; }
    v.copy(p).applyMatrix4(mw).project(sc.camera);
    // behind the camera, or well off the canvas: don't paint a stray tag
    if (v.z > 1 || Math.abs(v.x) > 1.25 || Math.abs(v.y) > 1.25) {
      d.style.display = "none"; continue;
    }
    d.style.display = "";
    live.push({ id, d, x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5, z: v.z });
  }
  // DE-COLLISION: structures nest inside each other, so their bbox centers
  // project almost on top of one another — three tags stacked on the same
  // pixel is worse than no tags. Nearest-first (a tag in front wins its
  // spot), then push each colliding tag DOWN the minimum distance that
  // clears the ones already placed. Vertical only: the leader line is
  // implicit, and sideways drift would break the tag away from its
  // structure entirely.
  live.sort((a, b) => a.z - b.z);
  const GAP = 0.052;                     // ~one tag height in card fractions
  const placed = [];
  for (const t of live) {
    let y = t.y;
    for (let pass = 0; pass < live.length; pass++) {
      const hit = placed.find(q => Math.abs(q.y - y) < GAP &&
                                   Math.abs(q.x - t.x) < 0.42);
      if (!hit) break;
      y = hit.y + GAP;
    }
    t.y = y;
    placed.push(t);
    // percentages, not px — the card scales and the tags ride it for free
    t.d.style.left = (t.x * 100).toFixed(2) + "%";
    t.d.style.top = (y * 100).toFixed(2) + "%";
    t.d.classList.toggle("on", M.ptS === t.id);   // pointed-at tag lights up
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
  try { capsOff(sc); } catch (e) {}       // belt + braces if restore() threw
  M.ghost = null; M.lbox = null; M.plane = null; M.planeL = null; M.cap = null;
  M.labels.clear(); M.anchors.clear();
}
