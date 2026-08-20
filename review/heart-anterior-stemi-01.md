# Independent verification — `pathology/anterior-mi.md` + `cases/heart-anterior-stemi-01.json`

## Reviewer statement

I am the independent verifier for this content. I did not author
`pathology/anterior-mi.md`, `cases/heart-anterior-stemi-01.json`, or
`media/models/heart/anatomy.json`, and I reviewed all three adversarially — the
working assumption throughout was that a claim is wrong until a source says
otherwise. Every substantive medical assertion below was checked against at
least one source retrieved during this review, and the items the author flagged
in section 8 ("Author's uncertainty notes") were checked against two or more
independent sources each.

**Date of review:** 2026-08-20
**Scope:** factual/medical accuracy and case-internal consistency. Not a
clinical endorsement — this is education-only content and was judged as such.
**Access limitation, stated up front:** I could not obtain the printed text of
*Robbins & Cotran Pathologic Basis of Disease*, 10th ed. Every Robbins-attributed
claim was therefore verified against **independent** sources (StatPearls,
university pathology teaching collections, peer-reviewed primary literature and
guideline documents), not against the textbook itself. Where a claim is
corroborated by independent sources but the exact Robbins wording is
unconfirmed, I say so in the verdict column rather than treating the textbook
attribution as verified.

I made no edits to any file outside `review/`.

---

## Claim-by-claim verification

