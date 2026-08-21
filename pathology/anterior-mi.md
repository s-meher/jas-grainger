# Acute anterior myocardial infarction (LAD territory)

**Education only.** This file is teaching content for a 3D anatomy board.
It is not a diagnostic aid, not clinical guidance, and never a statement
about a real person's body. Nothing below is asserted from an author's
memory: every factual section carries a citation, and the file is a
**draft until an independent reviewer verifies it** (see the review status
line at the bottom).

---

## 1. What it is

Myocardial infarction is death of cardiac muscle caused by ischemia —
blood supply cut off long enough that the myocytes cannot recover.
"Anterior" MI names the *territory*: the anterior wall of the left
ventricle, the anterior two-thirds of the interventricular septum, and
the cardiac apex, all supplied by the **left anterior descending (LAD)**
branch of the left coronary artery. Occlusion of the LAD is what produces
it. [1][2]

The three coronary vessels are not equally guilty. In the classic
distribution of culprit lesions, the LAD is the single most common —
roughly 40–50% of infarcts — followed by the right coronary artery
(~30–40%) and the left circumflex (~15–20%). [4] Anterior MI is therefore the
most common infarct territory *and* the one with the largest average
infarct size and the poorest prognosis, because the LAD feeds more
myocardium than either of the others. [1]

## 2. Pathophysiology: occlusion → ischemia → necrosis

The sequence, in order, and the clock that goes with it:

1. **Plaque disruption.** In the great majority of acute MIs the
   initiating event is rupture, fissuring, or erosion of an
   atherosclerotic plaque in an epicardial coronary artery, exposing
   thrombogenic subendothelial material. [1]
2. **Thrombosis.** Platelets adhere, aggregate, and activate; the
   coagulation cascade is triggered; a thrombus grows over the disrupted
   plaque and, within minutes, can occlude the lumen completely.
   Vasospasm and distal microembolization of thrombus fragments make it
   worse. [1]
3. **Ischemia.** Aerobic metabolism in the downstream myocardium stops
   within seconds. ATP falls, anaerobic glycolysis takes over, lactate
   accumulates. **Contractility is lost within about a minute** — long
   before any cell dies. This is the reversible window, and it is why
   reperfusion is a race. [1]
4. **Irreversible injury.** With severe, sustained ischemia, myocyte
   death begins at roughly **20–40 minutes**. Microvascular injury
   follows somewhat later. [1]
5. **The wavefront.** Necrosis does not appear everywhere at once. It
   begins in the **subendocardium** — the layer furthest from the
   epicardial vessel and under the highest wall stress — and advances
   outward toward the epicardium as a wavefront. If the occlusion is not
   relieved, the infarct becomes transmural. In experimental models the
   full-thickness infarct is largely complete within about 6 hours;
   in humans, collateral circulation can slow the wavefront and extend
   that window considerably, which is precisely what makes late
   reperfusion still worth attempting. [1]

The infarct that results is a **coagulative necrosis** — the dead
myocytes keep their outlines for days while the cytoplasm changes — and it
is then cleared and replaced through a stereotyped inflammatory and
reparative sequence (neutrophils, then macrophages, then granulation
tissue, then collagen). That sequence is what drives the gross appearance
in section 3. [1]

## 3. GROSS VISUAL SIGNATURE — what you would actually see

**This is the section the 3D rendering is authored from.** An infarct
does not look like one thing; it looks like a *time*. Anyone staging this
pathology on the board must pick a timepoint and render that timepoint's
appearance, and any case vignette built on it must be clinically
consistent with the hours chosen.

The intervals below follow the standard evolution-of-morphologic-changes
table in Robbins & Cotran. [1]

| Time since onset | Gross appearance of the infarcted myocardium |
|---|---|
| **0–4 hours** | **No gross change.** The muscle looks normal to the naked eye. Necrosis is already underway but is invisible without a viability stain (see below). |
| **4–12 hours** | Occasionally dark mottling begins — patchy, dusky red-blue discoloration from stagnant trapped blood. Often still nothing convincing. |
| **12–24 hours** | **Dark mottling** is established: a blotchy, dusky, red-brown-to-purple region, sometimes with early central pallor. |
| **1–3 days** | Mottling **with a yellow-tan center**. The necrotic core is beginning to lose color as neutrophils flood in; the surrounding rim is still congested and dark. |
| **3–7 days** | A **hyperemic (bright red) border** around a **softening yellow-tan center**. The infarct is at its most structurally fragile here — this is the mechanical-rupture window. |
| **7–10 days** | Maximally **yellow-tan and soft**, with depressed **red-tan margins** as the surface sinks. |
| **10–14 days** | **Red-gray, depressed** infarct borders (granulation tissue) with a persisting yellowish center. |
| **2–8 weeks** | **Gray-white scar**, advancing from the periphery inward as collagen replaces granulation tissue. |
| **> 2 months** | Scarring complete: a **firm, pale gray-white, contracted fibrous scar**, with the wall usually **thinned** where transmural muscle was lost. |

