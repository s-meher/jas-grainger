// js/medical/speech.js: task 3.10, browser speech for "what is this?".
//
// The in-browser successor to bin/narrate.sh, with the same law: every word
// spoken is a structure `name` read out of the reviewed anatomy sidecar. No
// model runs here, nothing is generated, and a structure with no reviewed
// name says nothing at all. anatomy.schema.md makes `name` REQUIRED, so
// there is no contract for speaking a raw id or mesh name, and this never
// falls back to one (narrate.sh's `sid.replace("_"," ")` is not copied).
//
// Two halves, so the decisions are testable without a browser:
//
//   createNarrator({speaker})  PURE state machine. Fed core.js's published
//       pointing (`pt`, already gated on a still hand + a stable structure)
//       about every 100 ms, it decides when to speak:
//         - a structure must stay published SPEAK_DWELL_MS before a word
//           (the bus's "hand stopped" is not yet "deliberately asking":
//           narrate.sh's --dwell lesson, L12),
//         - the same structure is not re-spoken inside COOLDOWN_MS
//           (narrate.sh's 8 s: a hand on a border flickers between neighbours),
//         - a structure change or a cleared/ambiguous pointer drops the
//           pending utterance, so nothing stale is ever said late,
//         - mute silences and cancels; repeat is the only way to hear the
//           same name again on purpose.
//   browserSpeaker(win)  the Web Speech API adapter. Fails soft: no
//       speechSynthesis -> `available:false` and every call is a no-op.
//       It never queues: speak() cancels anything still speaking/pending
//       first, so the browser queue can't hold an obsolete name. Voices load asynchronously (Chrome returns []
//       until `voiceschanged`), so the voice is re-chosen on that event and
//       a name requested before then uses the browser default immediately
//       rather than being deferred (a deferred name is a stale name).
//
// Nothing here is called from the tracker's frame loop: hud.js drives it
// from its own timer, so a speech failure cannot stall tracking or render.

export const SPEAK_DWELL_MS = 800;   // on top of the bus's ~1.2 s still+stable gate
export const COOLDOWN_MS = 8000;     // narrate.sh's same-structure repeat guard

/** Pure: the published pointer -> {key, model, structure, name} or a reason.
 *  `nameOf(model, structure)` returns the sidecar's reviewed name or null. */
export function resolveTarget(pt, nameOf) {
  if (!pt) return { why: "none" };
  if (pt.ambiguous) return { why: "ambiguous" };
  if (!pt.structure || !pt.model) return { why: "none" };
  let name = null;
  try { name = nameOf ? nameOf(pt.model, pt.structure) : null; } catch (e) { name = null; }
  if (typeof name !== "string" || !name.trim()) return { why: "unnamed" };
  return { key: pt.model + "|" + pt.structure, model: pt.model,
           structure: pt.structure, name: name.trim() };
}

