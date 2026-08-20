# CLAUDE.md — working inside this repo

This is **barehands, anatomy edition**: a fork of upstream
[jaredrhod/barehands](https://github.com/jaredrhod/barehands) that turns
the hand-tracked glass board into an anatomy and pathology education
tool — stage a 3D organ, cut it open, point at a structure and have an AI
name and teach it, work a sourced pathology case. The medical layer lives
in `js/medical/`, `schemas/`, `pathology/`, `cases/`, and `skills/`;
everything else stays upstream barehands so gesture fixes keep merging
cleanly. **Education and training only:** not a medical device, no
diagnosis of real patients, never used or presented as clinical judgment
about a real person. Pathology content is authored from cited sources
and human-reviewable, never invented at runtime.

**Run it:** `python3 server.py`, then open
`http://127.0.0.1:8794/stage.html` in Chrome. Config is `barehands.json`
(untracked — copy `barehands.json.example`).

**The two bin scripts** are any AI's hands and eyes on the board:
`bin/board.sh '<json>'` POSTs one command to `/cmd`; `bin/board-state.sh`
reads `/state` read-only. Both localhost-only.

**To drive the board** (staging organs, the medical verbs, the "what is
this?" loop): load `skills/board-driver/SKILL.md` first — the complete
reference, zero other context needed. **To author or validate content**
(sidecars, cases): the contracts are in `schemas/` — `anatomy.schema.md`,
`case.schema.md`, `verbs.md`, `schemas/validate.py`.

**Write-scope law:** the media airlock (`media/` is the only folder the
board ever stages from) never widens. The `/cmd` allowlist in
`server.py` (`_ALLOWED`/`_MEDICAL_VERBS`) only ever grows through a
validated verb with its own server-side checks — never a bare passthrough.

**Style law:** match upstream's terse, comment-dense style; comments
explain *why*, no framework weight for its own sake. `stage.html` is
owned by the Renderer track — touch it only via clearly marked
`MEDICAL HOOK` comment lines around each addition, never a silent
rewrite of upstream code nearby.