Two practical notes for anyone rendering this:

- **Under ~12 hours there is genuinely nothing to see.** A case that
  stages a visible lesion must be at least ~12 hours post-onset, and to
  show anything convincingly yellow-centered, at least 24 hours. Staging a
  vivid lesion on a "one hour of chest pain" vignette is a factual error,
  not an artistic choice. The classic laboratory workaround is
  **triphenyltetrazolium chloride (TTC)**, which stains viable myocardium
  brick-red and leaves the infarct pale — it reveals necrosis grossly
  hours before unaided inspection can. [1]
- **The occluded vessel itself is part of the picture.** Opened
  longitudinally, the culprit LAD segment shows a **dark red-brown
  occlusive thrombus** sitting on a disrupted, often calcified,
  atherosclerotic plaque. That vessel-level finding is what the board's
  coronary-artery tint represents; the ventricular discoloration is the
  downstream consequence. [1]

## 4. Mapping to this repo's heart model

Structure ids below are from `media/models/heart/anatomy.json` (16
structures). **Only ids that exist there may be referenced by a case.**

| What the pathology involves | Structure id used | Honest limits |
|---|---|---|
| The occluded vessel (LAD) | `left_coronary_artery` | **The model has no separate LAD mesh.** Its left coronary artery is a single undivided mesh that encompasses the left main, the LAD, and the circumflex — the sidecar says so explicitly, and `LAD` is an alias pointing at this same id. Tinting it therefore marks *the whole left coronary tree*, not the LAD alone. Any teaching text must say this out loud rather than letting the learner believe the highlighted vessel is anatomically the LAD. |
| The infarcted myocardium | `left_ventricle` | The model's left ventricle is one mesh. It cannot express a *regional* anterior-wall infarct — there is no anterior-wall sub-structure, no apex, and no separate interventricular septum in this model. A tint marks the whole chamber, so the case must state in words that the real infarct is regional (anterior wall, anterior septum, apex) even though the render colors the whole LV. |
| The anterior interventricular septum | *(no id)* | Not represented. The septum is not a structure in this model. |
| The cardiac apex | *(no id)* | Not represented as its own structure. |

The renderer today can express `render.kind: "tint"` (a color applied to a
structure, with an optional spread to neighboring structures). `"decal"`
and `"variant"` are declared in the schema but not implemented, so a
morphology *change* — wall thinning, aneurysmal bulge, a rupture defect —
cannot be shown yet. Anterior MI is a good first pathology precisely
because its early-to-mid gross signature is a **color change**, which is
exactly what tint can carry.

## 5. Typical presentation

Classic anterior STEMI: **constricting, squeezing, or heavy chest
discomfort lasting more than about 30 minutes**, often radiating to the
left arm, shoulder, or jaw, with dyspnea, diaphoresis, nausea, and
palpitations. Vital signs may show tachycardia and tachypnea; blood
pressure is often normal or elevated early, and a systolic pressure below
90 mmHg raises the question of cardiogenic shock. Signs of pulmonary
congestion (crackles, an S3, elevated JVP) indicate left ventricular
failure. [2]

**ECG.** Anterior injury shows ST-segment elevation in the precordial
leads, with the pattern tracking how proximal the occlusion is:
approximately **V1–V2** for a septal pattern, **V2–V5** for an anterior
pattern, and **V1–V6 with I and aVL** for an extensive anterior infarct
from a proximal LAD lesion. More leads with ST elevation means more
myocardium at risk and higher mortality. [2][3]

**Biomarkers.** Cardiac troponin rises and stays elevated for days, which
is why a *late-presenting* patient — someone who sat on their chest pain
for a day or two — still has a strikingly abnormal troponin at the time
they finally arrive. That late presenter is the patient whose heart shows
the 1–3 day gross appearance in section 3. (The multi-day persistence of
troponin is general cardiology background, not a claim from [2]; it is
stated here without a specific citation rather than mis-attributed.)

Atypical presentations (dyspnea alone, epigastric pain, syncope, or
silent infarction) are well described, particularly in older adults,
people with diabetes, and women — a fact that matters when authoring case
difficulty. [2]

## 6. Complications

Grouped roughly by when they appear, because the timing is the teaching
point — the mechanical complications cluster in the days when the
necrotic tissue is softest and the gross specimen is yellow.

**Immediate (minutes–hours)**
- **Arrhythmias** — ventricular fibrillation and ventricular tachycardia
  are the leading cause of sudden death before reaching hospital. [1][2]
- **Conduction abnormalities.** An anterior infarct that takes out the
  septal perforators can produce bundle branch block or high-grade
  infranodal AV block — an ominous sign, reflecting a large infarct. [2]

**Early (hours–days)**
- **Contractile dysfunction and heart failure**, up to **cardiogenic
  shock** when a large fraction of the left ventricle is lost. Anterior
  infarcts, being the largest on average, carry the highest risk. [1][2]
