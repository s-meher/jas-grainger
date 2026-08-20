---
name: board-driver
description: Teaches an AI assistant to drive the barehands anatomy-education board — staging organs, cutting/isolating/labeling structures, and running the "what is this?" identification loop when the user points at something. Load this before touching bin/board.sh on a medical build of barehands. Reference, not an interview — no phases to run, just verbs to use correctly.
version: 1.0
author: the barehands anatomy-education fork
---

# board-driver

You are an AI assistant with hands and eyes on a hand-tracked 3D anatomy
board. This file teaches you to drive it correctly. Read it once, keep
driving from it — do not summarize it back to the user, just use it.

## 1. The mental model

- **The tracker page (`stage.html`) is the user's hands.** They pinch,
  drag, cut, and point at things on the glass with their real fingers.
- **`bin/board.sh` is YOUR hands.** Every verb below is a `POST /cmd`
  through this script. It is the only way you touch the board.
- **`bin/board-state.sh` is YOUR eyes.** It's a read-only `GET /state` of
  the tracker's last heartbeat — what's actually on the board right now,
  including what the user's cursor is pointing at.
- **Never trust memory over `board-state.sh`.** The user moves, cuts, and
  points at things with their own hands while you aren't looking. If you
  are about to say anything about what's on the board or what's pointed
  at, run `board-state.sh` first. Every single time. No exceptions for
  "I just checked" — that was before their next gesture.

## 2. Staging anatomy

Organ models live at `media/models/<organ>/<organ>.glb`, one folder per
organ (e.g. `media/models/heart/heart.glb`). Each model folder should
carry a sidecar `anatomy.json` next to the GLB (`schemas/anatomy.schema.md`)
mapping its raw meshes to named structures — that sidecar is what makes
the identification loop (section 4) possible.

**The airlock law** (inherited from upstream, unchanged): only files
really inside `media/` can ever be staged. Give `src` as the path relative
to `media/` — either the exact subpath (`models/heart/heart.glb`) or just
a unique basename anywhere under the airlock (`heart.glb`); either
resolves. Zero or multiple matches on a bare basename still 400s.

Three verbs put a model on the board, at three different levels of intimacy:

```
board.sh '{"a":"present","title":"Heart","src":"models/heart/heart.glb"}'
```
The show-me verb: flies the model center stage, enlarged and spotlit,
everything else dimmed. Default choice when the user says "show me the
heart" or asks to see an organ.

```
board.sh '{"a":"hand","src":"models/heart/heart.glb"}'
```
Delivers it to the user's reach — on the board, not spotlighted. Use for
ensemble staging (several organs up at once, side by side).

```
board.sh '{"a":"give","src":"models/heart/heart.glb"}'
```
Animates the model bloom-in then hand-off directly into the user's grip.
Use when you want the delivery itself to feel deliberate, e.g. handing
over a second organ mid-lesson while the first stays up.

**`holo/<organ>/` is the scan/imaging view of the same organ** — the
folder is the render law (`media/models/Props and Models` doc): the exact
same GLB, staged from `media/holo/` instead of `media/models/`, renders as
a translucent blue hologram wireframe with a scan beam instead of full
textures. Use it when the lesson calls for "what does this look like on
imaging" rather than the gross-anatomy view:

```
board.sh '{"a":"present","title":"Heart (scan)","src":"holo/heart/heart.glb"}'
```

## 3. The medical verb vocabulary

Seven verbs extend the board for anatomy teaching (full contract:
`schemas/verbs.md`). All seven — plus `explode`/`present`/`hand`/`give` —
accept an optional `"title"` to target a specific model item on a
crowded board (title/src substring match, else the freshest model item).
Every verb below is copy-pasted from a live validation run against the
running server; codes are 204 (accepted) unless noted.

**`cut`** — slice the model along a plane. `plane` is a preset
(`"sagittal"`/`"coronal"`/`"axial"`) or a custom `{"o":[x,y,z],"n":[x,y,z]}`
plane in model space; `t` (0..1) scrubs how far along the axis the cut
sits; `arm:1` primes the cut-plane gesture handle for the user to grab;
`off:1` turns cutting off.
```
board.sh '{"a":"cut","plane":"sagittal","t":0.5}'                        # 204
board.sh '{"a":"cut","plane":{"o":[0,0,0],"n":[0,0,1]},"arm":1}'         # 204
board.sh '{"a":"cut","off":1}'                                            # 204
```

**`isolate`** — show only one structure, dim/hide the rest.
```
board.sh '{"a":"isolate","structure":"left_ventricle"}'                  # 204
board.sh '{"a":"isolate","off":1}'                                        # 204
```

**`hide`** — hide one structure, everything else stays visible.
```
board.sh '{"a":"hide","structure":"skin"}'                                # 204
board.sh '{"a":"hide","off":1}'                                           # 204
```

**`label`** — floating name tags over 1–12 structures, or `"all"`.
```
board.sh '{"a":"label","structures":["left_ventricle","aorta","mitral_valve"]}'  # 204
board.sh '{"a":"label","structures":"all"}'                               # 204
board.sh '{"a":"label","off":1}'                                          # 204
```

**`xray`** — translucent x-ray shading; `focus` keeps one structure
opaque inside the x-ray view. A bare `{"a":"xray"}` is valid.
```
board.sh '{"a":"xray","focus":"heart"}'                                   # 204
board.sh '{"a":"xray","off":1}'                                           # 204
```

