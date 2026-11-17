/* Tasks 3.10 (browser speech) and 3.9 (demo overlay): acceptance checks.
 *
 *   node tests/test_speech_hud.mjs
 *
 * Pure logic runs directly: the narrator state machine, voice choice, the HUD
 * whitelist and mode rules. Integration runs the REAL core.js pointing
 * (cursorFrame -> pointState) against a stub scene in a sandbox copy of
 * js/medical (tests/cutgest/hud/, git-ignored), then drives hud.js install()
 * on a minimal fake DOM, so the rendered panel text itself is grepped for
 * leaks. A fake clock drives the narrator. The real Web Speech API and a real
 * webcam are NOT exercised here (manual: docs/validation/2026-11-14-3-9-3-11-ui.md).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, copyFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGE = readFileSync(join(HERE, "..", "stage.html"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log("  ok    " + n))
                                 : (fail++, console.log("  FAIL  " + n + "  " + d)); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SP = await import("../js/medical/speech.js");
const HUD = await import("../js/medical/hud.js");

/** a recording speaker: what would have been said, and how often it was hushed */
function fakeSpeaker(available = true) {
  return { available, said: [], cancels: 0,
           speak(t) { this.said.push(t); return true; }, cancel() { this.cancels++; } };
}
const NAMES = { "heart.glb|left_ventricle": "Left Ventricle",
                "heart.glb|aortic_valve": "Aortic Valve" };
const nameOf = (m, s) => NAMES[m + "|" + s] || null;
const P = s => ({ model: "heart.glb", structure: s, mesh: s });
/** feed the same pointer for `ms`, 100 ms ticks (the HUD's rate) */
function feed(n, pt, t0, ms) {
  let t = t0;
  for (; t <= t0 + ms; t += 100) n.update(pt, nameOf, t);
  return t;
}

// ============================================================ 3.10 narrator
console.log("\n3.10 narrator: js/medical/speech.js createNarrator (fake clock)");
{
  const sp = fakeSpeaker(), n = SP.createNarrator({ speaker: sp });
  let t = feed(n, P("left_ventricle"), 0, SP.SPEAK_DWELL_MS - 100);
  ok("dwell: nothing is said before the structure has stayed published SPEAK_DWELL_MS",
     sp.said.length === 0);
  t = feed(n, P("left_ventricle"), t, 5000);
  ok("dwell: then the reviewed name is said exactly once (not every tick)",
     sp.said.length === 1 && sp.said[0] === "Left Ventricle", JSON.stringify(sp.said));
  ok("names come from the sidecar, never the id", !sp.said.some(x => /_/.test(x)));

  // leave and come straight back: the 8 s cooldown holds
  t = feed(n, null, t, 300);
  t = feed(n, P("left_ventricle"), t, 2000);
  ok("cooldown: returning to the same structure within 8 s says nothing", sp.said.length === 1);
  t = feed(n, null, t, SP.COOLDOWN_MS);
  feed(n, P("left_ventricle"), t, 2000);
  ok("cooldown: after it expires, a fresh visit is named again", sp.said.length === 2);
}
{
  const sp = fakeSpeaker(), n = SP.createNarrator({ speaker: sp });
  let t = feed(n, P("left_ventricle"), 0, 500);       // dwelling, not yet spoken
  t = feed(n, P("aortic_valve"), t, 3000);
  ok("switch: a structure change mid-dwell drops the old name for good",
     !sp.said.includes("Left Ventricle"), JSON.stringify(sp.said));
  ok("switch: the new structure is named after its own dwell", sp.said.join() === "Aortic Valve");
}
{
  const sp = fakeSpeaker(), n = SP.createNarrator({ speaker: sp });
  let t = feed(n, P("left_ventricle"), 0, 500);
  t = feed(n, null, t, 5000);                            // tracking loss clears pt
  ok("loss: pointing cleared mid-dwell, so the stale name never fires later", sp.said.length === 0);
  ok("loss: nothing is 'current' any more", n.state.current === null);
  feed(n, { ambiguous: true, candidates: ["left_ventricle", "aortic_valve"], model: "heart.glb" }, t, 3000);
  ok("ambiguity (3.5-2): two hands disagreeing name nothing", sp.said.length === 0);
}
{
  const sp = fakeSpeaker(), n = SP.createNarrator({ speaker: sp });
  feed(n, { model: "heart.glb", structure: "mystery_mesh_07", mesh: "mystery_mesh_07" }, 0, 3000);
  ok("unnamed: a structure without a reviewed name is silent (no id fallback)",
     sp.said.length === 0 && n.state.why === "unnamed");
}
{
  const sp = fakeSpeaker(), n = SP.createNarrator({ speaker: sp });
  n.setMuted(true);
  ok("mute: muting cancels anything in flight", sp.cancels === 1);
  let t = feed(n, P("left_ventricle"), 0, 3000);
  ok("mute: a dwelt structure is not spoken while muted", sp.said.length === 0);
  ok("mute: repeat obeys mute too", n.repeat(t) === "muted" && sp.said.length === 0);
  n.setMuted(false);
  t = feed(n, P("left_ventricle"), t, 1000);
  ok("unmute: does not blurt the structure already being held", sp.said.length === 0);
  ok("repeat: speaks the current structure on request", n.repeat(t) === "spoke" &&
     sp.said.join() === "Left Ventricle");
  ok("repeat: works again immediately (cooldown is for the automatic path only)",
     n.repeat(t + 100) === "spoke" && sp.said.length === 2);
  t = feed(n, null, t, 1000);
  ok("repeat: with nothing pointed at, repeats the last name spoken",
     n.repeat(t) === "spoke" && sp.said.at(-1) === "Left Ventricle");
  const fresh = SP.createNarrator({ speaker: fakeSpeaker() });
  ok("repeat: before anything was named it says so instead of guessing", fresh.repeat(0) === "nothing");
}
{
  const sp = fakeSpeaker(false), n = SP.createNarrator({ speaker: sp });
  let r = "";
  try { feed(n, P("left_ventricle"), 0, 3000); r = n.repeat(3000); } catch (e) { r = "threw"; }
  ok("unavailable speaker: no throw, nothing said, repeat reports it",
     r === "unavailable" && sp.said.length === 0);
  const bad = { available: true, speak() { throw new Error("boom"); }, cancel() { throw new Error("boom"); } };
  const n2 = SP.createNarrator({ speaker: bad });
  let threw = false;
  try { feed(n2, P("left_ventricle"), 0, 3000); n2.setMuted(true); n2.repeat(1); n2.reset(); }
  catch (e) { threw = true; }
  ok("a throwing speech engine never escapes the narrator", !threw);
  let threw2 = false;
  try { SP.createNarrator({ speaker: fakeSpeaker() }).update(P("x"), () => { throw 1; }, 0); }
  catch (e) { threw2 = true; }
  ok("a throwing name lookup is treated as 'unnamed', not a crash", !threw2);
}

