// js/medical/hud.js: task 3.9, the demo overlay.
//
// A small read-only panel, bottom-left on the tracker page, that shows:
// the active model, what is pointed at, the interaction mode, one short
// gesture tip, and tracking state (plus the filter when ?smooth=oneeuro).
// It has one mouse button (Reset pose) and one key (H hides it).
// It is installed through ONE optional hook (MED.installHud?.()) and runs on its own
// setInterval, never inside the tracker's rAF loop. Every tick is wrapped,
// so an overlay fault can't touch hand tracking or rendering.
// It is silent: browser speech (3.10) was removed from Phase 4 at team
// direction (2026-11-17); nothing here uses the Web Speech API.
//
// What it is allowed to show is decided here by whitelist, not by the
// sidecar or manifest:
//   - scan bundles: provenance.dataset, a short content revision, and the
//     segmentation reviewer_state. NOT bundle_id, source_case, input hashes,
//     created time or any other manifest field (ADR 0002 lets source_case
//     carry a dataset case id; a de-identified id is still not for the demo
//     screen).
//   - generic models: the sidecar's source.name (the asset's provenance).
//   - case lesions: only "a case overlay is active". The case id and lesion id
//     are never shown (the shipped lesion id `lad_occlusion` IS the answer),
//     and neither is the lesion's structure. This preserves the
//     /case-render answer isolation from KNOWLEDGE.md.
// All text goes in through textContent, never innerHTML.

const TICK_MS = 100;
const NOHAND_TIP_MS = 2000;    // after this long with no hands, offer the mouse fallback
const MAXLEN = 48;

const str = v => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAXLEN) : null);

/** Pure: the whitelisted model summary. `raw` comes from core.js boardInfo(). */
export function summarizeModel(raw) {
  if (!raw) return null;
  const doc = raw.doc || {}, m = raw.manifest;
  const out = {
    kind: m ? "scan bundle" : "generic model",
    system: str(doc.system),
    structures: doc.structures && typeof doc.structures === "object"
      ? Object.keys(doc.structures).length : 0,
    caseActive: !!raw.caseActive,
    armed: !!raw.armed,
  };
  if (m) {
    const pv = m.provenance || {};
    // a dataset NAME (synthetic / ircadb / dicom / msd-liver ...), never free
    // text: the schema leaves it an open string, so anything else is dropped
    const ds = str(pv.dataset);
    out.dataset = ds && /^[a-z0-9][a-z0-9._-]{0,31}$/i.test(ds) ? ds : null;
    const rv = typeof raw.revision === "string" ? raw.revision : m.revision;
    out.revision = typeof rv === "string" && /^[0-9a-f]{8,}$/i.test(rv) ? rv.slice(0, 12) : null;
    out.review = str(pv.segmentation && pv.segmentation.reviewer_state);
  } else {
    out.source = str(doc.source && doc.source.name);
  }
  return out;
}

/** Pure: what the POINTING row says for core.js's published `pt`. The
 *  sidecar's reviewed `name` only (anatomy.schema.md makes it required), so
 *  an unnamed structure shows nothing rather than a raw id or mesh name.
 *  `nameOf(model, structure)` = core.js structureName. */
