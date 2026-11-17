# NOVA · Grainger pitch: speaker script (10:00 slot, plan 9:10)

Pace is about 140 words per minute. Speakers A–D are placeholders until the team's names are added. Rehearse with the deck's **R** key: it logs your real time per slide and shows planned vs actual at the end. **P** opens the presenter window with these notes and timers.

| # | Slide | Speaker | Budget | Running |
|---|---|---|---|---|
| 1 | NOVA + film | A | 1:25 (25 s talk + 57 s film) | 1:25 |
| 2 | The problem | A | 0:40 | 2:05 |
| 3 | Six criteria | A | 0:10 | 2:15 |
| 4 | How it works | A | 0:45 | 3:00 |
| 5 | Effectiveness | B | 0:50 | 3:50 |
| 6 | Innovation | B | 0:55 | 4:45 |
| 7 | Scalability | C | 0:45 | 5:30 |
| 8 | Empowerment | C | 0:45 | 6:15 |
| 9 | The data | D | 0:45 | 7:00 |
| 10 | System map | D | 0:40 | 7:40 |
| 11 | Interdisciplinary | D | 0:45 | 8:25 |
| 12 | Heart reel + close | A | 0:45 | 9:10 |

The heart slide plays itself (turn, pull apart, three cuts, naming). Nothing to drive; the live demo follows the deck.

---

## 1 · NOVA and the film (A, 1:25)
We're Team JAS, and this is NOVA. A surgeon studies the CT or MRI before an operation, then carries that plan in their head for hours. NOVA puts the scan back in their hands: a 3D model they turn, zoom and cut open with bare hands. Here's what that looks like in the room.
*(Press **Play the film**. Stay quiet for 57 seconds. The deck moves to slide 2 by itself when the film ends.)*

## 2 · The problem (A, 0:40)
Once a surgeon scrubs in, the scan is out of reach. The screen is outside the sterile field, so checking it means stepping away or asking someone to drive. And the scan is hundreds of flat slices. The surgeon rebuilds solid anatomy in their head, when attention is scarcest. More load means slower decisions in the steps that matter.

## 3 · Six criteria (A, 0:10)
We've organised the next eight minutes around your six criteria. Each one lights up at the top as we reach it.

## 4 · How it works (A, 0:45)
NOVA is four stages behind one webcam. Reconstruct: labelled scans become meshes in real millimetres. See: computer vision tracks both hands from the webcam. No gloves with markers, no controller. Respond: pinch to turn, spread to zoom, a flat palm to slice. Advise: a vision language model flags regions worth a second look.

## 5 · Effectiveness (B, 0:50)
Does it solve the problem? Here's each piece and where it honestly stands. Touchless turn, zoom and cut: working today on a reference heart. True-scale patient anatomy: in progress, liver CT first. An AI that points at what to check: proposed. Residents: graded cases on real anatomy, one cardiac case working. We'll measure re-orientation time, steps away from the table, NASA-TLX workload, usability, system accuracy, and learning.

## 6 · Innovation (B, 0:55)
Here's what we think is new: your palm is the scalpel. The plane of a flat hand becomes the incision. Spread two fingers to go deeper, and the cut faces render solid, like tissue. It's sterile by design: the only hardware is a webcam. It's measured in real millimetres; simplified meshes must pass displacement, volume and topology checks. And the AI can see what the hand points at, but can only send validated commands.

## 7 · Scalability (C, 0:45)
How many people could this reach? 313 million procedures a year, and any planned from imaging is a candidate. Five billion people lack safe, affordable surgery, and expensive hardware never reaches them. NOVA needs three devices hospitals and schools already own. It runs in Chrome, takes minutes to learn, and it's open source on open tools and data.

## 8 · Empowerment (C, 0:45)
People stay above the technology. Access: programs without sim labs and hospitals without navigation suites still get patient-specific 3D. Usefulness: every name and teaching line is cited and reviewed. Control: watch the screen. The AI flags a region. The surgeon decides what happens. The AI never diagnoses or acts, and cutting must be armed.

## 9 · The data (D, 0:45)
Execution starts with data. We built on public sources. 3D-IRCADb: twenty patients in DICOM, with IRCAD's own reference meshes we test against. Two Medical Segmentation Decathlon sets: ten liver CTs and fifteen hepatic-vessel CTs in NIfTI. And the BodyParts3D heart, sixteen named parts. The hard part is geometry: voxels aren't cubes, the two formats disagree on left and right, and slices must be sorted by position. Scans never go into Git.

## 10 · System map (D, 0:40)
Here's the whole system. Patient CT or MRI comes in. Geometry-checked scans go to our 3D graphics pipeline: segmentation masks become meshes in real millimetres, then the model is rendered. The same scans can feed an AI detection engine that flags suspicious regions for a clinician to review. A webcam tracks the surgeon's hands in mid air. All three meet in one web app, the surgical view, for pre-op planning and in-op review. Our meshes sit 0.6 millimetres from IRCAD's own.

## 11 · Interdisciplinary (D, 0:45)
No single field could have designed this. Each meeting of disciplines changed a decision. Medicine met AI: an AI that could improvise became one that only points. Imaging met graphics: millimetres first, accuracy before speed. Human factors met vision: gestures that fail safe. *(Name each teammate and their field.)*

## 12 · The heart and close (A, 0:45)
This is the prototype's own heart: sixteen named parts. It turns, pulls apart, and cuts on three planes with solid faces, and every structure has a name. In a moment we'll show it live, driven by bare hands. A surgeon who can't touch anything still gets the scan back in their hands. NOVA: keep the plan in reach. The code is open. Thank you, and we'd love your questions.