- **Fibrinous pericarditis**, typically a couple of days in, over a
  transmural infarct. [1]
- **Infarct extension** (new necrosis adjacent to the original) and
  **infarct expansion** (stretching and thinning of the necrotic wall). [1]

**Mechanical, peaking in the soft-yellow window (roughly days 3–7)**
- **Free wall rupture** → hemopericardium and tamponade. [1][2]
- **Ventricular septal rupture** → a new left-to-right shunt; the
  anterior/apical septum is the site associated with LAD infarcts. [1][2]
- **Papillary muscle rupture** → acute severe mitral regurgitation. Worth
  flagging honestly as a *territory* distinction: the posteromedial
  papillary muscle, which has a single blood supply, is the classic
  ruptured one and is more often an inferior (RCA) complication than an
  anterior one. [1]

**Later (days–weeks–months)**
- **Left ventricular mural thrombus**, characteristically at the
  akinetic apex after an anterior infarct, with a risk of systemic
  embolization (stroke). [1][2]
- **Ventricular aneurysm** — a late, thinned, scarred, bulging wall,
  again typically apical after anterior MI; a substrate for thrombus and
  arrhythmia. [1][2]
- **Progressive late heart failure** from adverse remodeling of the
  scarred ventricle. [1]
- **Dressler syndrome**, a delayed immune-mediated pericarditis. [1]

## 7. Sources

1. Kumar V, Abbas AK, Aster JC. *Robbins & Cotran Pathologic Basis of
   Disease*, 10th ed. Elsevier, 2021 — **Chapter 12, "The Heart"**;
   sections on Ischemic Heart Disease and Myocardial Infarction,
   including the chapter's table of the evolution of morphologic changes
   in myocardial infarction (the basis of section 3's table) and the
   consequences/complications of infarction (section 6).
2. Bansal K, Gore M, Afzal M, Shams P, Nalabothu P. *Anterior Myocardial
   Infarction*. StatPearls [Internet]. Treasure Island (FL): StatPearls
   Publishing; last updated 12 February 2024.
   https://www.ncbi.nlm.nih.gov/books/NBK562234/ — LAD territory,
   presentation, vital signs, ECG patterns by occlusion site, and the
   complication list.
3. Engelen DJ, Gorgels AP, Cheriex EC, et al. Value of the
   electrocardiogram in localizing the occlusion site in the left
   anterior descending coronary artery in acute anterior myocardial
   infarction. *J Am Coll Cardiol*. 1999;34(2):389–395 — proximal vs.
   distal LAD occlusion and the corresponding precordial lead patterns.
4. Ludhwani D, Chhabra L, Goyal A, Quintanilla Rodriguez BS, Gupta N.
   *Lateral Wall Myocardial Infarction*. StatPearls [Internet]. Treasure
   Island (FL): StatPearls Publishing; last updated 29 October 2024.
   https://www.ncbi.nlm.nih.gov/books/NBK537228/ — the culprit-vessel
   frequency distribution, stated there verbatim: "The LCx is involved in
   approximately 15% to 20% of all myocardial infarctions. The LAD is
   involved more frequently, in around 40% to 50% of myocardial
   infarctions, while the right coronary artery is responsible for 30% to
   40%." (The chapter's own subject is the lateral wall; it is cited here
   only for this epidemiological distribution, which it gives for
   infarcts as a whole. Title and authors confirmed against the page.)

## 8. Author's uncertainty notes (read these, Verifier)

Flagged honestly so the reviewer knows where to look hardest:

- **The section 3 table** is reproduced from the standard Robbins
  evolution-of-morphology table as it appears in widely circulated
  reproductions of that table; the author did **not** have the 10th
  edition in hand to transcribe the exact wording or confirm the table
  number. The interval boundaries and the color descriptions should be
  checked against the printed table, and the citation upgraded from
  chapter-level to table-level once confirmed.
- ~~**The culprit-vessel frequencies**~~ — RESOLVED by independent
  review (`review/heart-anterior-stemi-01.md`): the ranges are exact and
  appear verbatim in StatPearls NBK537228, now cited as [4].
- ~~**"Myocyte death begins at 20–40 minutes"** / **"transmural infarct
  largely complete within ~6 hours"**~~ — RESOLVED by independent review
  against primary literature (Reimer & Jennings, *Circulation*
  1977;56:786: 38% transmural necrosis at 40 min → 71% at 6 h → 85% at
  24 h, canine), which also confirms the collateral-flow caveat.
- ~~**Chapter number 12 for "The Heart"**~~ — confirmed by independent
  review from secondary sources; still not read from a printed table of
  contents, but no longer blocking.
- **The section 3 morphology table remains the one open item**: every
  interval and color descriptor was confirmed row-for-row against four
  independent pathology references during review, but not against the
  printed Robbins 10th ed. table itself.
- Everything in **section 5** and the complication list in **section 6**
  that is tagged [2] was read directly from the StatPearls page during
  authoring and is the most solidly grounded material in the file.

---

**review status: draft — pending independent verification**