export function pointingText(pt, nameOf) {
  if (!pt) return null;
  if (pt.ambiguous) return "two hands disagree (nothing named)";
  if (!pt.structure || !pt.model) return null;
  let n = null;
  try { n = nameOf ? nameOf(pt.model, pt.structure) : null; } catch (e) { n = null; }
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

/** Pure: one interaction mode, highest priority first. */
export function deriveMode({ hands = 0, frozen = 0, grabs = 0, twoHand = false,
                             armed = false, pt = null } = {}) {
  if (armed) return { mode: "cut armed", tip: "flat palm swipes the plane · two fingers spread it · X to disarm" };
  if (twoHand) return { mode: "scaling", tip: "move hands apart / together · release to stop" };
  if (grabs) return { mode: "holding", tip: "drag to move · hold still ~1 s to rotate · release to drop" };
  if (pt && pt.ambiguous) return { mode: "pointing", tip: "two hands disagree. Point with one hand" };
  if (pt && pt.structure) return { mode: "pointing", tip: "pinch to grab · move on to name another structure" };
  if (!hands && frozen) return { mode: "tracking lost", tip: "hand frozen: bring it back into view" };
  if (!hands) return { mode: "no hands", tip: "show a hand to the camera" };
  return { mode: "ready", tip: "open hand, hold still on a structure to name it · pinch to grab" };
}

/** Pure: everything the panel says, as [label, text] rows. */
export function hudRows(s) {
  const rows = [];
  const m = s.model;
  if (!m) rows.push(["MODEL", "no anatomy model on the board"]);
  else if (m.kind === "scan bundle")
    rows.push(["MODEL", ["scan bundle", m.dataset, m.revision && "rev " + m.revision,
                         m.review && "seg: " + m.review].filter(Boolean).join(" · ")]);
  else rows.push(["MODEL", [m.system || "anatomy", m.source].filter(Boolean).join(" · ") +
                           " (generic)"]);
  if (m && m.caseActive) rows.push(["CASE", "lesion overlay shown · answer hidden"]);
  rows.push(["POINTING", s.pointing || "—"]);
  rows.push(["MODE", s.mode.mode + " · " + s.tracking]);
  rows.push(["TIP", s.mode.tip]);
  return rows;
}

/** Pure: tracking summary from the live cursors object. */
export function trackingState(cursors) {
  let hands = 0, frozen = 0, grabs = 0;
  for (const k in cursors || {}) {
    const c = cursors[k];
    if (!c) continue;
    if (c.lostT) frozen++; else hands++;
  }
  return { hands, frozen, grabs,
           text: hands ? `${hands} hand${hands > 1 ? "s" : ""}` + (frozen ? ` · ${frozen} frozen` : "")
                       : frozen ? `${frozen} frozen` : "no hands" };
}

// ----------------------------------------------------------------- DOM
let _el = null;
function build(doc, actions) {
  const st = doc.createElement("style");
  st.textContent =
    "#nova-hud{position:fixed;left:14px;bottom:56px;z-index:997;max-width:380px;" +
    "padding:9px 12px 10px;border-radius:10px;background:rgba(4,22,26,.62);" +
    "border:1px solid rgba(111,229,214,.25);color:#cfeee8;" +
    "font:12px/1.45 'SF Mono',Menlo,monospace;pointer-events:none;" +
    "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}" +
    "#nova-hud .t{color:#6fe3c9;letter-spacing:.14em;font-size:10.5px;margin-bottom:4px}" +
    "#nova-hud .r{display:flex;gap:8px}#nova-hud .k{color:#7fb3ab;min-width:72px;flex:none}" +
    "#nova-hud .v{overflow-wrap:anywhere}#nova-hud .pt{color:#fff;font-weight:600}" +
    "#nova-hud .b{display:flex;gap:6px;margin-top:7px;pointer-events:auto}" +
    "#nova-hud button{font:inherit;font-size:11px;color:#bff5ea;background:rgba(111,229,214,.12);" +
    "border:1px solid rgba(111,229,214,.35);border-radius:6px;padding:3px 8px;cursor:pointer}" +
    "#nova-hud button:hover{background:rgba(111,229,214,.28)}" +
    "body.overlay #nova-hud,body.keybg #nova-hud,#nova-hud.off{display:none}";
  doc.head.appendChild(st);
  const el = doc.createElement("div");
  el.id = "nova-hud";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const t = doc.createElement("div");
  t.className = "t";
  t.textContent = "NOVA · EDUCATION & RESEARCH PROTOTYPE · NOT FOR CLINICAL USE";
  el.appendChild(t);
  const body = doc.createElement("div");
  el.appendChild(body);
  const bar = doc.createElement("div");
  bar.className = "b";
  const btn = (label, title, fn) => {
    const b = doc.createElement("button");
    b.type = "button"; b.textContent = label; b.title = title;
    b.addEventListener("click", e => { e.stopPropagation(); try { fn(); } catch (x) {} });
    bar.appendChild(b);
    return b;
  };
  btn("Reset pose", "put the model back to its starting pose", actions.reset);
  el.appendChild(bar);
  // keep a click on the panel from also starting interaction.js's mouse drag
  el.addEventListener("mousedown", e => e.stopPropagation());
  doc.body.appendChild(el);
  return { el, body, last: "" };
}

function paintRows(ui, doc, rows) {
  const sig = JSON.stringify(rows);
  if (sig === ui.last) return;          // no DOM writes on an unchanged tick
  ui.last = sig;
  ui.body.textContent = "";
  for (const [k, v] of rows) {
    const r = doc.createElement("div"); r.className = "r";
    const a = doc.createElement("span"); a.className = "k"; a.textContent = k;
    const b = doc.createElement("span"); b.className = "v" + (k === "POINTING" ? " pt" : "");
    b.textContent = v;
    r.appendChild(a); r.appendChild(b); ui.body.appendChild(r);
  }
}

/** Called by core.installHud with the stage getters and core's read-only views.
 *  ctx: {items(), cursors(), toast(msg), resetPose(it),
 *        pointState(), structureName(model, sid), boardInfo(), smoothingMode()} */
export function install(ctx, win = globalThis) {
  if (_el || !win.document || !win.document.body) return null;
  const doc = win.document;
  const toast = m => { try { ctx.toast && ctx.toast(m, 1600); } catch (e) {} };
  const now = () => (win.performance ? win.performance.now() : Date.now());

  const actions = {
    reset() {
      const its = (ctx.items && ctx.items()) || [];
      const it = its.filter(k => k.type === "model" && k.el && k.el.isConnected).pop();
      if (!it) { toast("no model to reset"); return; }
      if (it.grabbedBy && it.grabbedBy.length) { toast("release the model first"); return; }
      ctx.resetPose && ctx.resetPose(it);
      toast("pose reset");
    },
  };
  const ui = build(doc, actions);
  _el = ui.el;

  win.addEventListener("keydown", e => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;   // Cmd-H hides the app; leave it alone
    if ((e.key || "").toLowerCase() === "h") ui.el.classList.toggle("off");
  });

  let noHandSince = now();
  const tick = () => {
    try {
      const t = now();
      let pt = null;
      try { pt = ctx.pointState ? ctx.pointState() : null; } catch (e) {}
      const pointing = pointingText(pt, ctx.structureName);   // reviewed name; never an id
      const tr = trackingState(ctx.cursors && ctx.cursors());
      // 3.11 A/B: name the filter only when it is NOT the default EMA
      try { if (ctx.smoothingMode && ctx.smoothingMode() === "oneeuro") tr.text += " · one-euro"; } catch (e) {}
      let grabs = 0, twoHand = false;
      for (const it of (ctx.items && ctx.items()) || []) {
        const g = it && it.grabbedBy ? it.grabbedBy.length : 0;
        if (g) grabs++;
        if (g > 1) twoHand = true;
      }
      let info = null;
      try { info = ctx.boardInfo ? ctx.boardInfo() : null; } catch (e) {}
      const model = summarizeModel(info);
      const mode = deriveMode({ hands: tr.hands, frozen: tr.frozen, grabs, twoHand,
                                armed: model && model.armed, pt });
      if (tr.hands || tr.frozen) noHandSince = t;
      else if (t - noHandSince > NOHAND_TIP_MS)
        mode.tip = "no hands? mouse: drag = move · shift-drag = rotate · wheel = scale";
      paintRows(ui, doc, hudRows({ model, pointing, mode, tracking: tr.text }));
    } catch (e) {}
  };
  win.setInterval(tick, TICK_MS);
  tick();
  return { tick, el: ui.el };
}
