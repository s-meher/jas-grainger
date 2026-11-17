/* Task 3.9 (demo overlay): acceptance checks.
 *
 *   node tests/test_hud.mjs
 *
 * Pure logic runs directly: the HUD whitelist, pointing text, mode and
 * tracking rules. Integration runs the REAL core.js pointing
 * (cursorFrame -> pointState) against a stub scene in a sandbox copy of
 * js/medical (tests/cutgest/hud/, git-ignored, rebuilt each run), then drives
 * hud.js install() on a minimal fake DOM, so the rendered panel text itself
 * is grepped for leaks. Browser speech (3.10) was removed from Phase 4 at team
 * direction (2026-11-17): a speechSynthesis trap proves the HUD never speaks.
 * A real webcam is NOT exercised here (manual: docs/validation/2026-11-14-3-9-3-11-ui.md).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, copyFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGE = readFileSync(join(HERE, "..", "stage.html"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log("  ok    " + n))
                                 : (fail++, console.log("  FAIL  " + n + "  " + d)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HUD = await import("../js/medical/hud.js");

const NAMES = { "heart.glb|left_ventricle": "Left Ventricle",
                "heart.glb|aortic_valve": "Aortic Valve" };
const nameOf = (m, s) => NAMES[m + "|" + s] || null;
const P = s => ({ model: "heart.glb", structure: s, mesh: s });

// ================================================================ 3.9 HUD pure
console.log("\n3.9 overlay: hud.js whitelist, mode and status rules");
{
  const leaky = {
    doc: { system: "hepatobiliary", source: { name: "synthetic:phantom via pipeline" },
           structures: { liver: { name: "Liver" } } },
    manifest: { bundle_id: "ircadb-PAT-0042-DOE", source_case: "3Dircadb1.17-JOHN-DOE",
                revision: "e98a3dec87b37c0702354231ad6d4fdf0cf62074",
                PatientName: "DOE^JOHN", PatientID: "MRN-778899",
                provenance: { dataset: "synthetic", created: "2026-11-04T00:00:00Z",
                              input_hashes: { "patient_DOE.dcm": "abc" },
                              segmentation: { source: "x", reviewer_state: "dataset_reference" } } },
    revision: "e98a3dec87b37c0702354231ad6d4fdf0cf62074", caseActive: false, armed: false };
  const s = HUD.summarizeModel(leaky);
  const txt = JSON.stringify(HUD.hudRows({ model: s, pointing: "Liver",
    mode: HUD.deriveMode({ hands: 1 }), tracking: "1 hand" }));
  ok("bundle: shows dataset, short revision and reviewer state",
     txt.includes("synthetic") && txt.includes("rev e98a3dec87b3") && txt.includes("seg: dataset_reference"));
  ok("bundle: no patient identifier, bundle_id, source_case, hash input or created time reaches the panel",
     !/DOE|JOHN|MRN|778899|PAT-0042|3Dircadb|patient_|2026-11-04|phantom via/.test(txt), txt);
  ok("dataset must look like a dataset name, or it is dropped (open string in the schema)",
     HUD.summarizeModel({ manifest: { provenance: { dataset: "DOE^JOHN 1970-01-01" } }, doc: {} }).dataset === null &&
     HUD.summarizeModel({ manifest: { provenance: { dataset: "ircadb" } }, doc: {} }).dataset === "ircadb");
  ok("revision must look like a hash, or it is dropped",
     HUD.summarizeModel({ manifest: { revision: "Jane Doe" }, doc: {} }).revision === null);
  ok("long free text is clipped (48 chars)",
     HUD.summarizeModel({ doc: { source: { name: "x".repeat(200) } } }).source.length === 48);
  const gen = HUD.hudRows({ model: HUD.summarizeModel({ doc: { system: "cardiovascular",
    source: { name: "BodyParts3D" }, structures: {} } }), pointing: null,
    mode: HUD.deriveMode({}), tracking: "no hands" });
  ok("generic model: system + asset source, marked generic",
     JSON.stringify(gen).includes("cardiovascular · BodyParts3D (generic)"));
  const cs = HUD.hudRows({ model: HUD.summarizeModel({ doc: {}, caseActive: true }), pointing: null,
    mode: HUD.deriveMode({}), tracking: "" });
  ok("case active: says so, with no case or lesion identity",
     JSON.stringify(cs).includes("answer hidden"));

  const D = HUD.deriveMode;
  ok("mode priority: armed cut beats everything", D({ armed: true, grabs: 1, hands: 2 }).mode === "cut armed");
  ok("mode: two hands on one item = scaling", D({ twoHand: true, grabs: 1, hands: 2 }).mode === "scaling");
  ok("mode: one grab = holding", D({ grabs: 1, hands: 1 }).mode === "holding");
  ok("mode: published structure = pointing", D({ hands: 1, pt: P("left_ventricle") }).mode === "pointing");
  ok("mode: ambiguity tells the user what to do", /one hand/.test(D({ hands: 2, pt: { ambiguous: true } }).tip));
  ok("mode: frozen-only = tracking lost", D({ frozen: 1 }).mode === "tracking lost");
  ok("mode: nothing = no hands", D({}).mode === "no hands");
  const tr = HUD.trackingState({ 0: { lostT: 0 }, 1: { lostT: 1234 } });
  ok("tracking: live and frozen hands are counted separately",
     tr.hands === 1 && tr.frozen === 1 && tr.text === "1 hand · 1 frozen");
  ok("no SPEECH row and no speech wording in the panel rows (3.10 removed)",
     !/SPEECH|speech|mute|repeat|voice/i.test(txt + JSON.stringify(gen) + JSON.stringify(cs)));
  ok("pointing tip no longer offers N/M speech keys", !/\bN\b|\bM\b/.test(D({ hands: 1, pt: P("left_ventricle") }).tip));

  const T = HUD.pointingText;
  ok("pointingText: reviewed sidecar name for a published structure",
     T(P("left_ventricle"), nameOf) === "Left Ventricle");
  ok("pointingText: unnamed structure shows nothing (no raw id or mesh fallback)",
     T({ model: "heart.glb", structure: "mystery_mesh_07", mesh: "mystery_mesh_07" }, nameOf) === null);
  ok("pointingText: cleared pointer / missing model shows nothing",
     T(null, nameOf) === null && T({ structure: "left_ventricle" }, nameOf) === null);
  ok("pointingText: two-hand ambiguity is stated, no structure named",
     T({ ambiguous: true, candidates: ["left_ventricle", "aortic_valve"], model: "heart.glb" }, nameOf)
       === "two hands disagree (nothing named)");
  let threwT = false, rT;
  try { rT = T(P("left_ventricle"), () => { throw new Error("x"); }); } catch (e) { threwT = true; }
  ok("pointingText: a throwing name lookup is treated as unnamed, not a crash", !threwT && rT === null);
}

// ======================================= integration: real core.js pointing -> HUD
console.log("\nintegration: core.js pointState -> hud.js install (fake DOM)");
const SRC = join(HERE, "..", "js", "medical"), BOX = join(HERE, "cutgest", "hud");
rmSync(BOX, { recursive: true, force: true });       // no stale module from an older checkout
mkdirSync(BOX, { recursive: true });
for (const f of readdirSync(SRC).filter(f => f.endsWith(".js"))) copyFileSync(join(SRC, f), join(BOX, f));
writeFileSync(join(BOX, "render.js"), "export function paint(){} export function tick(){} export function dispose(){}\n");
writeFileSync(join(BOX, "package.json"), '{"type":"module"}\n');

// a fake DOM just big enough for hud.js: elements, text, classes, listeners
function fakeEl(tag) {
  const e = { tag, children: [], _text: "", attrs: {}, listeners: {}, style: {},
    className: "", id: "",
    classList: { set: new Set(), toggle(c) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); },
                 contains(c) { return this.set.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); },
    click() { (this.listeners.click || []).forEach(f => f({ stopPropagation() {} })); },
  };
  Object.defineProperty(e, "textContent", {
    get() { return e._text + e.children.map(c => c.textContent).join("\n"); },
    set(v) { e._text = String(v); e.children = []; } });
  return e;
}
const winKeys = [];
const fakeDoc = { head: fakeEl("head"), body: fakeEl("body"), createElement: fakeEl,
                  getElementById: () => null };
const timers = [];
Object.assign(globalThis, { location: { search: "" }, document: fakeDoc,
  innerWidth: 1920, innerHeight: 1080,
  addEventListener: (ev, fn) => { if (ev === "keydown") winKeys.push(fn); },
  setInterval: fn => { timers.push(fn); return timers.length; } });
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
// a speech engine that records ANY use: the HUD must never touch it
const synthCalls = [];
class Utt { constructor(t) { synthCalls.push("utterance:" + t); } }
globalThis.SpeechSynthesisUtterance = Utt;
globalThis.speechSynthesis = new Proxy({}, { get: (_, k) => (synthCalls.push("get:" + String(k)), () => []) });

const CORE = await import("./cutgest/hud/core.js");
const mesh = name => ({ name, isMesh: true, visible: true, parent: null });
const lv = mesh("lv_wall"), lca = mesh("left_coronary_artery");
let AIM = [];
globalThis.fetch = async (u) => ({ ok: true, json: async () => ({
  schema: "barehands-anatomy/1", system: "cardiovascular",
  source: { name: "BodyParts3D" }, structures: {
    left_ventricle: { name: "Left Ventricle", meshes: ["lv_wall"], parent: null, children: [], layer: 0 },
    left_coronary_artery: { name: "Left Coronary Artery", meshes: ["left_coronary_artery"],
                            parent: null, children: [], layer: 0 } },
  aliases: {} }) });
const el = { isConnected: true, getBoundingClientRect: () => ({ left: 700, top: 300, right: 1180, bottom: 780, width: 480, height: 480 }) };
el.parentElement = { children: [el] };
const sc = { canvas: { parentElement: el }, scene: { children: [], traverse: fn => [lv, lca].forEach(fn) },
  camera: {}, THREE: { Raycaster: class { setFromCamera() {} intersectObjects() { return AIM.map(o => ({ object: o, point: {} })); } } } };
await CORE.onModelLoaded(sc, "/media/models/heart/heart.glb");

ok("structureName: reviewed name for a known structure", CORE.structureName("heart.glb", "left_ventricle") === "Left Ventricle");
ok("structureName: unknown structure or model -> null (never an id)",
   CORE.structureName("heart.glb", "nope") === null && CORE.structureName("other.glb", "left_ventricle") === null);
// stage the case lesion the way loadLesion leaves it, then check isolation
sc.med.st.les = { case: "heart-anterior-stemi-01", lesion: "lad_occlusion",
                  structure: "left_coronary_artery", spread: [], color: "#b23b3b", intensity: 0.7 };
const bi = CORE.boardInfo();
ok("boardInfo: caseActive is a bare boolean; no case/lesion ids or lesion structure",
   bi.caseActive === true && !/stemi|lad_occlusion|anterior/.test(JSON.stringify({ ...bi, doc: null })));

const items = [{ type: "model", el, grabbedBy: [], rx: 1, ry: 2, rz: 3, scale: 4 }];
const cursors = {};
let BOOM = false;                     // flips the stage getters into throwing
CORE.installHud({ items: () => { if (BOOM) throw new Error("x"); return items; },
                  cursors: () => { if (BOOM) throw new Error("y"); return cursors; } });
for (let k = 0; k < 50 && !timers.length; k++) await sleep(10);     // lazy import settles
ok("installHud: lazily loads hud.js and starts its own timer (not the frame loop)", timers.length === 1);
const hudEl = fakeDoc.body.children.find(c => c.id === "nova-hud");
ok("installHud: one panel appended to the page", !!hudEl);
const panel = () => hudEl.textContent;
const tick = () => timers[0]();

const cur = { x: 940, y: 540, pinched: false, history: [], el: { classList: { toggle() {} } } };
cursors[0] = cur;
AIM = [lca];
const t0 = performance.now();
while (performance.now() - t0 < 1500) { CORE.cursorFrame(cur, 0, null); tick(); await sleep(20); }
ok("panel: shows the pointed structure by its reviewed name, as soon as it is published",
   panel().includes("Left Coronary Artery"), panel());
const t1 = performance.now();
while (performance.now() - t1 < 1000) { CORE.cursorFrame(cur, 0, null); tick(); await sleep(20); }
ok("no voice: the real pointing path (rest + publish) never touches speechSynthesis",
   synthCalls.length === 0, JSON.stringify(synthCalls));
ok("sandbox has no speech module (deleted, not merely unused)", !existsSync(join(BOX, "speech.js")));
ok("panel: answer isolation holds with a case lesion on the pointed structure",
   panel().includes("answer hidden") && !/stemi|lad_occlusion|anterior|occlusion|infarct/i.test(panel()), panel());
ok("panel: never shows a raw id or mesh name", !/left_coronary_artery|lv_wall/.test(panel()));
ok("panel: education-only banner present", /NOT FOR CLINICAL USE/.test(panel()));
ok("panel: mode + tracking", /pointing · 1 hand/.test(panel()), panel());

const key = k => winKeys.forEach(f => f({ key: k }));
const beforeKeys = panel();
key("m"); key("n"); tick();
ok("M / N are no longer HUD keys: no state stored, panel unchanged, nothing spoken",
   Object.keys(store).length === 0 && panel() === beforeKeys && synthCalls.length === 0);
winKeys.forEach(f => f({ key: "h", metaKey: true }));
ok("Cmd-H (macOS hide app) is ignored", !hudEl.classList.contains("off"));
key("h");
ok("H hides the panel", hudEl.classList.contains("off"));
key("h");

const reset = hudEl.children.find(c => c.className === "b").children.find(b => /Reset/.test(b._text));
reset.click();
ok("Reset pose button restores makeModel's pose (shared with double-click)",
   items[0].rx === -0.15 && items[0].ry === 0.6 && items[0].rz === 0 && items[0].scale === 1);

// tracking loss: the hand leaves; core clears pt after ~400 ms; nothing stale is spoken
delete cursors[0];
AIM = [lv];
await sleep(600);
for (let k = 0; k < 30; k++) { tick(); await sleep(20); }
ok("tracking loss: pointing clears in the panel", /POINTING—/.test(panel().replace(/\s/g, "")), panel());
ok("tracking loss: still silent", synthCalls.length === 0);

// fault isolation: core views that throw must not take the HUD timer down
let threw = false;
BOOM = true;
try { tick(); tick(); } catch (e) { threw = true; }
BOOM = false;
try { tick(); } catch (e) { threw = true; }
ok("a faulting stage getter cannot throw out of the HUD tick, and the next tick recovers",
   !threw && /NOT FOR CLINICAL USE/.test(panel()));
CORE.installHud({ items: () => items, cursors: () => cursors });
await sleep(50);
ok("a second installHud is a no-op (one panel, one timer)",
   timers.length === 1 && fakeDoc.body.children.filter(c => c.id === "nova-hud").length === 1);

// ============================================================ stage.html wiring
console.log("\nstage.html wiring");
const hookAt = STAGE.indexOf("MED.installHud?.({ items: () => items, cursors: () => cursors });");
const renderAt = STAGE.indexOf('if (ROLE === "render") {');
ok("hook: one optional call, marked MEDICAL HOOK", hookAt > 0 &&
   STAGE.lastIndexOf("MEDICAL HOOK (3.9)", hookAt) > hookAt - 300 &&
   (STAGE.match(/MED\.installHud/g) || []).length === 1);
ok("hook: installed only on the tracker page (else-branch of the render role)",
   hookAt > renderAt && hookAt < STAGE.indexOf("MED.installMouse?.("));
ok("hook: called once at page setup, after the frame/render loops are defined (not inside them)",
   hookAt > STAGE.indexOf("function frame(now)") && hookAt > STAGE.indexOf("requestAnimationFrame(renderLoop);"));
ok("hint lists H (and no speech keys) inside a MEDICAL HOOK span",
   /<!-- MEDICAL HOOK -->[^<]*V hide preview \/ H hide HUD<!-- \/MEDICAL HOOK -->/.test(STAGE) &&
   !/M mute names|N repeat name/.test(STAGE));
ok("no speech code left in the medical layer or the page hooks",
   !readdirSync(SRC).includes("speech.js") &&
   !/speechSynthesis|SpeechSynthesisUtterance|from "\.\/speech\.js"/.test(
     readdirSync(SRC).filter(f => f.endsWith(".js")).map(f => readFileSync(join(SRC, f), "utf8")).join("\n")) &&
   !/speechSynthesis/.test(STAGE));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
