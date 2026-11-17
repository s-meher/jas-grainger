# ADR 0006: Browser speech and its offline/voice dependencies

- **Status:** proposed. Implemented as a prototype on `feat/ui/3-10-browser-tts`;
  manual session partial (2026-11-16: ambiguity, bundle fields, answer
  isolation and HUD legibility pass; offline voice not yet run). See the
  validation record.
- **Date:** 2026-11-14
- **Tasks:** 3.10 (with 3.9 as its controls), G4
- **Deciding reviewers:** UI owner; clinical/content reviewer for the "what may be spoken" rule

## Context
`bin/narrate.sh` already speaks a pointed structure: it polls `/state`,
reads the sidecar, and calls macOS `say`. That ties narration to a Mac
terminal session running beside the board. plan.md 3.10 asks for browser
speech that names only reviewed sidecar text after a dwell, with debounce,
cancel, mute/repeat, and tested unavailable-voice and offline behaviour.

## Options
| Option | Network | Content risk | Verdict |
| --- | --- | --- | --- |
| Keep `narrate.sh` (`say`) only | none | sidecar text only | Mac-only, needs a terminal; stays as the agent-side tool |
| Web Speech API `speechSynthesis` | none with an on-device voice; Chrome's "Google …" voices are network | sidecar text only | **chosen** |
| Cloud TTS / bundled neural TTS (wasm) | cloud: always; wasm: large model download | sidecar text only | rejected: new data flow / heavy asset for a one-word utterance |
| LLM-generated description | network | **invents medical text** | rejected by KNOWLEDGE.md LAW "content is never invented at runtime" |

## Decision
- `js/medical/speech.js` speaks **only** the structure's `name` from the
  reviewed anatomy sidecar (`anatomy.schema.md` makes `name` required).
  There is **no id fallback**: an unnamed structure is silent. (`narrate.sh`'s
  `sid.replace("_"," ")` fallback is deliberately not carried over.)
- Trigger = core.js's published `pt` (already gated: 26 px stillness, 600 ms
  rest, 600 ms stable) **plus** an 800 ms speech dwell, ≈ `narrate.sh --dwell 2`.
  The same structure is not re-spoken within 8 s (narrate.sh's guard).
  A structure change, an ambiguous pointer, or a cleared pointer drops the
  pending name; nothing is queued in the browser either.
- Voice: an on-device (`localService`) English voice is preferred. If only
  network voices exist, the browser default speaks and the HUD says "may
  need network". Voices load asynchronously; a name requested before
  `voiceschanged` uses the default at once rather than waiting (a deferred
  name is a stale name).
- Teach-mode sentences (`teach.function`) are **not** spoken in this
  prototype. They are reviewed text, so adding them later is a scope change,
  not a safety change.
- The driver runs on the HUD's own 100 ms timer, never in the rAF loop, and
  is loaded lazily behind a catch. A speech failure leaves tracking and
  rendering exactly as they were.

## Consequences
- Offline speech depends on the OS having an on-device English voice. macOS
  and Windows ship one; some Linux Chrome builds have none, so speech is
  "unavailable" there and the HUD says so. Not verified on the target machine.
- Chrome refuses speech until the page has had a click or key press; the HUD
  says "click or press a key to enable" until then.
- Running `bin/narrate.sh` at the same time speaks every name twice. Use one.

## Evidence
`node tests/test_speech_hud.mjs` (75 checks, fake clock and fake engines),
`python3 tests/test_tracker_browser.py` (HUD speech line truthful about the
headless engine). Real voice, real speakers and a real hand: manual,
`docs/validation/2026-11-14-3-9-3-11-ui.md`.