// ======================================================= 3.10 Web Speech adapter
console.log("\n3.10 adapter: browserSpeaker / chooseVoice on fake windows");
{
  const none = SP.browserSpeaker({});
  ok("no speechSynthesis: available=false, calls are no-ops",
     none.available === false && none.speak("x") === false && (none.cancel(), true));
  ok("no window at all: still no throw", SP.browserSpeaker(undefined).available === false);

  const log = [];
  let voices = [], onv = null;
  class U { constructor(t) { this.text = t; } }
  // models the engine flags: speaking while an utterance is out, paused on demand
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => voices,
    addEventListener: (ev, fn) => { if (ev === "voiceschanged") onv = fn; },
    cancel: () => { log.push("cancel"); synth.speaking = false; },
    resume: () => { log.push("resume"); synth.paused = false; },
    speak: u => { log.push("speak:" + u.text); synth.last = u; synth.speaking = true; },
  };
  const sp = SP.browserSpeaker({ speechSynthesis: synth, SpeechSynthesisUtterance: U });
  ok("voices not loaded yet: reports loading (Chrome returns [] at first)", sp.voice === "loading");
  sp.speak("Left Ventricle");
  ok("speaks at once with the browser default rather than deferring (a deferred name goes stale)",
     log.join() === "speak:Left Ventricle" && synth.last.lang === "en-US" && !synth.last.voice);
  ok("an idle engine is not cancelled first (Chrome can drop a speak() right after cancel())",
     !log.includes("cancel"));
  const remote = { name: "Google US English", lang: "en-US", localService: false };
  const local = { name: "Samantha", lang: "en-US", localService: true };
  voices = [remote, { name: "Thomas", lang: "fr-FR", localService: true }, local];
  onv && onv();
  ok("voiceschanged: an on-device English voice is chosen over a network one",
     sp.voice === "local");
  sp.speak("Aortic Valve");
  ok("a speak() while a name is still out cancels it first, so the queue never holds an obsolete name",
     log.slice(-2).join() === "cancel,speak:Aortic Valve" && synth.last.voice === local);
  synth.speaking = false; synth.paused = true;
  sp.speak("Mitral Valve");
  ok("a paused engine is resumed before speaking (else it stays silent)",
     log.slice(-2).join() === "resume,speak:Mitral Valve", log.join());
  synth.last.onerror({ error: "interrupted" });
  ok("our own cancel (interrupted) is not reported as a fault", sp.status !== "error" && sp.status !== "blocked");
  synth.last.onerror({ error: "not-allowed" });
  ok("Chrome's no-user-gesture refusal is reported as 'blocked'", sp.status === "blocked");
  ok("chooseVoice: remote-only list -> browser default (null), flagged non-local",
     SP.chooseVoice([remote]).voice === null && SP.chooseVoice([remote]).local === false);
  const throwing = SP.browserSpeaker({ speechSynthesis: { speak() { throw 1; }, cancel() { throw 1; }, getVoices() { throw 1; } },
                                       SpeechSynthesisUtterance: U });
  ok("a throwing engine: speak returns false and sets status, no throw",
     throwing.speak("x") === false && throwing.status === "error");
}

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
    mode: HUD.deriveMode({ hands: 1 }), tracking: "1 hand", speech: "on" }));
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
    mode: HUD.deriveMode({}), tracking: "no hands", speech: "on" });
  ok("generic model: system + asset source, marked generic",
     JSON.stringify(gen).includes("cardiovascular · BodyParts3D (generic)"));
  const cs = HUD.hudRows({ model: HUD.summarizeModel({ doc: {}, caseActive: true }), pointing: null,
    mode: HUD.deriveMode({}), tracking: "", speech: "" });
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
  ok("speech line: unavailable / muted / needs a gesture / local voice",
     HUD.speechLine({ available: false }) === "unavailable in this browser" &&
     HUD.speechLine({ available: true }, true) === "muted (M)" &&
     /press a key/.test(HUD.speechLine({ available: true, status: "ready" }, false, false)) &&
     HUD.speechLine({ available: true, status: "ok", voice: "local" }, false, true) === "on · on-device voice");
}

