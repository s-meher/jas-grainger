# Knowledge ledger — barehands, anatomy edition

What this fork has **learned, decided, and verified**, with the evidence for
each line. Code shows *what* the project does; this file records *why*, and
which lessons cost a field report to learn. Read it before changing the
medical layer, so you don't re-learn something already paid for.

**How to use it**

- One entry per fact. Each entry names its evidence: a commit, a file, or a
  test run. If something has no evidence, it goes under *Open items*, not
  in the ledger.
- Tag every entry: **LAW** (a rule you don't break), **FACT** (measured or
  verified), **LESSON** (a bug, what caused it, and the fix), **OPEN** (not
  known yet).
- Add new entries; don't rewrite old ones. When something stops being true,
  strike it through (`~~…~~`) and add the entry that replaces it, so the
  history stays readable.
- Add dated lines to the *Log* at the bottom.

---

## 1. Status snapshot — 2026-09-16

| thing | state | evidence |
|---|---|---|
| Contract suite | **77/77 pass** | `python3 tests/test_contract.py`, run 2026-09-16 |
| Gesture suite | **54/54 pass** | `node tests/test_gesture.mjs`, run 2026-09-16 |
| Heart sidecar ↔ GLB | valid, 0 warnings, 16/16 meshes covered | `schemas/validate.py`, run 2026-09-16 |
| Anterior MI case | valid, 0 warnings; `review.status: verified` | `validate.py --case`, run 2026-09-16; `36caa25` |
| Visual suite (17 renders) | not re-run since `2f7df88` | `tests/test_visual.py` takes ~5 min |
| Upstream | 1 commit not merged (`aa0e860`, README only) | `git rev-list main...upstream/main` |
| Organs | 1 (heart) | `media/models/heart/` |
| Cases | 1 (`heart-anterior-stemi-01`) | `cases/` |

---

## 2. Laws — rules you don't break

- **LAW — Education only.** This is not a medical device. It doesn't diagnose
  real patients, and nothing it shows is clinical judgment about a real person.
  `CLAUDE.md`, `README.md`
- **LAW — Content is never invented at runtime.** Every structure name, teaching
  line and pathology claim is read from a sidecar or case that a human wrote
  and a reviewer checked. `narrate.sh` speaks only sidecar text; no model runs
  in that loop. `6dd96ab`
- **LAW — The media airlock never widens.** The board stages files only from
  `media/`. A bare organ basename (`heart.glb`) gets a 400 on purpose: every
  organ exists in both `models/` and `holo/`, so the name is ambiguous and the
  server refuses to guess. `2f7df88`, `tests/test_contract.py`
- **LAW — The `/cmd` allowlist grows only through validated verbs.** Each new
  verb gets strict stdlib validation (enums, ranges, id regexes); no bare
  passthrough. `5af0f6a`, `schemas/verbs.md`
- **LAW — Answer isolation.** `/case-render` strips the vignette, diagnosis and
  teaching. Tests grep the response for the answer *text*, not only the field
  names. The examiner must never `label` the structure a lesion sits on,
  because the label gives away the answer. `67d2c84`, `2f7df88`
- **LAW — A case runs only once `review.status` is `verified`.** The examiner
  refuses anything else. `67d2c84`
- **LAW — Fetch a source before writing any reference, including a
  correction.** Fixing a citation is exactly when fabrication happens: an
  identifier supplied by the reviewer makes the fix *feel* verified while the
  byline is invented. `06ab91c`, `36caa25`
- **LAW — `stage.html` changes only through marked `MEDICAL HOOK` lines.**
  Everything else goes in `js/medical/`, so upstream's gesture fixes merge
  cleanly. `adac0a6`
- **LAW — A medical hook must never be able to kill hand tracking.** Every
  call into `MED` is an optional call (`MED.fn?.()`). If a module is stale or
  half-loaded, the board degrades to plain upstream barehands instead of
  freezing. `be028b1`
- **LAW — Updaters never merge.** `update.sh` / `update.bat` only fetch
  upstream and print a collision forecast. You then merge by hand with
  `git merge upstream/main`. `673bba6`

---

## 3. Facts — measured or verified

### The heart asset
- **FACT** — `heart.glb` has 16 named meshes built from DBCLS BodyParts3D
  (CC-BY 4.0), decimated to about 130k tris / 1.5 MB. Attribution is in
  `media/models/heart/LICENSE.md`. `8f07afa`
