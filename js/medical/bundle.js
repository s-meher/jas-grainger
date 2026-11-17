// js/medical/bundle.js: tasks 2.3 + 2.4, loading jas-bundle/1 scan bundles.
//
// A bundle is a folder under media/ holding manifest.json beside model.glb
// (ADR 0002). This module does two jobs, both optional for every other model:
//
//   2.3  bundleFor(src)  runs BEFORE the GLB is parsed. A manifest next to
//        the GLB means "this is a scan-derived bundle", and from then on the
//        load is all-or-nothing. Wrong schema, a hash mismatch, a missing
//        structure node or a node marked empty all THROW, and stage.html
//        then refuses the model with a toast instead of showing a partial
//        or tampered anatomy. The GLB is fetched once, hashed, and those
//        exact verified bytes are what GLTFLoader parses (no second fetch
//        that could differ). No manifest = plain model = returns null, and
//        the heart and every prop load exactly as before.
//
//   2.4  attach(sc, src)  runs after stage.html's existing load. stage.html
//        already centers the WHOLE gltf.scene on one bounding box and scales
//        the one parent group, so every structure shares one view transform
//        (never per-structure). attach() records that the mesh frame is RAS+
//        millimetres. It exposes mmToScene / sceneToMm through three.js's own
//        node matrices, so the conversion stays exact under the board's
//        rotate/scale and any future measuring tool reads true mm. It also
//        adds a small RAS orientation marker.
//
// Pure-logic helpers (parseGlbJson, verifyBundle) take bytes and fetchers,
// so tests/test_bundle.mjs runs them in node with no browser.

export const SCHEMA = "jas-bundle/1";
async function sha256Hex(buf) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** GLB container -> its JSON chunk (12-byte header, length-prefixed chunks). */
export function parseGlbJson(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67)   // "glTF"
    throw new Error("not a GLB file");
  let off = 12;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a)                                         // "JSON"
      return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    off += 8 + len;
  }
  throw new Error("GLB has no JSON chunk");
}

function nodeNames(gltf) {
  const s = new Set();
  (gltf.meshes || []).forEach(m => m.name && s.add(m.name));
  (gltf.nodes || []).forEach(n => "mesh" in n && n.name && s.add(n.name));
  return s;
}

/** The browser-side gate. `get(relPath)` -> ArrayBuffer | null (404).
 *  Returns null when there is no manifest (a plain model); otherwise returns
 *  {manifest, glb, revision}, or throws with the first fatal problem. */
export async function verifyBundle(glbName, get) {
  const mbuf = await get("manifest.json");
  if (!mbuf) return null;
  let m;
  try { m = JSON.parse(new TextDecoder().decode(mbuf)); }
  catch (e) { throw new Error("bundle manifest is not JSON"); }
  if (m.schema !== SCHEMA) throw new Error(`unsupported bundle schema ${m.schema}`);
  const g = m.geometry || {};
  if (g.units !== "mm" || g.axes !== "RAS")
    throw new Error(`bundle frame ${g.units}/${g.axes} is not mm/RAS`);
  const assets = m.assets || [];
  const paths = new Set();
  for (const { path } of assets) {
    if (typeof path !== "string" || !/^[A-Za-z0-9._/-]+$/.test(path) ||
        path.split("/").some(part => !part || part === "." || part === "..") || paths.has(path))
      throw new Error("invalid or duplicate bundle asset path");
    paths.add(path);
  }
  const mesh = assets.find(a => a.path === glbName &&
                                (a.role === "mesh" || a.role === "mesh_original"));
  if (!mesh) throw new Error(`${glbName} is not a mesh listed in the bundle manifest`);
  const glb = await get(mesh.path);
  if (!glb) throw new Error(`bundle asset ${mesh.path} missing`);
  if (glb.byteLength !== mesh.bytes || (await sha256Hex(glb)) !== mesh.sha256)
    throw new Error(`bundle asset ${mesh.path} failed its hash check`);
  // the sidecar drives every label/verb, so it must be the reviewed bytes too
  const side = assets.find(a => a.role === "sidecar");
  let sidecar = null;
  if (side) {
    const sb = await get(side.path);
    if (!sb || sb.byteLength !== side.bytes || (await sha256Hex(sb)) !== side.sha256)
      throw new Error(`bundle sidecar ${side.path} failed its hash check`);
    sidecar = JSON.parse(new TextDecoder().decode(sb));
    if (sidecar.schema !== "barehands-anatomy/1" || !sidecar.structures)
      throw new Error("invalid bundle anatomy sidecar");
  }
  const names = nodeNames(parseGlbJson(glb));
  for (const [id, s] of Object.entries(m.structures || {})) {
    if (s.status === "present" && !names.has(s.mesh_node))
      throw new Error(`structure ${id} missing from ${mesh.path}`);
    if (s.status === "empty" && names.has(id))
      throw new Error(`structure ${id} is marked empty but has geometry`);
  }
  return { manifest: m, glb, revision: m.revision, sidecar };
}

