# case.json — a teaching case

One file per case, at `cases/<id>.json`, where `<id>` matches the case id
regex `^[a-z0-9-]{1,64}$` **and** the filename (`cases/cardiomyopathy-1.json`
has `"id": "cardiomyopathy-1"`).

```json
{
  "schema": "barehands-case/1",
  "id": "cardiomyopathy-1",
  "model": "heart/heart.glb",
  "variant_model": "heart/heart-hypertrophic.glb",
  "difficulty": "intro",
  "vignette": "A 54-year-old presents with exertional dyspnea. Echo shows asymmetric septal thickening...",
  "lesions": [
    {
      "id": "septal_hypertrophy",
      "structure": "interventricular_septum",
      "finding": "asymmetric septal wall thickening > 15mm",
      "render": { "kind": "tint", "color": "#b23b3b", "intensity": 0.7 }
    }
  ],
  "diagnosis": {
    "correct": "Hypertrophic cardiomyopathy",
    "accept": ["HCM", "hypertrophic cardiomyopathy"],
    "distractors": ["Dilated cardiomyopathy", "Constrictive pericarditis"]
  },
  "grading_rubric": "Full credit: names HCM and cites septal thickening. Partial: names a cardiomyopathy without the specific finding.",
  "teaching": "HCM is the leading cause of sudden cardiac death in young athletes...",
  "sources": ["Braunwald's Heart Disease, 12e, ch. 78"],
  "review": {
    "status": "verified",
    "verified_by": "Dr. J. Smith, MD",
    "date": "2026-07-01",
    "artifact": "review-notes/cardiomyopathy-1.md"
  }
}
```

## Field reference

| field | type | required | notes |
|---|---|---|---|
| `schema` | string | yes | must be exactly `"barehands-case/1"` |
| `id` | string | yes | matches `^[a-z0-9-]{1,64}$` and the filename |
| `model` | string | yes | airlock-relative path to the base GLB (e.g. `"models/heart/heart.glb"`) — usable directly as a stage `src` |
| `variant_model` | string or `null` | no | an alternate GLB showing the lesion's gross appearance, if one exists |
| `difficulty` | string | yes | e.g. `"intro"`, `"intermediate"`, `"advanced"` — free text, no enforced enum |
| `vignette` | string | yes | the clinical stem the learner reads |
| `lesions` | array of object | yes (may be `[]`) | see below |
| `diagnosis` | object | yes | `{correct, accept[], distractors[]}` — `correct` is the answer key, `accept` is a list of acceptable phrasings, `distractors` are plausible wrong answers for a multiple-choice presentation |
| `grading_rubric` | string | yes | free text scoring guidance |
| `teaching` | string | yes | the explanation shown after grading |
| `sources` | array of string | yes (may be `[]`) | citations |
| `review` | object | yes | `{status, verified_by, date, artifact}` — `status` is `"draft"` or `"verified"` |

### A `lesions[]` entry

| field | type | required | notes |
|---|---|---|---|
| `id` | string | yes | matches `^[a-z0-9_]{1,64}$` |
| `structure` | string | yes | a structure id that must exist in the model's `anatomy.json` |
| `finding` | string | yes | the clinical/pathological finding text — **answer-bearing** |
| `render` | object | yes | `{"kind": "tint"\|"decal"\|"variant", ...kind-specific fields}` — how the client visually marks this lesion. `tint`: `{color, intensity, spread?}` — `spread` is an optional list of additional structure ids the tint bleeds onto (e.g. the infarcted wall downstream of an occluded artery). `decal`: `{texture, uv?}`. `variant`: `{model}` (points at a mesh/sub-model swap) |

## What `/case-render` exposes vs. keeps private

`GET /case-render?id=<id>` (implemented in `server.py`) is the
**learner-visible** view — it feeds the page the student looks at before
they've answered. It returns **only**:

```json
{ "id": ..., "model": ..., "variant_model": ...,
  "lesions": [ { "id": ..., "structure": ..., "render": ... }, ... ] }
```

Every other field — `vignette`, `difficulty`, `diagnosis`,
`grading_rubric`, `teaching`, `sources`, `review`, and each lesion's
`finding` — is deliberately **never** returned by that endpoint. Any
future endpoint that needs the vignette/diagnosis/teaching content for an
already-answered case must be a separate, explicitly-named route — never
add those fields to `/case-render`.
