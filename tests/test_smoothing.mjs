/* Task 3.11: cursor smoothing, EMA (the board's) vs One Euro (opt-in).
 *
 *   node tests/test_smoothing.mjs
 *
 * Synthetic 30 fps signals with a seeded RNG, so every number is
 * reproducible: white 3 px jitter at rest, noise-free ramps for lag, a
 * 300 px step for settling. These bound the FILTER; they are not a
 * measurement of a real hand on a real webcam (that is the manual A/B in
 * docs/validation/2026-11-14-3-9-3-11-ui.md).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SM = await import("../js/medical/smoothing.js");
const IA = await import("../js/medical/interaction.js");
const STAGE = readFileSync(join(HERE, "..", "stage.html"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log("  ok    " + n))
                                 : (fail++, console.log("  FAIL  " + n + "  " + d)); };

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
const DT = 1000 / 30;
const run = (f, sig, dts) => { let t = 0; return sig.map((v, i) => f.filter(v, (t += dts ? dts[i] : DT))); };
const sd = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length;
                   return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

function measure(mk, dts) {
  seed = 1;
  const rest = Array.from({ length: 300 }, () => 500 + 3 * gauss());
  const jitter = sd(run(mk(), rest, dts).slice(60));          // after warm-up
  const lagPx = v => {                                          // steady-state ramp lag
    const s = Array.from({ length: 90 }, (_, i) => (i < 15 ? 0 : ((i - 15) * DT / 1000) * v));
    const o = run(mk(), s);
    return s[85] - o[85];
  };
  const st = Array.from({ length: 60 }, (_, i) => (i < 10 ? 0 : 300));
  const so = run(mk(), st);
  let k = 10; while (k < 60 && so[k] < 270) k++;
  return { jitter, slow: lagPx(100), fastMs: (lagPx(1500) / 1500) * 1000, step90: (k - 10) * DT };
}

console.log("\n3.11 filter comparison (synthetic 30 fps; not webcam data)");
seed = 1;
const raw = sd(Array.from({ length: 300 }, () => 3 * gauss()));
const E = measure(() => SM.ema());
const O = measure(() => SM.oneEuro());
const row = (n, m) => console.log(`    ${n.padEnd(22)} jitter ${m.jitter.toFixed(2)} px sd · lag@100px/s ${m.slow.toFixed(1)} px` +
                                  ` · lag@1500px/s ${m.fastMs.toFixed(0)} ms · step90 ${m.step90.toFixed(0)} ms`);
console.log(`    raw                    jitter ${raw.toFixed(2)} px sd`);
row("EMA 0.45 (default)", E);
row("One Euro 1/0.01/1", O);

ok("the existing EMA already filters (so One Euro must REPLACE it, not stack on it)", E.jitter < 0.6 * raw);
ok("One Euro: >= 30% less rest jitter than the EMA", O.jitter <= 0.7 * E.jitter,
   `${O.jitter.toFixed(2)} vs ${E.jitter.toFixed(2)}`);
ok("One Euro: fast-move lag at most a third of the EMA's (gestures must not feel delayed)",
   O.fastMs <= E.fastMs / 3, `${O.fastMs.toFixed(1)} vs ${E.fastMs.toFixed(1)} ms`);
ok("One Euro: added latency bounded: fast-move lag <= 1 frame (33 ms)", O.fastMs <= DT);
ok("One Euro: slow-move lag within 1.5 px of the EMA's and far under the 26 px pointing stillness",
   O.slow <= E.slow + 1.5 && O.slow < 26 / 4, `${O.slow.toFixed(1)} vs ${E.slow.toFixed(1)} px`);
ok("One Euro: a 300 px step settles no slower than the EMA", O.step90 <= E.step90);

// a webcam's frame interval wanders; One Euro is dt-aware, the EMA is not
seed = 7;
const dts = Array.from({ length: 300 }, () => 25 + 20 * rnd());
const Ov = measure(() => SM.oneEuro(), dts);
ok("variable frame interval (25-45 ms): jitter still below the EMA's", Ov.jitter < E.jitter,
   Ov.jitter.toFixed(2));
const f0 = SM.oneEuro();
f0.filter(10, 100);
ok("a clock that does not advance never divides by zero", Number.isFinite(f0.filter(20, 100)) && f0.filter(20, 100) === 10);

console.log("\n3.11 cursor semantics: loss, reacquisition, defaults");
{
  const cur = { x: 0, y: 0, history: [{ x: 0, y: 0, t: 0 }], pinched: true, lostT: 0, probKill: false };
  SM.smoothWith(cur, 100, 200, 1000);
  ok("first sample: the cursor starts AT the hand (EMA would glide from screen centre)",
     cur.x === 100 && cur.y === 200);
  for (let t = 1033; t < 1300; t += 33) SM.smoothWith(cur, 100 + 3 * Math.sin(t), 200, t);
  // tracking loss: interaction.js freezes the cursor; no samples reach the filter
  ok("holdLost still freezes (filter state does not affect it)", IA.holdLost(cur, 1300) === true && cur.lostT === 1300);
  IA.foundCursor(cur);
  ok("foundCursor still clears lostT and history (unchanged)", cur.lostT === 0 && cur.history.length === 0);
  SM.smoothWith(cur, 400, 260, 1700);                           // 400 ms later, 300 px away
  ok("reacquired after a gap: resumes AT the hand, no glide, so no fake fling velocity",
     cur.x === 400 && cur.y === 260);
  ok("the filter never writes pinched / lostT / history / probKill",
     cur.pinched === true && cur.lostT === 0 && cur.history.length === 0 && cur.probKill === false);
  const e = { x: 100 }; e.x += (400 - e.x) * SM.EMA_ALPHA;
  console.log(`    (for contrast, the EMA's first reacquired frame lands at ${e.x} px: a ${(e.x - 100).toFixed(0)} px jump written to history)`);
  const short = { x: 0, y: 0 };
  SM.smoothWith(short, 0, 0, 0); SM.smoothWith(short, 0, 0, 33);
  SM.smoothWith(short, 30, 0, 100);                             // 67 ms gap: one dropped frame
  ok("a single dropped frame is NOT a reacquisition (still filtered)", short.x > 0 && short.x < 30);
  ok("non-finite input is refused, cursor untouched",
     SM.smoothWith(short, NaN, 0, 200) === false && Number.isFinite(short.x));
  const d = { x: 5, y: 5 };
  ok("default (no ?smooth=oneeuro): smoothCursor is a no-op, the EMA stands",
     SM.smoothCursor(d, 500, 500, 1) === false && d.x === 5 && SM.smoothingMode() === "ema");
}

console.log("\nstage.html wiring");
{
  const emaAt = STAGE.indexOf("cur.x += (px - cur.x) * 0.45; cur.y += (py - cur.y) * 0.45;");
  const hookAt = STAGE.indexOf("MED.smoothCursor?.(cur, px, py, now);");
  const histAt = STAGE.indexOf("cur.history.push({ x: cur.x, y: cur.y, t: now });");
  ok("upstream EMA line is untouched", emaAt > 0);
  ok("hook sits after the EMA and before the history push, marked MEDICAL HOOK",
     emaAt < hookAt && hookAt < histAt && STAGE.lastIndexOf("MEDICAL HOOK (3.11)", hookAt) > emaAt);
  ok("exactly one smoothing hook", (STAGE.match(/MED\.smoothCursor/g) || []).length === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