/** stage.html hook (2.3): before parsing. null = not a bundle. */
export async function bundleFor(src) {
  if (typeof src !== "string" || !/\.glb$/i.test(src.split("?")[0])) return null;
  const clean = src.split("?")[0];
  const dir = clean.slice(0, clean.lastIndexOf("/") + 1);
  const name = clean.slice(dir.length);
  const get = async (rel, signal) => {
    const r = await fetch(dir + rel, { cache: "no-store", signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`bundle fetch ${rel}: HTTP ${r.status}`);
    return r.arrayBuffer();
  };
  const b = await verifyBundle(name, get);
  return b ? { ...b, get } : null;
}

/** core.js onModelLoaded hook (2.4): after stage.html centred + scaled it. */
export function attach(sc) {
  const b = sc?.verifiedBundle;
  if (!b || !sc || !sc.group || !sc.THREE) return null;
  const T = sc.THREE;
  const obj = sc.group.children[0];
  const g = b.manifest.geometry;
  const matrix = g.world_to_model;
  if (!Array.isArray(matrix) || matrix.length !== 4 ||
      !matrix.every(row => Array.isArray(row) && row.length === 4 && row.every(Number.isFinite)) ||
      matrix[3].some((value, i) => value !== (i === 3 ? 1 : 0)))
    throw new Error("invalid patient-to-model affine");
  const patientRoot = new T.Group();
  patientRoot.matrixAutoUpdate = false;
  patientRoot.matrix.set(...matrix.flat());
  if (Math.abs(patientRoot.matrix.determinant()) < 1e-12)
    throw new Error("singular patient-to-model affine");
  obj.add(patientRoot);
  const lo = new T.Vector3().fromArray(g.bounds_mm.min);
  const hi = new T.Vector3().fromArray(g.bounds_mm.max);
  const size = hi.clone().sub(lo);
  // RAS marker at the inferior-left-posterior corner: red = +R(x),
  // green = +A(y), blue = +S(z). 15% of the bundle diagonal; plain lines,
  // excluded from picking by name so it can never be "pointed at".
  const L = Math.max(size.length() * 0.15, 1);
  const pos = [], col = [];
  [[1, 0, 0, 0.9, 0.2, 0.2], [0, 1, 0, 0.2, 0.8, 0.3], [0, 0, 1, 0.25, 0.45, 1]]
    .forEach(([x, y, z, r, gg, bb]) => {
      pos.push(lo.x, lo.y, lo.z, lo.x + x * L, lo.y + y * L, lo.z + z * L);
      col.push(r, gg, bb, r, gg, bb);
    });
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  const marker = new T.LineSegments(geo, new T.LineBasicMaterial({ vertexColors: true }));
  marker.name = "__ras_marker";
  marker.raycast = () => {};
  patientRoot.add(marker);
  sc.bundle = {
    manifest: b.manifest, revision: b.revision, marker, patientRoot, get: b.get,
    /** RAS mm (array or Vector3) -> world/scene Vector3, under the live pose */
    mmToScene(p) {
      return patientRoot.localToWorld(Array.isArray(p) ? new T.Vector3().fromArray(p) : p.clone());
    },
    /** world/scene point (e.g. a raycast hit) -> RAS mm Vector3 */
    sceneToMm(p) {
      return patientRoot.worldToLocal(Array.isArray(p) ? new T.Vector3().fromArray(p) : p.clone());
    },
  };
  return sc.bundle;
}
