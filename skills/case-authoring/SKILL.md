---
name: case-authoring
description: Procedure for turning a verified pathology document into a playable case.json in cases/ for the barehands anatomy-education fork — vignette rules, lesion render authoring, diagnosis accept/distractor lists, grading rubrics, the validate.py gate, the /case-render leak check, and the review-status gate before the examiner may run it. Load this before creating or editing anything in cases/. Executable procedure, not background reading.
version: 1.0
author: the barehands anatomy-education fork
---

# case-authoring

A case is a **graded exam question rendered in 3D**. The learner reads a
clinical stem, explores an organ with their hands, finds a lesion, and
commits to a diagnosis before anything is revealed. Your job is to build
that question so it is fair, factually consistent, and impossible to
answer by accident.

Follow the steps in order. Two of them are hard gates that either pass or
the case does not ship.

**Education only.** A case is a teaching artifact built from published
sources. It is never diagnostic guidance and never about a real person.
Do not use a real patient's history as a vignette.

---

## Step 0 — Start from a pathology doc, and check its status

Every case is downstream of a `pathology/<condition>.md` authored under
`skills/pathology-authoring/SKILL.md`. Open it. You need three things
from it: the **GROSS VISUAL SIGNATURE** section, the **structure-id
mapping** with its honest limits, and the **sources**.

Read its status line at the bottom.

- **verified** → you may author a case that a learner will actually be
  graded on.
- **draft** → you may author the case, validate it, and stage it for
  review, but it is **not playable**. Carry the draft status forward
  (step 8) and say so in the case's `sources`.

**Never invent pathology inside a case.** If the finding you want to
write is not in the pathology doc, it does not go in the case — go add it
to the pathology doc, with a citation, under the other skill. The case
file is an assembly step, not a research step.

## Step 1 — Pick the timepoint. Everything else follows from it.

For any disease with a gross timeline, **choose the timepoint first**,
before writing a single sentence, because it constrains the vignette, the
finding, the render, and the rubric simultaneously.

Pick a timepoint where there is **something to see**. The early window of
most acute processes is grossly invisible; staging a vivid lesion on a
"two hours of symptoms" vignette is a factual error the verifier will
reject. Pick the earliest band whose appearance is unambiguous and
teachable, and prefer a band whose appearance *dates itself* — a stage
with a distinctive color signature lets a strong learner read the clock
off the tissue, which is worth more than a stage that just looks
abnormal.

Write the chosen timepoint down. It is now a constraint on steps 2, 3,
and 5.

## Step 2 — The vignette

The clinical stem the learner reads. Rules, in priority order:

1. **NEVER name the diagnosis.** Not the disease, not its abbreviation,
   not a giveaway synonym. This is the whole point of the exercise and
   the reason `/case-render` strips `vignette` off the wire in the first
   place. Findings are fine — findings are data. "ST-segment elevation in
   V1 through V4" is data. "STEMI" is the answer. Never write the answer.
   The same ban covers the disease's mechanism words when they only
   appear as a label ("infarct", "necrosis", "occlusion") — describe what
   was measured and seen, and let the learner name it.
2. **Timing must match the rendered gross stage.** If the board shows a
   48-hour lesion, the story must put symptom onset about 48 hours ago,
   and every downstream detail must agree: the evolution of the tracings,
   whether the biomarker is still rising or has plateaued, whether a
   fever has had time to appear. A learner who notices the mismatch is
   right and your case is wrong.
3. **Give real numbers.** Demographics, risk factors, the symptom in the
   patient's own terms, a full vital-sign set, focused exam findings, and
   the one or two investigations that matter. Pull the normal ranges and
   typical values from the pathology doc's presentation section — that is
   what it is for.
4. **Explain how the specimen got on the board.** The learner is looking
   at a gross specimen. Say in one clause why — autopsy after an arrest,
   an explanted organ, a surgical specimen. Without it the scene is
   incoherent, and the sentence costs nothing.
5. **Plant the discriminators, don't hide them.** Every distractor you
   choose in step 5 should be *rejectable* from something in the vignette
   or the specimen. A case where the right answer is unreachable from the
   evidence is a coin flip, not an exam.

### Difficulty

`difficulty` is free text in `schemas/case.schema.md` (`"intro"`,
`"1"`, `"advanced"` — no enforced enum). Set it by **how classic the
presentation is**, not by how obscure the disease is:

- **Easiest** — the textbook presentation, textbook demographics,
  textbook investigations, one lesion, the timepoint's most distinctive
  gross stage.
- **Harder** — atypical presentation (the symptom the disease is famous
  for is absent; an at-risk group that presents differently), a timepoint
  whose appearance overlaps a neighboring stage, investigations that are
  equivocal, or a second incidental finding to sort from the real one.
- **Hardest** — atypical presentation *and* an appearance a plausible
  distractor could also produce, so the diagnosis rests on integrating
  the stem with the tissue rather than on either alone.