- **FACT** — Structure ids: `right_atrium`, `left_atrium`, `right_ventricle`,
  `left_ventricle`, `ascending_aorta`, `aortic_arch`, `pulmonary_trunk`,
  `superior_vena_cava`, `inferior_vena_cava`, `right_coronary_artery`,
  `left_coronary_artery`, `coronary_sinus`, `tricuspid_valve`, `mitral_valve`,
  `aortic_valve`, `pulmonary_valve`. Valves are on layer 1 and parented to
  their ventricles; the sidecar has 30 clinical aliases. `fdeb348`
- **FACT** — The heart has **no LAD mesh**. The alias "LAD" maps to the
  undivided `left_coronary_artery`. `fdeb348`
- **FACT** — The heart's own axes: superior **+z**, left **+x**, anterior
  **−y**. This is not glTF Y-up, and it is recorded in the sidecar's `axes`
  block. `d63bef4`
- **FACT** — The GLB has POSITION data only, with **no NORMAL**. `core.js`
  computes vertex normals at load for any medical model that lacks them.
  `2f7df88`
- **FACT** — All 16 meshes are closed manifolds, so stencil caps count exactly
  on this model. Leaky models need a fallback, which is documented in a
  comment but not built. `4c121d5`

### The runtime
- **FACT** — A connected tracker posts `/state` about 45×/sec, so an injected
  synthetic state lasts about 22 ms. You can't simulate a pointing hit while the
  board is open. Board-state tests report SKIPPED instead of failing in that
  case. An idle but live tracker posts byte-identical heartbeats, so matching
  hashes don't mean the page has stopped. `6dd96ab`, `2a2664e`
- **FACT** — The `/state` heartbeat budget is 256 KB, which is why the bus
  field names are short (`cut`, `iso`, `hid`, `lb`, `pt`). `schemas/verbs.md`
- **FACT** — The tracker page can't boot headless because MediaPipe needs a
  real camera. Only a person at the webcam can verify pointing and gesture
  thresholds. `tests/README.md`
- **FACT** — Render tests need hardware ANGLE. SwiftShader can't compile the
  cut's stencil programs within the time budget and quietly renders an uncut
  model. `tests/README.md`
- **FACT** — Tracker hotkeys: **R** re-read notes · **C** cycle camera ·
  **D** debug overlay · **P** pose sampler · **X** arm or disarm the cut
  (medical) · **G** cut-gesture sampler (medical, `gesture.js`).
- **FACT** — The flat-palm incision **works on a real hand**. This was the
  first live confirmation of any cut threshold. `879e36d`

### Content
- **FACT** — Under the Fourth Universal Definition, a 48 h infarct is
  **acute**. "Subacute" means the 7–28 day window, and "evolving" means
  under 6 h. Neither is an accepted answer for the 48 h case. `7c0fbba`
- **FACT** — A flat tint render **can't** show the two-zone gross appearance
  (yellow-tan centre with a congested rim). Rubrics may reward only what the
  board can actually display. `ef2ae07`, `7c0fbba`
- **FACT** — Correct citation for NBK537228: *Lateral Wall Myocardial
  Infarction*, Ludhwani, Chhabra, Goyal, Quintanilla Rodriguez, Gupta
  (updated 29 Oct 2024). An earlier byline had been invented. `06ab91c`

---

## 4. Lessons — bug → cause → fix

| # | symptom | real cause | fix | commit |
|---|---|---|---|---|
| L1 | X-ray rendered nothing (zero non-white pixels) | GLB had no normals, so the shader computed `normalize(vec3(0))` = NaN | compute vertex normals at load | `2f7df88` |
| L2 | "Label all" pushed labels off the card | de-collision pushed labels only downward, with no bound | walk back up and clamp to the card | `2f7df88` |
| L3 | Coronal cut at t=0.55 missed the myocardium | presets assumed glTF Y-up | anatomical `axes` block in the sidecar | `d63bef4` |
| L4 | Heart slowly rotated on its own, and pointing was flaky | upstream's +0.12 rad/s idle drift is right for a prop, wrong for a specimen | no drift for models with a sidecar; hand spin still coasts | `b26172e` |
| L5 | Edits to `core.js` "didn't take" | browser cached the module | `js/medical/*` served no-store | `b26172e` |
| L6 | Tracker froze: `MED.stillModel is not a function` | stale module plus a throw inside the rAF loop | all hooks became optional calls | `be028b1` |
| L7 | With a cut armed, every pinch triggered narration | pointing read the *suspended* pinch flag | read the physical pinch before suspension | `2a2664e` |
| L8 | Cut mode disarmed before the first swipe | 20 s idle timeout was a guess | 3 minutes | `8693af1` |
| L9 | Arming needed an agent round-trip mid-gesture | no local control | **X** key. A pose was rejected because a flat palm is also the pointing pose | `879e36d` |
| L10 | "It's not cutting" on a large heart | swipe travel scaled with card width (6× → 1584 px, wider than the screen) | clamp travel to a span a shoulder can cross (6× → 660 px) | `bbf3e94` |
| L11 | Pinching near the heart grabbed it | hit area was the fixed 480 px card, which grows with scale | hit-test the organ's projected silhouette | `f0b1c37` |
| L12 | Narrated everything the hand swept past | gate checked "same structure 150 ms", not "hand stopped" | 26 px stillness + 600 ms rest on the bus; `narrate.sh --dwell` 2 s | `37d8ff3` |
| L13 | A scrub's release made a cut | an opening hand still moving sideways is a flat palm crossing the organ | reject incisions within 800 ms of a pinch (upstream's clap idiom) | `256d792` |
| L14 | Flat "cut" faces while exploding | **not the cut**: parts flew past the fixed camera frame, and cropped open shells show their insides | camera dollies back as the explosion opens | `5815850` |
| L15 | Armed cut + two flat hands could clear the board | the clap gate screened only recent pinches | an armed cut disqualifies the clap | `a50a76f` |

