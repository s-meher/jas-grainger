---
name: pathology-authoring
description: Procedure for authoring a new pathology teaching document in pathology/ for the barehands anatomy-education fork — establish the gross visual signature from cited sources first, map it to the target model's real structure ids, write with citations, mark it draft, and hand it to an independent verifier. Load this before creating or editing anything in pathology/. Executable procedure, not background reading.
version: 1.0
author: the barehands anatomy-education fork
---

# pathology-authoring

You are about to write a pathology document — the source-of-truth file a
3D board will render a disease from and an AI will teach from. Follow the
steps in order. Do not skip step 2; it is the step that decides whether
this pathology can exist on this board at all.

**A pathology doc is not an article.** It is a rendering spec with a
citation trail. Everything in it either drives what the board shows, or
tells the learner why what they are looking at means something.

## The boundary, stated once

This is **education and training content only**. It is not a medical
device, not diagnostic guidance, and never a statement about a real
person's body. You are describing what a disease looks like in a
specimen, for a learner, from published sources. If anyone asks you to
turn this content toward a real patient's real symptoms, that is out of
scope — say so and point at a clinician.

And the hard rule that makes the whole fork trustworthy: **pathology
content is authored from cited sources and human-reviewable, never
invented at runtime.** If you cannot cite it, it does not go in the file.

---

## Step 1 — Pick the condition, and know why