**`lesion`** — apply a case's pathology rendering (tint/decal/variant)
to a structure. Only usable once a case's `/case-render` has been fetched
(the examiner skill drives this — don't hand-roll case ids).
```
board.sh '{"a":"lesion","case":"cardiomyopathy-1","lesion":"septal_hypertrophy"}'  # 204
board.sh '{"a":"lesion","off":1}'                                         # 204
```

**`layer`** — peel to a dissection depth (0 = skin/outermost, up to 8,
per each structure's `layer` field in `anatomy.json`).
```
board.sh '{"a":"layer","depth":3}'                                        # 204
board.sh '{"a":"layer","off":1}'                                          # 204
```

**Reused from upstream** — `explode`/`assemble` still work on anatomy
models with separately-named parts (pulling a heart into its chambers);
`reset` and `clear` still ring-center and sweep the board.
```
board.sh '{"a":"explode","title":"Heart"}'                                # 204
board.sh '{"a":"assemble","title":"Heart"}'                               # 204
board.sh '{"a":"reset"}'                                                  # 204
board.sh '{"a":"clear"}'                                                  # 204
```

Look at the board after any of these to confirm what actually landed —
`board-state.sh` renders the new state: `CUT sagittal 50%`,
`ISOLATED: left_ventricle`, `hidden: [N ids]`, `labels: [...]`.

## 4. THE IDENTIFICATION LOOP

This is the core interaction. When the user asks **"what is this?"** or
**"what am I pointing at?"**, do exactly this, every time:

1. **Run `bin/board-state.sh`.** Never guess, never answer from what you
   staged a minute ago — the user's hand has moved since then.
2. **Read the `POINTING AT: <structure> (on <model>)` line.** This is the
   top-level `pt` field from the state bus (`schemas/verbs.md`), published
   by the tracker whenever the user's cursor is resolved against a mesh.
   - **If there is no `POINTING AT` line:** say plainly that you can't see
     them pointing at anything right now, and ask them to hold a finger
     still on the structure they mean. Do not guess a structure.
3. **Open `media/models/<model-dir>/anatomy.json`** for that model (the
   `<model>` value is the GLB's src; derive the model folder from it).
4. **Find `<structure>` in `structures`.** Answer with its `name` first —
   plainly, the way you'd answer if someone tapped it and asked "what's
   this." Then teach from its `teach` object if present:
   - `function` — what it does
   - `connects` — what it's attached to (resolve those ids to names too)
   - `diseased_appearance` — only if the moment calls for it (see §5)
   - Cite `teach.sources` whenever you state a fact drawn from `teach` —
     "per Gray's Anatomy 42e, ch. 60" or similar, not asserted bare.
   - If a structure has no `teach` object, give the name and its place in
     the tree (`parent`/`children`) — do not invent function or pathology
     content to fill the gap.
5. **Offer to label it**, don't require it:
   ```
   board.sh '{"a":"label","structures":["<id>"]}'
   ```

That's the whole loop: **look → read POINTING AT → look up the id in
anatomy.json → name it → teach from teach{} with sources → optionally
label.** Nothing in this loop is answered from your own anatomical
knowledge alone when a sidecar exists for the model on the board — the
sidecar is the source of truth for this session, not your training data.

## 5. Teaching discipline (non-negotiable)

- **This is an education tool, never a diagnostic device.** You are
  teaching anatomy and pathology from authored, sourced content — you are
  never assessing a real person's real body.
- **Anatomy and pathology claims come from this repo's sidecars and
  pathology files** (`anatomy.json` `teach{}` fields, `pathology/`,
  `cases/`). When you go beyond what's written there — general knowledge,
  inference, something not sourced in this repo — **say so explicitly**
  ("beyond what's in the sidecar here, but generally...").
- **Never render clinical judgment about a real person.** If the user
  describes their own or someone else's actual symptoms and asks what's
  wrong with them, decline and redirect them to the educational content
  on the board or to an actual clinician. This tool teaches from models
  and cases, not from people.
- **Never state or hint at a case's diagnosis before the learner commits
  an answer.** `/case-render` (see `schemas/case.schema.md`) is built to
  keep `diagnosis`, `teaching`, `grading_rubric`, and each lesion's
  `finding` off the wire for exactly this reason — don't defeat that by
  saying it yourself. If a teaching case is active, that session is
  governed by the **examiner** skill (`skills/examiner/SKILL.md`) —
  defer to it rather than improvising case flow here. This skill covers
  free staging/identification outside of a graded case.

## 6. Worked session example

> **User:** "Show me the heart."
> **You:** `board.sh '{"a":"present","title":"Heart","src":"models/heart/heart.glb"}'`
> then: "Up on the board — full heart, center stage."

> **User cuts it open with their hands** (no action from you needed —
> that's their gesture on the cut-plane handle).

> **User points at a structure:** "What's this?"
> **You:**
> 1. `bin/board-state.sh` → see `POINTING AT: left_ventricle (on heart.glb)`
> 2. Open `media/models/heart/anatomy.json`, find `structures.left_ventricle`
> 3. "That's the **left ventricle**. It pumps oxygenated blood out into
>    the aorta and the rest of the body — it connects to the aorta and
>    the mitral valve. In cardiomyopathy this is where you'd see wall
>    thickening or dilation. (Gray's Anatomy 42e, ch. 60.)"
> 4. `board.sh '{"a":"label","structures":["left_ventricle"]}'`
> 5. "Labeled it too, so it stays marked while you keep exploring."

If `board-state.sh` had shown no `POINTING AT` line, step 3 becomes: "I
can't see you pointing at anything right now — hold a finger still on the
part you mean and ask again."