// ============================== integration: real core.js pointing -> HUD -> speech
console.log("\nintegration: core.js pointState -> hud.js install (fake DOM) -> narrator");
const SRC = join(HERE, "..", "js", "medical"), BOX = join(HERE, "cutgest", "hud");
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
const spoken = [];
class Utt { constructor(t) { this.text = t; } }
globalThis.SpeechSynthesisUtterance = Utt;
globalThis.speechSynthesis = { getVoices: () => [{ name: "Samantha", lang: "en-US", localService: true }],
  addEventListener() {}, cancel() {}, speak(u) { spoken.push(u.text); } };

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
ok("speech: the real pointing path ends in exactly one spoken reviewed name",
   spoken.join("|") === "Left Coronary Artery", JSON.stringify(spoken));
ok("panel: answer isolation holds with a case lesion on the pointed structure",
   panel().includes("answer hidden") && !/stemi|lad_occlusion|anterior|occlusion|infarct/i.test(panel()), panel());
ok("panel: never shows a raw id or mesh name", !/left_coronary_artery|lv_wall/.test(panel()));
ok("panel: education-only banner present", /NOT FOR CLINICAL USE/.test(panel()));
ok("panel: mode + tracking", /pointing · 1 hand/.test(panel()), panel());

const key = k => winKeys.forEach(f => f({ key: k }));
key("m"); tick();
ok("M mutes, persists the choice and the panel says so",
   store["nova-tts-muted"] === "1" && /muted \(M\)/.test(panel()));
key("n");
ok("N while muted says nothing", spoken.length === 1);
key("m"); key("n");
ok("N after unmute repeats the current structure", spoken.length === 2 && spoken[1] === "Left Coronary Artery");
winKeys.forEach(f => f({ key: "m", metaKey: true }));
ok("Cmd-M (macOS minimize) is ignored", store["nova-tts-muted"] === "0");
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
ok("tracking loss: no further speech", spoken.length === 2);

// fault isolation: core views that throw must not take the HUD timer down
let threw = false;
BOOM = true;
try { tick(); tick(); } catch (e) { threw = true; }
BOOM = false;
const before = spoken.length;
try { tick(); } catch (e) { threw = true; }
ok("a faulting stage getter cannot throw out of the HUD tick, and the next tick recovers",
   !threw && spoken.length === before && /NOT FOR CLINICAL USE/.test(panel()));
CORE.installHud({ items: () => items, cursors: () => cursors });
await sleep(50);
ok("a second installHud is a no-op (one panel, one timer)",
   timers.length === 1 && fakeDoc.body.children.filter(c => c.id === "nova-hud").length === 1);

// ============================================================ stage.html wiring
console.log("\nstage.html wiring");
const hookAt = STAGE.indexOf("MED.installHud?.({ items: () => items, cursors: () => cursors });");
const renderAt = STAGE.indexOf('if (ROLE === "render") {');
ok("hook: one optional call, marked MEDICAL HOOK", hookAt > 0 &&
   STAGE.lastIndexOf("MEDICAL HOOK (3.9/3.10)", hookAt) > hookAt - 300 &&
   (STAGE.match(/MED\.installHud/g) || []).length === 1);
ok("hook: installed only on the tracker page (else-branch of the render role)",
   hookAt > renderAt && hookAt < STAGE.indexOf("MED.installMouse?.("));
ok("hook: called once at page setup, after the frame/render loops are defined (not inside them)",
   hookAt > STAGE.indexOf("function frame(now)") && hookAt > STAGE.indexOf("requestAnimationFrame(renderLoop);"));
ok("hint lists M / N / H inside a MEDICAL HOOK span",
   /<!-- MEDICAL HOOK -->[^<]*M mute names \/ N repeat name \/ H hide HUD<!-- \/MEDICAL HOOK -->/.test(STAGE));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