Pick one condition with one clear teaching point. Write the point down
for yourself in a sentence before you write anything else ("an infarct
does not look like one thing, it looks like a *time*"). A pathology doc
without a teaching point produces a case with no answer worth grading.

Prefer, for a first pass on a new organ:

- diseases whose signature is a **color/texture change** (infarct,
  necrosis, hemorrhage, congestion, pigment deposition) — the renderer
  can show these today;
- diseases with a **well-documented gross timeline** — the timeline is
  free difficulty levels later;
- diseases whose affected structures **actually exist as meshes** in the
  target model (step 3 will tell you; do step 3 before you commit).

Defer diseases whose whole signature is a **shape change** — hypertrophy,
dilation, aneurysm, stenosis, rupture. Those need a `variant` GLB, which
the renderer does not implement yet. You can still author the doc; just
know its case cannot be staged convincingly until variant lands.

## Step 2 — Establish the GROSS VISUAL SIGNATURE first. From sources.

**This is the gate. If you cannot source what it looks like, you cannot
author it.** Stop and pick a different condition.

Before writing a word of pathophysiology, answer, with a citation
attached to each answer:

1. **What would you actually SEE on a gross specimen?** Color, texture,
   borders, firmness, whether the surface is raised, flat, or depressed.
   Naked-eye findings, not histology — the board renders a specimen, not
   a slide.
2. **Does it change over time?** If yes, build the full interval table:
   every time band, and the appearance in each. Cite the table.
3. **When is there NOTHING to see?** Every acute process has a window
   where the tissue looks normal. Write that window down explicitly. It
   is the single most common way a case becomes factually wrong — a vivid
   lesion staged on a one-hour vignette.
4. **What does the *causative* lesion look like**, separately from the
   downstream damage? An occluded vessel and the muscle it starved are
   two different visual findings on two different structures.

Then write it as its own top-level section, titled so nobody can miss it
(`## GROSS VISUAL SIGNATURE — what you would actually see`), with the
timeline as a table. The case author reads this section and nothing else
to choose a tint color and a timepoint. Write it for that reader.

**Sourcing this section, specifically.** Gross morphology tables are the
easiest thing to half-remember and the most damaging thing to get wrong,
because they are what the learner's eyes are graded against. Cite the
standard reference for the organ system at chapter level. If you are
reproducing a table you did not read from the primary text, **say so in
the uncertainty notes** (step 6) — do not launder a recollection into a
citation.

## Step 3 — Map it to real structure ids

Open the target model's sidecar: `media/models/<organ>/anatomy.json`.
Those `structures` keys are the **complete** vocabulary available to you.
A case may reference nothing else, and `schemas/validate.py` enforces it.

Build a mapping table in the doc with a column for honest limits:

| What the pathology involves | Structure id | Honest limits |
|---|---|---|

Three things go in that third column, and none of them are optional:

- **Undivided meshes.** If the model represents a branching structure as
  one mesh, say what the highlight actually covers. Example from
  `media/models/heart/anatomy.json`: the LAD has no mesh of its own — the
  `left_coronary_artery` structure is left main plus LAD plus circumflex
  in one piece, and `LAD` is only an alias onto it. Tinting it marks the
  whole tree. The doc must say that out loud so the learner is never left
  believing the highlighted vessel is anatomically the LAD.
- **No regional sub-structure.** If the real lesion is regional (an
  anterior wall, one lobe, one segment) and the model's chamber or organ
  is a single mesh, the tint colors the whole thing. Say so, and say
  what the real distribution is in words.
- **Structures that simply do not exist** in this model. List them as
  *(no id)*. Do not silently substitute a neighbor.

If the mapping table comes out empty — nothing this disease touches
exists in the model — the pathology is not authorable against that model.
Note it and stop. That is a legitimate outcome, not a failure.

## Step 4 — Note what the renderer can express today

State plainly, in the doc, which of the disease's findings the board can
currently show. As of now the implemented render kind is **`tint`** — a
color on a structure, with an optional `spread` to neighboring
structures. `decal` and `variant` are declared in
`schemas/case.schema.md` but **not implemented**, so no texture overlay
and no morphology change. Check `schemas/verbs.md` and the current
renderer before you assert otherwise; this line dates fast.

This section is what stops a case author from writing a render block the
board cannot honor.

## Step 5 — Write the rest, with citations

The remaining sections, in this order:

1. **What it is** — definition and territory/distribution, one paragraph.
2. **Pathophysiology** — the causal chain as a numbered sequence with the
   clock attached to each step. Mechanism, not vocabulary.
3. *(GROSS VISUAL SIGNATURE — already written, step 2)*
4. *(Mapping to the model — already written, step 3)*
5. **Typical presentation** — symptoms, vitals, the standard
   investigations and what they show. This is the raw material a case
   vignette will be built from, so give the case author real numbers.
6. **Complications** — grouped by *when*, not by organ system. Timing is
   almost always the teaching point, and it links back to the timeline in
   step 2.
7. **Sources** — numbered, referenced inline as `[1]`, `[2]`.

### Citation discipline

- **Every factual section carries a citation.** Not every sentence — but
  no section, and no table, stands uncited.
- **Chapter level, not page level.** "Robbins & Cotran Pathologic Basis
  of Disease, 10th ed., ch. 12 (The Heart)" is right. A page number you
  did not read is a fabrication with a decimal point in it.
- **Cite only what you are confident exists.** A real chapter in a real
  edition, or a peer-visible page anyone can open (StatPearls on NCBI
  Bookshelf, a journal article with a real DOI/PMID). Never invent an
  author, a year, a title, or a DOI to make a reference look complete.
- **Prefer sources the reviewer can actually open.** A URL beats a
  paywalled page number for verifiability, which is the entire point of
  the citation.
- **Distinguish what you read from what you recall.** Anything you did
  not open during authoring goes in the uncertainty notes, flagged.
- **Match style to `anatomy.json`'s `teach.sources`** so the board's AI
  can quote either interchangeably.

### Style

Match the repo: terse, dense, explains *why*. No hedging filler, no
textbook throat-clearing. Tables where the data is tabular. Bold the
thing the reader must not miss. Write for someone who will read this once
and then teach from it out loud.

## Step 6 — Write your uncertainty notes, addressed to the Verifier

Last section before the review line. Title it so the reviewer reads it
first if they read nothing else.

List, explicitly:

- every number, interval, or percentage reproduced from memory rather
  than from the source in front of you;
- every citation whose chapter number or edition you inferred from
  secondary sources;
- anything you are reasonably but not fully confident of;
- and — usefully — which sections you *did* read directly, so the
  reviewer knows where they can go faster.

**Understating uncertainty here is the worst thing you can do in this
role.** A flagged claim gets checked in thirty seconds. An unflagged
wrong one becomes something a learner memorizes.

## Step 7 — Mark it draft. Then stop.

End the file with exactly this line:

```
**review status: draft — pending independent verification**
```

Then **stop.** You are done. The next steps are not yours:

- **You never verify your own work.** The author of a pathology doc
  cannot be its reviewer. That separation is the only thing standing
  between "an AI wrote some medical claims" and "a human checked them."
- **You never write in or edit `review/`.** That folder belongs to the
  independent verifier. Not a note, not a stub, not a "pre-filled for
  convenience" file. Touching it destroys the evidence that the review
  was independent.
- **You never flip a status to `verified`** — not in a pathology doc, not
  in a case's `review.status`. Only the verifier does that, and only
  after leaving their artifact in `review/`.
- **Draft content is not playable.** A case whose pathology is still
  draft may be authored and validated, but must not be put in front of a
  learner as graded material until the verifier signs it off. The
  examiner enforces this at run time; you enforce it by never pretending
  the status is further along than it is.

## The finished shape

A pathology doc that passed this procedure has, in order: the
education-only boundary, what it is, pathophysiology, **GROSS VISUAL
SIGNATURE with a timeline table**, the structure-id mapping with honest
limits, what the renderer can express, presentation, complications by
timing, numbered sources, uncertainty notes for the verifier, and the
draft status line.

Worked example, authored under exactly this procedure:
`pathology/anterior-mi.md`. Read it before writing your first one.

**Next:** once (and only once) a pathology doc is verified, turn it into
a playable case with `skills/case-authoring/SKILL.md`.
