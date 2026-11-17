# Phase 4 decision log (decision trees)

Same format as the [Phase 1 log](phase1-decision-log.md): question → options →
criterion → chosen leaf, with evidence. Status stays `proposed` until the
owners' review accepts it.

## D-P4-01 Browser speech — withdrawn

2026-11-17 · task 3.10 · **withdrawn before merge at team direction**

A browser-speech prototype (Web Speech API, reviewed sidecar `name` only,
dwell + cooldown) was built on this branch and then removed before merge at
the team's direction. No browser speech ships; the HUD is silent, and a test
traps `speechSynthesis` to prove it. The decision topic stays open in the
[decision queue](README.md) (0006). `bin/narrate.sh` is unchanged.

## D-P4-02 Overlay: what may it show?

2026-11-14 · task 3.9, G1 · proposed

```mermaid
flowchart TD
  Q{The demo HUD shows the model, pointed structure, mode, case state}
  Q --> A[Print the manifest/sidecar fields as they come]
  Q --> B[Whitelist in hud.js: dataset NAME, 12-char content hash,<br/>reviewer_state; generic: system + asset source;<br/>case: 'overlay shown, answer hidden', no ids]
  A -->|manifest has bundle_id/source_case (ADR 0002 allows a dataset case id);<br/>lesion id lad_occlusion IS the answer| AX[Rejected]
  B --> B1{Leak test with fake PHI-stuffed manifest + live case lesion?}
  B1 -->|no name/MRN/case id/lesion id/structure id in rendered text;<br/>free-text dataset dropped unless name-shaped| BY[Chosen]
```

Pointing at a structure while a case is active still shows that structure's
name in the HUD. That matches `board-state.sh`'s `POINTING AT`: it names what
the learner chose to point at, the same way for every structure, and never
singles out the lesion's structure (the KNOWLEDGE.md isolation rule is about
the examiner *labelling* it unprompted).

## D-P4-03 Cursor smoothing: tune, replace, or stack?

2026-11-14 · task 3.11 · proposed

```mermaid
flowchart TD
  Q{Does the cursor need more smoothing, and how?}
  Q --> A[Add a second filter after the existing EMA 0.45]
  Q --> B[Retune the EMA alpha]
  Q --> C[One Euro on the SAME raw point, replacing the EMA output;<br/>opt-in ?smooth=oneeuro, default unchanged]
  A -->|stacked low-passes add their lags;<br/>EMA already cuts jitter 45%| AX[Rejected]
  B -->|one alpha trades rest jitter against move lag;<br/>no alpha wins both| BX[Rejected]
  C --> C1{Synthetic 30 fps: less jitter AND less lag?}
  C1 -->|jitter 1.09 vs 1.71 px sd; fast lag 8 vs 41 ms;<br/>slow lag 4.7 vs 4.1 px; step90 33 vs 100 ms| C2{Default on?}
  C2 -->|thresholds downstream (26 px stillness, fling speed)<br/>were hand-tuned on the EMA; no webcam A/B yet| CY[Chosen: opt-in until the webcam A/B]
```

Parameters: `minCutoff 1.0 Hz`, `beta 0.01 (per px/s)`, `dCutoff 1.0 Hz`, in
screen pixels and seconds. Reacquisition after a > 150 ms gap restarts the
filter at the hand (the EMA glides 45 %/frame and writes that glide into
`cur.history`; 135 px on a 300 px reacquisition). Adoption rule for the
webcam session: make it the default only if pointing names land at least as
reliably and no unintended flings appear in the 3.4-3.6 checklist.

## D-P4-04 Where the overlay runs

2026-11-14 · task 3.9 · proposed

```mermaid
flowchart TD
  Q{How does the HUD attach without risking tracking?}
  Q --> A[Inline in stage.html's frame loop]
  Q --> B[One optional hook MED.installHud?.() on the tracker page;<br/>lazy import; own 100 ms setInterval; every tick in try/catch]
  A -->|a throw in rAF froze the tracker once (L6);<br/>violates the MEDICAL HOOK law| AX[Rejected]
  B -->|throwing getters recover next tick (node test);<br/>absent on ?role=render; no console errors (browser test)| BY[Chosen]
```