### A. Gross-morphology timeline (pathology doc §3) — highest stakes

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| A1 | 0–4 h: no gross change; muscle looks normal to the naked eye | **CONFIRMED** | "0–30 minutes: No visible changes / 30 minutes–4 hours: No visible changes" — [ilovepathology, MI gross & microscopy](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/). "0–12 hours: minimal gross pathologic findings" — [UPMC Pathology case 158](https://path.upmc.edu/cases/case158/dx.html). |
| A2 | 4–12 h: occasional dark mottling begins; often nothing convincing | **CONFIRMED** | "4–12 hours: Occasional mottling (red discoloration due to hemorrhage)" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/). "Gross changes are not apparent until 4 hrs" — [Histopathology.guru](https://www.histopathology.guru/morphological-changes-in-myocardial-infarction/). |
| A3 | Mottling is dusky red-blue from stagnant trapped blood | **CONFIRMED** | Attributed to hemorrhage/trapped stagnant blood in the same interval — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "Pallor with some hyperemia" at 24–72 h — [WebPath, Univ. of Utah](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html). |
| A4 | 12–24 h: dark mottling established | **CONFIRMED** | "12–24 hours: Mottling increases" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "12–24 hours: Dark mottling of the myocardium may become visible" — [ditki](https://ditki.com/course/pathology/glossary/pathophysiologic-disorder/myocardial-infarction-gross-histologic-changes). |
| A5 | 12–24 h: "sometimes with early central pallor" (hedged) | **CONFIRMED** (as hedged) | Independent teaching sources describe pallor in exactly this window: "18–24 Hours: Pallor of myocardium" — [WebPath](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html); "12–24 hours: the myocardium manifests progressive pallor" — [UPMC case 158](https://path.upmc.edu/cases/case158/dx.html). The "sometimes" hedge is appropriate — Robbins-derived reproductions say only "dark mottling" here. |
| A6 | 1–3 days: mottling **with a yellow-tan center**, surrounding rim still congested/dark | **CONFIRMED** | "1–3 days: Mottling with a yellow-tan center" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "hyperemic border with a yellow-tan center" from ~day 3 — [ditki](https://ditki.com/course/pathology/glossary/pathophysiologic-disorder/myocardial-infarction-gross-histologic-changes). |
| A7 | 3–7 days: hyperemic (bright red) border around a softening yellow-tan center | **CONFIRMED** | "3–7 days: Hyperemic borders, softening of infarcted tissue" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "3–7 Days: Hyperemic border with central yellowing" — [WebPath](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html). |
| A8 | 3–7 days is the mechanical-rupture window (most structurally fragile) | **CONFIRMED** | "highest cardiac rupture risk, occurring around days 4–7 when myocardial softening increases vulnerability" — [ditki](https://ditki.com/course/pathology/glossary/pathophysiologic-disorder/myocardial-infarction-gross-histologic-changes). |
| A9 | 7–10 days: maximally yellow-tan and soft, depressed red-tan margins | **CONFIRMED** | "7–10 days: Maximally yellow-tan infarct, very soft, with depressed red-tan margins" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/). |
| A10 | 10–14 days: red-gray depressed borders (granulation tissue), persisting yellowish center | **CONFIRMED** | "10–14 days: Red-gray infarct borders, persistent yellowish center" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/). |
| A11 | 2–8 weeks: gray-white scar advancing from periphery inward | **CONFIRMED** | "2–8 weeks: Formation of a gray-white scar, which progressively moves from the periphery toward the center" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "grayish-white scar tissue develops from the outside border inwards towards the core" — [ditki](https://ditki.com/course/pathology/glossary/pathophysiologic-disorder/myocardial-infarction-gross-histologic-changes). |
| A12 | >2 months: scarring complete, firm pale gray-white contracted scar, wall usually thinned | **CONFIRMED** | "Beyond 2 months: Complete scar formation with dense collagen" — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "7 Weeks: White fibrosis" / dense fibrosis without inflammation — [WebPath](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html). Wall thinning after transmural loss is standard remodeling and is consistent with the model sidecar's own LV `diseased_appearance` text. |
| A13 | Interval boundaries as a set (0–4 / 4–12 / 12–24 / 1–3 d / 3–7 d / 7–10 d / 10–14 d / 2–8 wk / >2 mo) | **CONFIRMED** | The boundary set reproduced in the doc matches the standard table row-for-row — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/). The doc's only structural difference is collapsing Robbins' two sub-4-hour rows (0–½ h, ½–4 h) into one "0–4 hours" row, which loses no information since both read "none". |
| A14 | TTC stains viable myocardium brick-red and leaves infarct pale; reveals necrosis hours before unaided inspection | **CONFIRMED** | "Triphenyl Tetrazolium Chloride test … non-infarcted tissue stains brick red while infarcted tissue appears pale," placed in the 30 min–4 h interval — [ilovepathology](https://ilovepathology.com/myocardial-infarction-gross-and-microscopy/); "Staining defect … with tetrazolium or basic fuchsin dye" at 2–3 h — [WebPath](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html). |
| A15 | Culprit LAD opened longitudinally shows dark red-brown occlusive thrombus on a disrupted, often calcified plaque | **CONFIRMED** | Consistent with the standard plaque-rupture-plus-thrombosis account of acute MI; corroborated by the repo's own sidecar and by [StatPearls, Anterior MI (NBK562234)](https://www.ncbi.nlm.nih.gov/books/NBK562234/). No source contradicts the color description. |
| A16 | Rendering rule: a visible lesion requires ≥~12 h post-onset; a convincing yellow center ≥~24 h | **CONFIRMED** | Follows directly from A1/A2/A4/A6. Correct and, in my view, the single most useful sentence in the file for the rendering track. |

**Timeline verdict: no errors found.** All nine intervals and all colour
descriptors match independent reproductions of the standard table. This is the
highest-stakes section and it is clean.

### B. Culprit-vessel frequency (pathology doc §1)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| B1 | LAD ~40–50% of infarcts | **CONFIRMED** | "The LAD is involved more frequently, in around 40% to 50% of myocardial infarctions" — [StatPearls, Lateral Wall Myocardial Infarction (NBK537228)](https://www.ncbi.nlm.nih.gov/books/NBK537228/). |
| B2 | RCA ~30–40% | **CONFIRMED** | "…while the right coronary artery is responsible for 30% to 40%" — same source. |
| B3 | LCx ~15–20% | **CONFIRMED** | "The LCx is involved in approximately 15% to 20% of all myocardial infarctions" — same source. |
| B4 | Anterior is the most common infarct territory | **CONFIRMED** | Follows from B1–B3. Independently, [StatPearls Anterior MI](https://www.ncbi.nlm.nih.gov/books/NBK562234/) gives anterior STEMI ≈33% of all STEMIs, the largest single territory. |
| B5 | Anterior MI has the largest average infarct size and poorest prognosis; the LAD feeds more myocardium than either other vessel | **CONFIRMED** | Anterior MI carries the worst prognosis of infarct sites owing to greater infarcted territory; anterior vs inferior in-hospital mortality 11.9% vs 2.8%, heart failure 41% vs 15%, admission EF 38% vs 55% — [The prognosis of anterior myocardial infarction revisited: a community-wide study, *Clin Cardiol*](https://onlinelibrary.wiley.com/doi/epdf/10.1002/clc.4960020612); LAD supplies ~45–55% of LV arterial supply — [StatPearls, Anatomy: LAD Artery (NBK482375)](https://www.ncbi.nlm.nih.gov/books/NBK482375/). |

*Note:* the three ranges as printed sum to 85–110%, i.e. they are independent
approximate ranges, not a partition. The doc does not claim otherwise, so this
is not an error — but an author adding a parenthetical would improve it.

### C. Timing claims (pathology doc §2)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C1 | Aerobic metabolism stops within seconds; ATP falls, anaerobic glycolysis, lactate | **CONFIRMED** | Standard ischemic-metabolism sequence; corroborated in [Consequences of Brief Ischemia: Stunning, Preconditioning…, *Circulation*](https://www.ahajournals.org/doi/10.1161/hc4801.100038). |
| C2 | Contractility lost within about a minute, before any cell dies | **CONFIRMED** | Severe loss of contractility within 60 seconds of the onset of ischemia; ischemia <20 min followed by reperfusion produces no necrosis (reversible injury) — [Pathology of Myocardial Ischemia, Infarction, Reperfusion, and Sudden Death](https://thoracickey.com/pathology-of-myocardial-ischemia-infarction-reperfusion-and-sudden-death/); [*Circulation* 2001](https://www.ahajournals.org/doi/10.1161/hc4801.100038). |
| C3 | Myocyte death begins at roughly **20–40 minutes** of severe sustained ischemia | **CONFIRMED** | "A 20- to 30-min interval of severe ischemia is sufficient to induce irreversible changes in some cardiomyocytes of the subendocardial area" — [Guidelines for experimental models of myocardial ischemia and infarction, *Am J Physiol Heart Circ Physiol* (PMC5966768)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5966768/). At 40 min of occlusion, necrosis is present and subendocardial (38 ± 4% of wall thickness) — [Reimer KA, Lowe JE, Rasmussen MM, Jennings RB. The wavefront phenomenon of ischemic cell death. 1. *Circulation*. 1977;56(5):786–794](https://www.ahajournals.org/doi/10.1161/01.CIR.56.5.786) (PMID 912839). The 20–40 min range brackets both figures correctly. |
| C4 | Microvascular injury follows somewhat later | **CONFIRMED** | Consistent with the same experimental literature (microvascular obstruction develops after cardiomyocyte necrosis). |
| C5 | Necrosis begins in the **subendocardium** and advances outward as a wavefront | **CONFIRMED** | "a wavefront of cardiomyocyte death that progresses from the more susceptible subendocardium to the less vulnerable subepicardium"; "the subendocardium, where myocardial oxygen demand is greatest, is more susceptible" — [PMC5966768](https://pmc.ncbi.nlm.nih.gov/articles/PMC5966768/); original demonstration in [Reimer et al. 1977](https://www.ahajournals.org/doi/10.1161/01.CIR.56.5.786). |
| C6 | In **experimental models** the transmural infarct is largely complete within about **6 hours** | **CONFIRMED, with the caveat correctly stated** | Reimer et al.: transmural necrosis 38 ± 4% at 40 min, 57 ± 7% at 3 h, **71 ± 7% at 6 h**, 85 ± 2% at 24 h in the open-chest dog — [*Circulation* 1977;56:786](https://www.ahajournals.org/doi/10.1161/01.CIR.56.5.786). "Ischemic myocardium cannot be salvaged by reperfusion after 6 h of coronary occlusion" in large-animal models — [PMC5966768](https://pmc.ncbi.nlm.nih.gov/articles/PMC5966768/). "Largely complete" (not "complete") is the honest reading of 71%, and the doc uses exactly that word. |
| C7 | Species/collateral caveat: collateral circulation slows the wavefront in humans and extends the reperfusion window | **CONFIRMED** | "The wavefront concept … was derived from experimental studies in dogs, where a substantial coronary collateral circulation influences the time course of cardiomyocyte necrosis" — [PMC5966768](https://pmc.ncbi.nlm.nih.gov/articles/PMC5966768/). The author's caveat is not only correct, it is the caveat the source itself emphasises. |
| C8 | Plaque rupture/fissuring/erosion with superimposed thrombosis initiates the great majority of acute MIs | **CONFIRMED** | Standard; corroborated by [StatPearls Anterior MI (NBK562234)](https://www.ncbi.nlm.nih.gov/books/NBK562234/) and the repo sidecar's own `left_coronary_artery.teach.diseased_appearance`. |
| C9 | Coagulative necrosis; dead myocytes keep outlines for days; neutrophils → macrophages → granulation tissue → collagen | **CONFIRMED** | "4–12 hours: Coagulation necrosis…"; neutrophil influx 12–24 h; loss of nuclei days 1–3; macrophage phagocytosis days 3–7; granulation tissue at margins; scar ~2 months — [WebPath](https://webpath.med.utah.edu/TUTORIAL/MYOCARD/MYOCARD.html), [UPMC case 158](https://path.upmc.edu/cases/case158/dx.html). |

### D. Chapter attribution and citation formatting

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| D1 | "Chapter 12, The Heart" is the correct chapter in Robbins & Cotran, 10th ed. | **CONFIRMED (secondary sources)** | Multiple independent listings of the 10th-edition contents place Ch. 11 Blood Vessels, **Ch. 12 The Heart**, Ch. 13 Diseases of White Blood Cells, Lymph Nodes, Spleen and Thymus, within "Systemic Pathology: Diseases of Organ Systems"; the publisher's own page for ISBN 978-0-323-53113-9 shows the same numbering scheme running to Ch. 29 The Eye — [Elsevier, Robbins & Cotran PBoD 10e](https://shop.elsevier.com/books/robbins-and-cotran-pathologic-basis-of-disease/kumar/978-0-323-53113-9). I could not open a primary front-matter TOC, so this is high-confidence but not first-hand. The author's uncertainty flag can be closed. |
| D2 | Edition/year "10th ed. Elsevier, 2021" | **UNVERIFIABLE (minor)** | The 10th edition is variously catalogued as 2020 and 2021 (and a 2022 printing appears in third-party listings). Not worth blocking on; if precision matters, cite the copyright page. |
| D3 | The table number is not asserted (the doc says only "the chapter's table") | **CONFIRMED as honest** | I could not confirm a table number from any accessible source. The doc correctly declines to invent one; **do not** add a table number during editing unless someone reads it off the page. |
| D4 | Reference [3]: Engelen DJ, Gorgels AP, Cheriex EC, et al., *J Am Coll Cardiol*. 1999;34(2):389–395 | **CONFIRMED — exact** | Journal, year, volume, issue and page range all match. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0735109799001977), DOI 10.1016/S0735-1097(99)00197-7, PMID 10440150. The study correlates pre-reperfusion ST deviation with LAD occlusion site relative to the first septal perforator and first diagonal — exactly the use the doc makes of it. |

### E. StatPearls NBK562234 — claims attributed to [2], checked against the page itself

I fetched the page. All of the following are verified against its actual text.

| # | Claim in doc/case | Verdict | Evidence (from NBK562234) |
|---|---|---|---|
| E1 | Authors Bansal K, Gore M, Afzal M, Shams P, Nalabothu P; last updated 12 Feb 2024 | **CONFIRMED — exact** | Page lists Kamna Bansal, Meghana Gore, Muriam Afzal, Pirbhat Shams, Poorna Nalabothu; last update February 12, 2024. |
| E2 | Chest discomfort "constricting, squeezing, or heavy," lasting more than about 30 minutes | **CONFIRMED — near-verbatim** | "constricting, squeezing, or a heavy sensation in the chest"; "Pain classically lasts longer than 30 minutes and can persist for hours if revascularization is not performed." |
| E3 | Radiation to left arm, shoulder, or jaw | **CONFIRMED** | "may radiate to the bilateral shoulder, jaw/neck, or left arm." |
| E4 | Dyspnea, diaphoresis, nausea, palpitations | **CONFIRMED** | "Dyspnea, palpitations, anxiety, nausea, vomiting, diaphoresis." |
| E5 | Tachycardia and tachypnea; BP often normal or elevated early | **CONFIRMED** | Tachycardia noted; tachypnea from anxiety/stress/heart failure; "Uncomplicated cases may be normotensive." *Minor:* the page supports "normotensive"; it does not specifically say "or elevated." Clinically unobjectionable, but it is a small extension beyond the cited source. |
| E6 | SBP < 90 mmHg raises the question of cardiogenic shock | **CONFIRMED — exact** | "systolic blood pressure is typically <90 mmHg" in cardiogenic shock. |
| E7 | Septal pattern ≈ V1–V2 | **CONFIRMED — exact** | "Septal infarct: ST elevation in leads V1-V2." |
| E8 | Anterior pattern ≈ V2–V5 | **CONFIRMED — exact** | "Anterior infarction: ST elevation in leads V2-V5." |
| E9 | Extensive anterior ≈ V1–V6 with I and aVL, from a proximal LAD lesion | **CONFIRMED — exact** | "Extensive anterior/anterolateral: ST elevation in leads V1-V6, I, and aVL"; proximal LAD (proximal to first septal perforator): "ST elevation is evident in leads V1-V6, I, and aVL." |
| E10 | More leads with ST elevation ⇒ more myocardium at risk and higher mortality | **CONFIRMED** | Consistent with the page's proximal-vs-distal framing and with the anterior-vs-inferior mortality data in [*Clin Cardiol*](https://onlinelibrary.wiley.com/doi/epdf/10.1002/clc.4960020612). |
| E11 | Complication list: arrhythmia/SCD, conduction abnormality and BBB, LV dysfunction, cardiogenic shock, free wall rupture with tamponade, VSR, LV mural thrombus, LV aneurysm, pericarditis, Dressler | **CONFIRMED — every item present** | The page lists: cardiogenic shock; LV dysfunction; LV mural thrombus; ventricular septal rupture; free wall rupture with cardiac tamponade; pericardial effusion; acute pericarditis; Dressler syndrome; sudden cardiac death (VT/VF); conduction abnormalities and bundle branch blocks; LV aneurysm. |
| E12 | Doc attributes culprit-vessel percentages to [2] as well as [1] | **CORRECTED (citation-scope, minor)** | NBK562234 does **not** carry the 40–50/30–40/15–20 figures; it gives only "anterior STEMI accounts for approximately 33% of all STEMIs." The figures are correct (see B1–B3) but the correct StatPearls locus is [NBK537228](https://www.ncbi.nlm.nih.gov/books/NBK537228/). Medicine unaffected; attribution imprecise. |
| E13 | Doc §5 troponin: rises and stays elevated for days, so a late presenter still has a strikingly abnormal troponin — tagged [2] | **CORRECTED (citation-scope, minor)** | NBK562234 says only "evidence of ischemia can be obtained within 2 to 3 hours" with a high-sensitivity assay; it does not state multi-day persistence. The claim itself is correct — cTnI remains elevated ~7–10 days and cTnT up to ~14 days, with peak around 24 h ([Medscape, Troponins](https://emedicine.medscape.com/article/2073935-overview); [Michigan Medicine MLabs, hs-Troponin T](https://mlabs.umich.edu/tests/troponin-t-high-sensitivity)) — but it needs its own citation. |
| E14 | Atypical presentation (dyspnea alone, epigastric pain, syncope, silent MI) commoner in older adults, people with diabetes, and women | **CONFIRMED as medicine; citation not located on the fetched page** | Well-established and uncontroversial. I did not find this specific sentence in the retrieved text of NBK562234; if the author read it there, fine — otherwise it wants a second citation. Non-blocking. |

### F. Complication timing (pathology doc §6)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| F1 | VF/VT are the leading cause of sudden death before reaching hospital | **CONFIRMED** | "Sudden cardiac death (VT/VF)" listed as a complication — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/); standard epidemiology. |
| F2 | Anterior infarct damaging septal perforators → BBB or high-grade infranodal AV block; ominous, reflects a large infarct | **CONFIRMED** | Conduction abnormalities/BBB listed for anterior MI — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/); the LAD's septal branches supply the AV bundle — [StatPearls NBK482375](https://www.ncbi.nlm.nih.gov/books/NBK482375/). |
| F3 | Fibrinous pericarditis typically a couple of days in, over a transmural infarct | **CONFIRMED** | Acute (post-infarction) pericarditis listed — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/); early post-MI pericarditis is described in the first days after transmural infarction — [*Serial Electrocardiographic Changes in Early Post-myocardial Infarction Pericarditis* (PMC9372382)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9372382/). |
| F4 | Mechanical complications peak days ~3–7 (free wall rupture → hemopericardium/tamponade; VSR → L-to-R shunt, anterior/apical septum with LAD infarcts) | **CONFIRMED** | Rupture risk peaks ~days 4–7 with maximal softening — [ditki](https://ditki.com/course/pathology/glossary/pathophysiologic-disorder/myocardial-infarction-gross-histologic-changes); free wall rupture with tamponade and VSR both listed for anterior MI — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/); anterior-MI VSR is a recognised entity — [PMC9307369](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9307369/). |
| F5 | Papillary muscle rupture: the posteromedial PM has a single blood supply, is the classic ruptured one, and is more often an **inferior/RCA** complication | **CONFIRMED** | Standard cardiac anatomy/pathology; the doc explicitly flags it as a territory distinction rather than an anterior-MI complication, which is the correct and honest handling. |
| F6 | LV mural thrombus characteristically at the akinetic apex after anterior MI, with systemic embolisation risk | **CONFIRMED** | "Left ventricular mural thrombus" listed under anterior MI complications — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/). |
| F7 | Ventricular aneurysm: late, thinned, scarred, bulging, typically apical after anterior MI; substrate for thrombus and arrhythmia | **CONFIRMED** | "Left ventricular aneurysm" listed — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/). |
| F8 | Dressler syndrome = delayed immune-mediated pericarditis | **CONFIRMED** | Listed by name — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/). |
| F9 | Infarct extension vs infarct expansion, defined as new adjacent necrosis vs stretching/thinning of the necrotic wall | **CONFIRMED** | Standard definitions; no source contradicts. |

### G. Anatomy cross-checks and model-honesty statements (pathology doc §4)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| G1 | LAD territory = anterior wall of LV + anterior two-thirds of the interventricular septum + cardiac apex | **CONFIRMED — exact** | "The LAD is responsible for supplying blood to the anterior wall of the left ventricle, the anterior two-thirds of the interventricular septum, and the apex of the heart"; septal branches supply the anterior 2/3 of the septum — [StatPearls, Anatomy, Thorax, Heart: LAD Artery (NBK482375)](https://www.ncbi.nlm.nih.gov/books/NBK482375/). |
| G2 | `media/models/heart/anatomy.json` has 16 structures | **CONFIRMED** | Counted directly: right/left atrium, right/left ventricle, ascending aorta, aortic arch, pulmonary trunk, SVC, IVC, RCA, LCA, coronary sinus, tricuspid/mitral/aortic/pulmonary valves = 16. |
| G3 | The model's `left_coronary_artery` is a single undivided mesh covering left main + LAD + circumflex; the sidecar says so; `LAD` is an alias to the same id | **CONFIRMED** | `anatomy.json` `left_coronary_artery.teach.function`: "This model represents the left coronary artery as a single mesh encompassing its LAD and circumflex branches rather than splitting them into separate structures." `aliases` contains `"LAD": "left_coronary_artery"`. |
| G4 | No septum, no apex, no anterior-wall sub-structure; `left_ventricle` is one mesh | **CONFIRMED** | No such ids exist in `anatomy.json`; `left_ventricle.children` are only `mitral_valve` and `aortic_valve`. |
| G5 | Only `render.kind: "tint"` is implemented; `decal` and `variant` are declared in the schema but not implemented | **CONFIRMED** | `js/medical/core.js:364` — `if (rn.kind !== "tint") { toast(\`lesion render "${rn.kind \|\| "?"}" not yet supported\`); return; }`. `schemas/validate.py:257` accepts `("tint","decal","variant")`. `schemas/case.schema.md` documents all three. The doc's statement is exactly right. |
| G6 | Therefore morphology changes (wall thinning, aneurysmal bulge, rupture defect) cannot be shown yet; anterior MI works as a first pathology because its early-mid signature is a colour change | **CONFIRMED** | Follows from G5 and from §3. Sound reasoning, honestly stated. |

**On the honesty notes specifically:** both model limitations are stated in the
pathology doc, restated in the case `finding`, and restated a third time in the
case `teaching`. That is the correct level of insistence for a limitation that
would otherwise teach a learner something false about anatomy. I would not
reduce it.

### H. Case-internal consistency — `cases/heart-anterior-stemi-01.json`

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| H1 | Schema/validator conformance | **CONFIRMED** | `python3 schemas/validate.py --case cases/heart-anterior-stemi-01.json media/models/heart/anatomy.json` → "OK — valid (0 warnings)", exit 0. `id` matches filename; `lesions[0].structure` and `spread[0]` both resolve; `review.status` is `"draft"`. `model: "models/heart/heart.glb"` resolves under `media/`. |
| H2 | 48 h vignette ⇄ 1–3 day gross stage (mottling, early yellow-tan centre, congested rim) | **CONFIRMED — internally consistent** | 48 h sits inside the 1–3 day row (A6). The `finding` names the stage explicitly and correctly. |
| H3 | `finding` avoids anything that must not be present at 48 h | **CONFIRMED** | It states there is "no wall thinning, rupture, aneurysm, or mural thrombus," and describes no granulation tissue and no scar. It does not describe a hyperemic bright-red border (a 3–7 day feature) — correctly, it describes a *congested darker rim*, which is right for 1–3 days. No 3–7 day, 7–10 day or 2–8 week feature is smuggled in. This is the check I expected to fail and it does not. |
| H4 | "The infarcted muscle is not yet soft" at 48 h | **CONFIRMED with a wording nit** | Maximal softening is 3–10 days (A7, A9); at 1–3 days softening is not yet the dominant feature. The `teaching` text puts it more precisely — "not yet at its softest." The `finding`'s absolute phrasing is defensible but slightly overstated; see minor notes. |
| H5 | Thrombus "about 2 cm distal to its origin" ⇒ proximal LAD ⇒ large anterior infarct with pump failure | **CONFIRMED — coherent** | Proximal LAD occlusion produces the largest anterior infarcts and the greatest heart-failure burden — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/), [*Clin Cardiol*](https://onlinelibrary.wiley.com/doi/epdf/10.1002/clc.4960020612). |
| H6 | ECG: STE with developing Q waves and TWI in V1–V4, reciprocal inferior ST depression | **CONFIRMED** | "Anteroseptal: ST elevation in leads V1-V4"; proximal LAD occlusion shows "ST-segment elevation in leads I, aVL, and V1 through V4, along with ST-segment depression in leads II, III, and aVF" — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/). Developing Q waves plus T-wave inversion at ~48 h is the expected evolving pattern — [*Comparison of the prognostic role of Q waves and inverted T waves*, PMID 30191632](https://pubmed.ncbi.nlm.nih.gov/30191632/). |
| H7 | Vitals: HR 104, BP 132/84, RR 22, SpO2 91% RA, T 37.8 °C | **CONFIRMED — clinically plausible for 48 h** | Tachycardia and tachypnea expected; normotension is explicitly the uncomplicated pattern and correctly avoids implying shock (< 90 systolic) — [NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/). Low-grade fever is expected in this window: temperature rises on average ~1.6 °C peaking 24–48 h after admission, fever commonly seen days 1–3 post-MI — [*Prolonged Fever After STEMI and Long-Term Cardiac Outcomes*, JAHA](https://www.ahajournals.org/doi/10.1161/JAHA.116.005463). 37.8 °C is appropriately modest. |
| H8 | Exam: elevated JVP, bibasilar crackles, S3, no murmur, no rub | **CONFIRMED — coherent** | Pulmonary congestion signs indicate LV failure ([NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/)). "No murmur" correctly forecloses VSR and papillary-muscle rupture, which do not belong at 48 h; "no rub" forecloses the pericarditis distractor. Both negatives are doing real work and are correctly placed. |
| H9 | hs-troponin "markedly elevated and has plateaued rather than risen across two draws" | **CONFIRMED** | Troponin peaks ~24 h and declines to baseline over 7–14 days (cTnI ~7–10 d, cTnT up to ~14 d) — [Medscape, Troponins](https://emedicine.medscape.com/article/2073935-overview), [MLabs hs-cTnT](https://mlabs.umich.edu/tests/troponin-t-high-sensitivity). At ~48 h a markedly elevated, non-rising value across two draws is exactly the late-presenter pattern. Strictly it would more often be *falling* than flat, but "plateaued rather than risen" is the clinically meaningful contrast and is not wrong. |
| H10 | `teaching`: "myocyte death began at roughly 20 to 40 minutes and advanced as a wavefront from the subendocardium outward" | **CONFIRMED** | Same evidence as C3/C5. |
| H11 | `teaching`: fever is the inflammatory response to necrotic muscle, not infection | **CONFIRMED** | "in the first 3 to 4 days after a myocardial infarction, there is an acute inflammatory reaction triggered by necrotic cardiomyocytes" — [JAHA](https://www.ahajournals.org/doi/10.1161/JAHA.116.005463). |
| H12 | `teaching`: what is *not* yet visible at 48 h — rupture window at 3–7 d, later apical mural thrombus and aneurysm, gray-white thinned scar by 2–8 weeks | **CONFIRMED** | Matches A7–A12, F4, F6, F7. The negative-space teaching is accurate and is the strongest pedagogy in the file. |
| H13 | Render `tint #4d1414`, intensity 0.85, spread → `left_ventricle` | **DEFENSIBLE for the vessel and the mottled/congested wall; INCOMPLETE for the 1–3 day stage** | `#4d1414` is a dark, desaturated red-brown — a fair single-colour stand-in for a dark red-brown occlusive thrombus (A15) and for dusky red-brown mottling with a congested rim (A6). What it cannot carry is the *yellow-tan centre*, which is the defining new feature of the 1–3 day row and the feature the rubric asks the learner to read. With only a flat tint available (G5) no single colour can express a two-zone lesion, so the colour choice is not wrong — but the rubric written on top of it is. See correction #2. |

### I. `diagnosis.accept` — all 22 entries adjudicated

| Entry | Verdict |
|---|---|
| anterior MI | **ACCEPT** — core answer. |
| anterior myocardial infarction | **ACCEPT** |
| acute anterior myocardial infarction | **ACCEPT** — "acute" is correct at 48 h (UDMI acute = 6 h–7 days). |
| anterior wall MI | **ACCEPT** |
| anterior wall myocardial infarction | **ACCEPT** |
| anterior STEMI | **ACCEPT** — vignette shows ST elevation; infarct is transmural. |
| acute anterior ST-elevation myocardial infarction | **ACCEPT** |
| anteroseptal MI | **ACCEPT** — V1–V4 is the anteroseptal pattern ([NBK562234](https://www.ncbi.nlm.nih.gov/books/NBK562234/)); anterior 2/3 septum is LAD territory ([NBK482375](https://www.ncbi.nlm.nih.gov/books/NBK482375/)). |
| anteroseptal myocardial infarction | **ACCEPT** |
| anteroapical myocardial infarction | **ACCEPT** — apex is LAD territory ([NBK482375](https://www.ncbi.nlm.nih.gov/books/NBK482375/)); the `finding` names apex involvement. |
| LAD infarct | **ACCEPT** |
| LAD territory infarct | **ACCEPT** |
| LAD territory myocardial infarction | **ACCEPT** |
| left anterior descending artery occlusion with anterior wall infarction | **ACCEPT** |
| myocardial infarction of the anterior left ventricle | **ACCEPT** |
| infarction of the anterior wall and anterior septum of the left ventricle | **ACCEPT** |
| coronary thrombosis of the LAD with anterior infarction | **ACCEPT** |
| acute MI, LAD distribution | **ACCEPT** |
| **subacute anterior myocardial infarction** | **REJECT — see correction #1.** |
| anterior myocardial infarction approximately 2 days old | **ACCEPT** — matches the vignette's ~48 h. |
| 1 to 3 day old anterior myocardial infarction | **ACCEPT** — matches the gross stage. |
| 48-hour-old anterior wall infarct | **ACCEPT** |

**21 of 22 acceptable.** No entry mislocalises the infarct (nothing accepts
"anterolateral", "inferior", "lateral", or a bare "posterior"), none accepts a
non-ischemic answer, and none accepts a wrong vessel. The only defective entry
is the temporal qualifier "subacute".

### J. `diagnosis.distractors` — all 4 adjudicated

| Distractor | Plausible? | Accidentally correct? | Verdict |
|---|---|---|---|
| Acute inferior myocardial infarction from right coronary artery occlusion | Yes — the commonest territory confusion, and RCA is the second commonest culprit (B2) | No — the vignette's ST elevation is precordial V1–V4 with *reciprocal* inferior depression, and the tinted vessel is the left coronary | **GOOD** |
| Acute fibrinous pericarditis | Yes — chest pain, low-grade fever, an inflammatory picture | No, **but it is the weakest of the four** — fibrinous pericarditis is itself a genuine complication of transmural MI at roughly this timepoint (F3), so a learner could argue it is *present* rather than absent. The vignette's explicit "no pericardial rub" and the `finding`'s silence on any epicardial fibrinous exudate close the gap | **ACCEPTABLE** (see minor notes) |
| Acute aortic dissection involving the ascending aorta | Yes — classic chest-pain mimic, and `ascending_aorta` is a structure on this very model | No — no tearing/radiating-to-back pain, no pulse or BP differential, no widened mediastinum, and the tinted structure is the coronary/LV | **GOOD** |
| Massive pulmonary embolism with right ventricular strain | Yes — dyspnea, hypoxia, tachycardia; anterior T-wave inversion occurs in PE | No — PE does not produce V1–V4 ST elevation with developing Q waves, a coronary thrombus, or a regionally infarcted LV wall; the S3/crackles/elevated JVP combination points left, not right | **GOOD** |

No distractor is accidentally correct. All four are distinguishable from
information actually given.

---

## Corrections required

### 1. `cases/heart-anterior-stemi-01.json` — `diagnosis.accept`, entry 19: `"subacute anterior myocardial infarction"`

**What's wrong.** This case is a 48-hour-old infarct, and the whole exercise is
dating an infarct from tissue. "Subacute" does not denote 48 hours under any
authoritative framework I could find. The Fourth Universal Definition of
Myocardial Infarction classifies infarcts pathologically as **evolving (<6 h),
acute (6 h–7 days), healing (7–28 days), and healed (≥29 days)** — 48 hours is
squarely **acute**, and "subacute", where the term is used at all, denotes the
post-acute 7–28 day window between acute (<5–7 days) and chronic (≥1 month).
Accepting it is also internally inconsistent with the case's own rubric, which
imposes an AUTOMATIC DEDUCTION for mis-dating the infarct in the *other*
direction (hyperacute, <12 h). A grader should not hand full credit for an
answer that dates the lesion into the healing phase when the specimen shows no
granulation tissue and no scar.

**What it should say.** Delete the entry. If the author wants to keep a
loose-terminology safety valve, replace it with the unambiguous
`"evolving anterior myocardial infarction"`, or keep "subacute" only in a
future `accept_with_caveat`-style field rather than in full-credit `accept`.
Do **not** simply reword it to "subacute (1–3 day) anterior MI" — that
entrenches the misuse.

**Source.** Thygesen K, Alpert JS, Jaffe AS, et al. *Fourth Universal Definition
of Myocardial Infarction (2018)*. Circulation. 2018;138:e618–e651 —
https://www.ahajournals.org/doi/10.1161/CIR.0000000000000617 (also
https://www.jacc.org/doi/10.1016/j.jacc.2018.08.1038): pathological
classification evolving <6 h / acute 6 h–7 d / healing 7–28 d / healed ≥29 d.
Corroborating usage of "subacute = 7–28 days":
https://emedicine.medscape.com/article/1960472-overview

### 2. `cases/heart-anterior-stemi-01.json` — `grading_rubric`, the commendation clause (and its PARTIAL-CREDIT counterpart)

**What's wrong.** The rubric awards "an explicit commendation" to a learner who
dates the infarct "to roughly 1-3 days from the yellow-tan center with a
congested rim (rather than from the vignette alone)", and downgrades to PARTIAL
a learner who reasons "only from the ECG with no reference to the gross
specimen, since the point of the exercise is reading the tissue." But the
learner cannot see a yellow-tan centre or a congested rim. `GET /case-render`
deliberately withholds `finding` (`schemas/case.schema.md`, "What `/case-render`
exposes vs. keeps private"), so all the learner receives is
`render: {kind:"tint", color:"#4d1414", intensity:0.85, spread:["left_ventricle"]}`
— a single flat dark red applied to the whole left coronary tree and the whole
LV. Only `tint` is implemented (`js/medical/core.js:364`), so no two-zone
lesion can currently be drawn. The rubric therefore rewards an observation the
board does not present and penalises learners for not making it. That is a
grading defect that reaches students.

**What it should say.** Either (a) reword the commendation to reward what is
actually visible plus the vignette — e.g. commend a learner who recognises that
*a grossly visible lesion at all* rules out a hyperacute infarct and places it
at ≥12–24 hours, consistent with the history; or (b) keep the clause but gate it
on a render that can express the two-zone appearance (a second lesion entry, a
`decal`, or a `variant`), and note in the case that it is pending renderer
support. Same for the PARTIAL-CREDIT "reading the tissue" clause: the tissue as
rendered currently carries stage information only at the "visible at all"
level.

**Source.** In-repo, verified this review: `schemas/case.schema.md` (the
`/case-render` private-field list); `js/medical/core.js:364` (`tint` only);
`cases/heart-anterior-stemi-01.json` `lesions[0].render`. Gross-stage colour
requirements per section A of this review.

---

## Minor corrections noted (not blocking; medicine is correct)

1. **`pathology/anterior-mi.md` §1, culprit-vessel percentages tagged `[1][2]`.**
   The figures are right, but StatPearls NBK562234 does not contain them. Retag
   to StatPearls **NBK537228** (*Lateral Wall Myocardial Infarction*), which
   states them verbatim: https://www.ncbi.nlm.nih.gov/books/NBK537228/
2. **`pathology/anterior-mi.md` §5, "Biomarkers" paragraph tagged `[2]`.**
   NBK562234 supports only the 2–3 hour hs-assay detection window, not
   multi-day persistence. Add a troponin-kinetics citation (peak ~24 h; cTnI
   elevated ~7–10 days, cTnT up to ~14 days):
   https://emedicine.medscape.com/article/2073935-overview
3. **`pathology/anterior-mi.md` §5, "blood pressure is often normal or
   elevated early" tagged `[2]`.** The source says "uncomplicated cases may be
   normotensive"; "or elevated" is a small extension beyond it. Trim or
   separately cite.
4. **`pathology/anterior-mi.md` §5 ECG list.** It gives septal (V1–V2),
   anterior (V2–V5) and extensive anterior (V1–V6 + I/aVL) but omits the
   **anteroseptal V1–V4** pattern — which is the pattern this repo's own case
   uses. Worth adding for coherence between doc and case.
5. **`pathology/anterior-mi.md` §7, ref [1] year.** The 10th edition is
   catalogued variously as 2020/2021/2022 printings. Confirm from the copyright
   page or drop the year.
6. **`pathology/anterior-mi.md` §7, ref [1] chapter.** "Chapter 12, The Heart"
   is confirmed against multiple independent listings of the 10e contents; the
   author's uncertainty flag in §8 can be closed. Leave the table *number*
   unasserted unless someone reads it off the page.
7. **`pathology/anterior-mi.md` §3, first practical note.** "Under ~12 hours
   there is genuinely nothing to see" sits slightly awkwardly beside the 4–12 h
   row's "occasionally dark mottling begins". Both are correct; consider
   "essentially nothing reliable to see."
8. **`pathology/anterior-mi.md` §1.** The three ranges (40–50 / 30–40 / 15–20)
   are independent approximations, not a partition summing to 100%. A short
   parenthesis would prevent a learner from doing arithmetic on them.
9. **`cases/heart-anterior-stemi-01.json`, `lesions[0].finding`.** "The
   infarcted muscle is not yet soft" is slightly stronger than the evidence —
   softening begins across days 1–3 and peaks at 3–10 days. The `teaching`
   text's "not yet at its softest" is the precise phrasing; consider matching
   it in `finding`.
10. **`cases/heart-anterior-stemi-01.json`, vignette internal clock.** Symptoms
    began "two mornings ago" (~48 h), he then arrests "during admission" — so
    the specimen is somewhat *more* than 48 h old. Still inside the 1–3 day
    window, so nothing is wrong, but "roughly 48 hours" is doing some rounding.
11. **`cases/heart-anterior-stemi-01.json`, distractor 2 (acute fibrinous
    pericarditis).** The weakest distractor, because post-infarction fibrinous
    pericarditis genuinely occurs at about this timepoint over a transmural
    infarct — a strong learner may read it as co-present rather than as a wrong
    answer. The "no pericardial rub" line saves it. Consider swapping in a
    cleaner mimic (e.g. takotsubo cardiomyopathy or acute myocarditis) if the
    ambiguity is ever observed to cost learners marks.
12. **`cases/heart-anterior-stemi-01.json`, `difficulty: "1"`.** Schema-legal
    (free text), but inconsistent with the schema's own worked examples
    (`"intro"`, `"intermediate"`, `"advanced"`). Cosmetic.

---

## Summary

The medicine is, with one exception, correct. The gross-morphology timeline —
the highest-stakes item, driving both the rendering and the grading — is
accurate across all nine intervals and all colour descriptors, and I could not
break it against four independent reproductions. The culprit-vessel figures are
exact. The 20–40 minute and ~6 hour timing claims are confirmed against the
primary experimental literature, including the collateral-circulation caveat,
which the author stated correctly and which the source itself emphasises. The
StatPearls attributions are faithful for presentation, vitals, ECG lead
distributions and complications; only two claims tagged `[2]` are not actually
on that page (both correct, both needing a different citation). The case is
internally consistent at 48 hours and, notably, contains none of the errors I
specifically hunted for — no rupture, no aneurysm, no scar, no granulation
tissue, no hyperemic bright-red border. The model-limitation disclosures are
honest and repeated at every layer where a learner could be misled.

Two things must be fixed before this can be marked verified: an `accept` entry
that grants full credit for mis-dating the infarct into the healing phase, and a
grading rubric that rewards an observation the renderer cannot currently
display. Both are narrow, both are in the case file, and neither requires
rewriting the pathology document.

VERDICT: FAIL — corrections required before verification