**Meta-lessons**
- **LESSON** — Check your diagnosis before building a fix. L13 fixed a real
  bug, but it wasn't what the user's photo showed (L14). `5815850`
- **LESSON** — Comments can say the opposite of what the code does: L10's
  comment called the travel rule "scale-proof". Measure at the extremes
  (large scale, small window). `bbf3e94`
- **LESSON** — In gesture tests, identical poses on identical paths write
  identical planes, so "the value changed" can't detect a cut. Also, the
  previous commit's cooldown may still be running. Both are noted in the
  test. `256d792`
- **LESSON** — Independent review catches what the author can't: two content
  errors (`ef2ae07`) and one invented citation (`06ab91c`). Keep reviewers in
  a separate context, with no write access to the content.

---

## 5. Content ledger

| id | organ | pathology doc | case | review | notes |
|---|---|---|---|---|---|
| `heart-anterior-stemi-01` | heart | `pathology/anterior-mi.md` | `cases/heart-anterior-stemi-01.json` | **verified** 2026-08-20, 3 passes | 48 h timepoint; 22 accepted phrasings; 4 distractors; review files in `review/` |

---

## 6. Open items

- **OPEN** — Cut-gesture thresholds are mostly still provisional. The swipe
  fires on a real hand (`879e36d`), but palm-normal stability is flagged as the
  likeliest wrong value and the two-finger retraction scrub has no live
  confirmation. Run `skills/gesture-tuning/SKILL.md`.
- **OPEN** — Pointing handedness hasn't been checked by a human at the
  webcam: does `POINTING AT` ever name the mirror-image structure? `core.js`
  has a marked one-line fix ready. `tests/README.md`
- **OPEN** — The MI morphology table was confirmed against four independent
  references, but **not** against the printed Robbins 10e it cites. It stays
  flagged in the pathology doc. `36caa25`
- **OPEN** — Upstream `aa0e860` (README example vault path) isn't merged. It
  touches `README.md`, which this fork has rewritten, so expect a conflict and
  keep the fork's version.
- **OPEN** — The `layer` verb has little to show on the heart (layers 0–1
  only). `verbs.md` examples use ids that don't exist here (`skin`,
  `cardiomyopathy-1`); they're only illustrations.
- **OPEN** — Stencil caps are skipped when post-processing (bloom) is on,
  because the bloom render targets have no stencil buffer. `4c121d5`
- **OPEN** — Leaky (non-manifold) models have no solid-ink cap fallback yet.
  `4c121d5`
- **OPEN** — The visual suite hasn't been re-run since `b26172e` onward
  changed render/camera behaviour (drift removed, explode dolly added).
- **OPEN** — `Claude.pdf` in the repo root is untracked and unreviewed.

---

## 7. Log

- **2026-08-15 → 08-19** — Upstream barehands, 24 commits (`b01a35b` … `f1f8c9e`).
- **2026-08-20** — Fork groundwork, heart model and sidecar, medical layer
  (9 hooks), capped cuts, anatomical axes, hand-driven cut, anterior MI case
  through three review passes → verified.
- **2026-08-21** — Fork-safe updater, examiner skill, acceptance suite
  (caught L1/L2), a day of field fixes (L4–L12), `point-watch.sh`,
  `narrate.sh`.
- **2026-08-22** — Scrub release guard (L13), explode dolly (L14). Last commit
  `5815850`.
- **2026-09-16** — Ledger created. Contract 77/77, gesture 54/54, both
  validators clean. README rewritten around the anatomy edition.
