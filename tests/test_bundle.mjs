/* tasks 2.3: the browser-side bundle gate (js/medical/bundle.js), in node.
 *
 *   node tests/test_bundle.mjs
 *
 * Drives verifyBundle() against the committed synthetic phantom bundle
 * (media/models/phantom/) with an in-memory "server", and checks that every
 * kind of bad bundle is refused before a single byte reaches GLTFLoader.
 * Needs no server and no browser (Node >= 18 for crypto.subtle).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { verifyBundle, parseGlbJson, SCHEMA } from "../js/medical/bundle.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "..", "media", "models", "phantom");
const files = () => Object.fromEntries(
  ["manifest.json", "model.glb", "model.orig.glb", "anatomy.json"]
    .map(f => [f, new Uint8Array(readFileSync(join(DIR, f)))]));
const ab = u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const server = fs => async rel => (rel in fs ? ab(fs[rel]) : null);
const editManifest = (fs, fn) => {
  const m = JSON.parse(new TextDecoder().decode(fs["manifest.json"]));
  fn(m);
  fs["manifest.json"] = new TextEncoder().encode(JSON.stringify(m));
  return fs;
};

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("  ok  ", name); }
  else { fail++; console.log("  FAIL", name, detail); }
};
async function rejects(name, fs, glb, re) {
  try { await verifyBundle(glb, server(fs)); ok(name, false, "(accepted)"); }
  catch (e) { ok(name, re.test(e.message), `(${e.message})`); }
}

const good = await verifyBundle("model.glb", server(files()));
ok("valid phantom bundle accepted", good && good.manifest.schema === SCHEMA);
ok("verified bytes are the GLB itself", good && parseGlbJson(good.glb).asset);
ok("revision passed through", good && /^[0-9a-f]{64}$/.test(good.revision));
ok("original mesh is a loadable bundle asset",
   !!(await verifyBundle("model.orig.glb", server(files()))));

const none = files(); delete none["manifest.json"];
ok("no manifest = plain model (null), not an error",
   (await verifyBundle("model.glb", server(none))) === null);

let fs = files(); fs["model.glb"] = fs["model.glb"].slice(); fs["model.glb"][100] ^= 0xff;
await rejects("tampered GLB refused", fs, "model.glb", /hash/);
fs = files(); fs["anatomy.json"] = new TextEncoder().encode('{"tampered":1}');
await rejects("tampered sidecar refused", fs, "model.glb", /sidecar.*hash/);
fs = files(); delete fs["model.glb"];
await rejects("missing GLB refused", fs, "model.glb", /missing/);
await rejects("wrong schema refused",
  editManifest(files(), m => { m.schema = "jas-bundle/2"; }), "model.glb", /schema/);
await rejects("non-mm frame refused",
  editManifest(files(), m => { m.geometry.units = "m"; }), "model.glb", /mm\/RAS/);
await rejects("GLB not listed in manifest refused", files(), "other.glb", /not a mesh listed/);
await rejects("structure without geometry refused",
  editManifest(files(), m => { m.structures.spleen = { label_value: 9, mesh_node: "spleen",
    voxels: 1, volume_ml: 0.001, status: "present" }; }), "model.glb", /spleen missing/);
await rejects("'empty' structure with geometry refused",
  editManifest(files(), m => { m.structures.liver.status = "empty"; }), "model.glb", /marked empty/);
fs = files(); fs["manifest.json"] = new TextEncoder().encode("{not json");
await rejects("corrupt manifest refused", fs, "model.glb", /not JSON/);

try { parseGlbJson(new ArrayBuffer(32)); ok("non-GLB bytes refused", false); }
catch (e) { ok("non-GLB bytes refused", /not a GLB/.test(e.message)); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