/** Pure decision core. `speaker` = {available, speak(text) -> bool, cancel()}. */
export function createNarrator({ speaker, dwellMs = SPEAK_DWELL_MS,
                                 cooldownMs = COOLDOWN_MS, muted = false } = {}) {
  const S = {
    muted: !!muted,
    cand: null,        // {key, name, t0, done}: the structure dwelling now
    current: null,     // what is pointed at right now (for repeat + HUD)
    last: null,        // {key, name, t}: the last thing actually spoken
    why: "none",
  };
  const say = (text) => {
    if (!speaker || !speaker.available) return false;
    try { return speaker.speak(text) !== false; } catch (e) { return false; }
  };
  const hush = () => { try { speaker && speaker.cancel && speaker.cancel(); } catch (e) {} };

  return {
    state: S,
    /** Once per HUD tick. Returns what happened, for tests and the HUD. */
    update(pt, nameOf, now) {
      const tg = resolveTarget(pt, nameOf);
      if (!tg.key) {
        // pointing cleared / ambiguous / unnamed: the pending name is stale
        S.cand = null; S.current = null; S.why = tg.why;
        return "idle";
      }
      S.why = "pointing";
      S.current = tg;
      // a different structure restarts the dwell; the old one is never said
      if (!S.cand || S.cand.key !== tg.key) S.cand = { ...tg, t0: now, done: false };
      if (S.cand.done) return "held";
      if (now - S.cand.t0 < dwellMs) return "dwelling";
      S.cand.done = true;     // decided once per arrival, never every tick
      if (S.muted) return "muted";
      if (S.last && S.last.key === tg.key && now - S.last.t < cooldownMs) return "cooldown";
      if (!say(tg.name)) return "unavailable";
      S.last = { key: tg.key, name: tg.name, t: now };
      return "spoke";
    },
    /** The deliberate "say it again": the current structure, else the last
     *  one spoken. Ignores the cooldown (it was asked for); obeys mute. */
    repeat(now) {
      const tg = S.current || S.last;
      if (!tg) return "nothing";
      if (S.muted) return "muted";
      if (!say(tg.name)) return "unavailable";
      S.last = { key: tg.key, name: tg.name, t: now };
      return "spoke";
    },
    setMuted(m) {
      S.muted = !!m;
      if (S.muted) hush();      // muting stops a name mid-word, too
      return S.muted;
    },
    /** Board respawned / model gone: forget everything pending. */
    reset() { S.cand = null; S.current = null; hush(); },
  };
}

/** Pure: choose a voice. Local (on-device) English first: it works offline
 *  and sends nothing anywhere. A remote-only list returns {voice:null} so the
 *  browser default speaks, and the HUD says it may need the network. */
export function chooseVoice(voices, lang = "en") {
  const vs = Array.isArray(voices) ? voices : [];
  const en = v => typeof v.lang === "string" && v.lang.toLowerCase().startsWith(lang);
  const local = vs.filter(v => v && v.localService);
  const v = local.find(x => en(x) && x.default) || local.find(en) || null;
  return { voice: v, local: !!v, count: vs.length };
}

/** The Web Speech adapter. `win` is injectable for tests. */
export function browserSpeaker(win = globalThis) {
  const synth = win && win.speechSynthesis;
  const U = win && win.SpeechSynthesisUtterance;
  if (!synth || typeof U !== "function" || typeof synth.speak !== "function")
    return { available: false, status: "unavailable", voice: "none",
             speak() { return false; }, cancel() {} };

  const sp = { available: true, status: "ready", voice: "loading" };
  let pick = { voice: null, local: false, count: 0 };
  const choose = () => {
    try {
      pick = chooseVoice(synth.getVoices());
      sp.voice = pick.local ? "local" : pick.count ? "browser default" : "loading";
    } catch (e) { sp.voice = "browser default"; }
  };
  choose();
  try {
    if (synth.addEventListener) synth.addEventListener("voiceschanged", choose);
    else synth.onvoiceschanged = choose;
  } catch (e) {}

  sp.speak = (text) => {
    try {
      // never queue behind an obsolete name. Cancel only when something is
      // actually queued: some Chrome builds drop a speak() issued right
      // after a no-op cancel(), and a paused engine stays silent until resumed
      if (synth.speaking || synth.pending) synth.cancel();
      if (synth.paused && typeof synth.resume === "function") synth.resume();
      const u = new U(String(text));
      if (pick.voice) { u.voice = pick.voice; u.lang = pick.voice.lang; }
      else u.lang = "en-US";
      u.onstart = () => { sp.status = "ok"; };
      u.onerror = (e) => {
        const err = e && e.error;
        // our own cancel() surfaces as interrupted/canceled: not a fault
        if (err === "interrupted" || err === "canceled") return;
        // Chrome refuses speech before the first click/keypress on the page
        sp.status = err === "not-allowed" ? "blocked" : "error";
      };
      synth.speak(u);
      return true;
    } catch (e) { sp.status = "error"; return false; }
  };
  sp.cancel = () => { try { synth.cancel(); } catch (e) {} };
  return sp;
}