Never make a case harder by withholding information the learner would
obviously have. Difficulty comes from ambiguity, not from omission.

## Step 3 — Lesions

One entry per distinct pathological finding. Each needs `id`
(`^[a-z0-9_]{1,64}$`), `structure`, `finding`, `render`.

### `structure`

Must be a real key in the model's `media/models/<organ>/anatomy.json`.
`validate.py` rejects anything else. Put the lesion on the structure that
carries the **causative** finding when there is one — an occluded vessel
rather than the tissue it starved — and use `render.spread` to reach the
downstream structure.

### `finding` — answer-bearing, and it must say the honest limits

This is the gross description of what is actually there. `/case-render`
deliberately never returns it, so write it for the examiner and the
reviewer, not the learner. Include:

- the **gross appearance at your chosen timepoint**, in the pathology
  doc's own terms — color, texture, borders, firmness;
- **negatives that matter**: what is *not* yet present at this stage, and
  therefore what would be wrong to claim;
- **the model's honest limits**, copied forward from the pathology doc's
  mapping table. If the tinted mesh is an undivided branch structure, or
  if the real lesion is regional but the mesh is a whole chamber, the
  finding must say so. The examiner reads this to avoid teaching the
  learner something the model quietly implies but anatomy does not
  support.

### `render` — what tint can express today

The implemented kind is **`tint`**:

```json
"render": { "kind": "tint", "color": "#4d1414", "intensity": 0.85,
            "spread": ["left_ventricle"] }
```

- `color` — a hex color chosen from the pathology doc's gross
  description for **your timepoint**. Not a generic "disease red". A dark
  clotted-blood maroon for an occlusive thrombus; a yellow-tan for a
  necrotic core; a gray-white for a mature scar. If a reviewer cannot
  trace your hex back to a sentence in the pathology doc, it is wrong.
- `intensity` — how strongly the tint reads (schema-documented for
  `tint`; keep it high enough to be unmistakable on a busy board).
- `spread` — structure ids the tint carries into, for downstream
  consequences of a lesion whose origin is elsewhere.

`decal` and `variant` are in `schemas/case.schema.md` but **not
implemented by the renderer yet**. Do not author a case that depends on
them. When `variant` lands, it points at an alternate GLB and becomes the
right tool for **morphology-change diseases** — hypertrophy, dilation,
aneurysm, stenosis, rupture — everything tint cannot say because a color
cannot change a shape. Until then, those diseases can have a pathology
doc but not a convincing case. `variant_model` at the top level stays
`null` for the same reason.

Re-check `schemas/verbs.md` and the renderer before trusting this
paragraph; it dates faster than the rest of the file.

## Step 4 — `diagnosis.correct` and `diagnosis.accept`

**`correct`** is the full, precise answer key — disease, localization,
cause, and the age of the lesion if the timepoint is part of the answer.
It is the reference the rubric grades against, not something a learner is
expected to recite verbatim.

**`accept` is where fairness lives. Be generous.** A learner who knows
the answer must not be marked wrong for phrasing it their own way.
Include, deliberately:

- the **abbreviation and the expansion** ("anterior MI", "anterior
  myocardial infarction");
- **word-order and grammar variants** ("anterior wall MI", "MI of the
  anterior wall");
- **clinically equivalent synonyms** — including near-neighbor
  localizations that any examiner would accept as the same answer
  ("anteroseptal", "anteroapical");
- the **vessel-territory phrasing** as well as the anatomical one ("LAD
  territory infarct");
- the **causal phrasing** ("LAD occlusion with anterior wall
  infarction");
- **with and without the timepoint**, if dating is a bonus rather than a
  requirement.

Rule of thumb: if you would nod at it across a table in a viva, it
belongs in `accept`. Aim for a list in the high teens or twenties for a
common condition. Do **not** put a genuinely different diagnosis in
`accept` to be nice — generosity is about wording, never about substance.

## Step 5 — Distractors

Three to four, and they must be **plausible-but-wrong**, never absurd.
Draw them from the real differential a clinician would work through:

- **the same disease in the wrong territory** — the sharpest distractor
  there is, because it separates a learner who recognized the process
  from one who also localized it;
- **a genuine clinical mimic** — something that produces a similar stem
  or a similar tracing;
- **a competing cause of the same presenting complaint** — the "must not
  miss" alternative;
- optionally, **a mimic that the gross specimen alone rules out**, which
  rewards actually looking at the tissue.

Every distractor must be rejectable from evidence the learner has. Write
each one at the same level of specificity as `correct` — a distractor
that is conspicuously vaguer than the right answer is a free giveaway.
Never include a joke option or an obviously unrelated organ.

## Step 6 — `grading_rubric`

Free text, but write it as if someone else is grading with it. Cover four
bands explicitly:

- **FULL CREDIT** — exactly what the learner must both *name* and
  *localize*, plus which supporting observation they must cite. Name the
  acceptable observations; make citing the specimen (not only the stem)
  part of the standard.
- **PARTIAL CREDIT** — the specific near-misses: the process named
  without localization; the right answer reasoned only from the clinical
  stem while ignoring the tissue.
- **NO CREDIT** — distractor-level answers, wrong-category answers, and
  purely descriptive non-answers that report a color without committing
  to a diagnosis.
- **DEDUCTIONS** — claims that contradict the rendered stage. Dating a
  lesion to a window in which it would be grossly invisible is the
  classic one, and it is worth calling out by name.

Say what earns commendation too, if the case has a depth bonus (reading
the age off the tissue rather than off the vignette). It tells the
examiner what excellence looks like instead of only what failure does.

## Step 7 — `teaching`

The post-reveal walkthrough, shown only after the learner commits. This
is the payoff; write it as spoken explanation, not as notes.

Structure that works:

1. **Start at the cause and follow it downstream** — the vessel, then
   the tissue it supplied. Mechanism in order, with the clock.
2. **Read the clock in the tissue.** Say exactly which visual features
   date the lesion, and which features of a neighboring stage are absent.
   This is the transferable skill.
3. **Tie the vignette to the specimen**, detail by detail. Every clinical
   fact you planted in step 2 should get collected here — the timing, the
   plateaued biomarker, the low-grade fever, the exam findings. The
   learner should feel the stem and the tissue lock together.
4. **Say what is NOT there yet** and what would come next in time. The
   complications section of the pathology doc is written by timing for
   exactly this paragraph.
5. **Repeat the model's honest limits** in plain language at the end. The
   learner has been staring at a tinted mesh; tell them what the tint
   over-claims before they walk away with it.

Never introduce a fact here that is not in the pathology doc's sourced
sections.

## Step 8 — `sources` and `review`

`sources` carries the same citation discipline as the pathology doc:
chapter level, only what you are confident exists, never an invented
author or DOI. **Cite the pathology doc itself as the first entry, with
its review status**, then the underlying references it drew on.

`review` is copied from reality, never aspirationally:

```json
"review": { "status": "draft", "verified_by": null,
            "date": null, "artifact": null }
```

**You never set `status` to `"verified"`.** Not for your own case, not
for anyone's. Only the independent verifier does that, after leaving
their artifact in `review/`, and **you never write in or edit `review/`**
— see `skills/pathology-authoring/SKILL.md` §7 for why that separation is
load-bearing.

## Step 9 — GATE 1: the validator

Mandatory. Must exit 0:

```
python3 schemas/validate.py --case cases/<id>.json media/models/<organ>/anatomy.json
```

It checks the schema string, that `id` matches `^[a-z0-9-]{1,64}$`,
that every lesion id is snake_case, that **every lesion's `structure`
exists in that anatomy file**, that `render.kind` is one of
tint/decal/variant, that `review.status` is draft or verified, and that
`diagnosis.correct` is present. Also confirm by eye that the filename
matches the `id` — `cases/<id>.json` holds `"id": "<id>"`.

Do not hand over a case that has not been run through this.

## Step 10 — GATE 2: the leak check

Also mandatory, and it is the one people skip. With the server running,
fetch the learner-visible view and prove the answer is not in it:

```
curl -s "http://127.0.0.1:8794/case-render?id=<id>"
```

**Must contain:** `id`, `model`, `variant_model`, and each lesion's `id`,
`structure`, and `render` block.

**Must NOT contain** any trace of `vignette`, `difficulty`, `diagnosis`,
`grading_rubric`, `teaching`, `sources`, `review`, or any lesion's
`finding`. Grep the response for the disease name and for a distinctive
phrase from the vignette, not just for the field names — a case is only
private if the *content* is absent.

`server.py` builds that response by allowlist, so a leak means someone
widened the endpoint. That is a bug in the server, not in your case:
report it, do not work around it. And per `schemas/case.schema.md`, any
future route that needs the private fields for an already-answered case
must be a separate, explicitly-named endpoint — never a field added here.

## Step 11 — The review gate, before a learner ever sees it

A validated case is not yet a playable case.

- `review.status: "draft"` → the case may be staged for review and
  demonstrated to authors, but **the examiner must not run it as graded
  material**. Say the status out loud when you hand it over.
- `review.status: "verified"` → set only by the independent verifier,
  only with `verified_by`, `date`, and an `artifact` path filled in.
  Then it is playable.

A case is at most as trustworthy as its pathology doc. If the doc is
still draft, the case is draft regardless of how clean the validator run
was.

## The finished shape

Worked example, authored under exactly this procedure — read it before
writing your first one:

- case: `cases/heart-anterior-stemi-01.json`
- its pathology doc: `pathology/anterior-mi.md`
- the model it targets: `media/models/heart/anatomy.json`

Both gates pass on that case, and its review status is honest.
