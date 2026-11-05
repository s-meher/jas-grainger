# 2026-11-04: Phase 2 combined branch (`feat/phase2-m2`)

This one branch merges #3, #4, #6, #5 and #7, in that order, on top of `origin/main` `b5535eb`.
It was a clean merge, and `tests/README.md` auto-merged. Same environment as the per-task records.

| Check | Result |
| --- | --- |
| `~/.venvs/jas/bin/python -m pytest pipeline/tests -q` | 28 passed |
| `node tests/test_bundle.mjs` | 15 passed |
| `node tests/test_gesture.mjs` | 54 passed |
| `node tests/test_pinch_point.mjs` | 36 passed, 6 known gaps (XFAIL) |
| `python3 tests/test_contract.py` | 98/98. The `.nrrd` type check now runs because the phantom is present. |
| `python3 tests/test_bundle_browser.py` | PASS |
| `python3 tests/test_visual.py` | 5 runs: 3 PASS and 2 `TEARDOWN: DIFFER` (exit 1). Heart baseline sha1 `6f2fc84186cb826b…` is identical to `main`'s. |
| Same visual suite on untouched `origin/main` | 5 runs: 4 PASS and 1 `TEARDOWN: DIFFER`, on the first run after server start. **The flake predates Phase 2.** |

The intermittent TEARDOWN difference reproduces on `main`, so it's an existing
visual-suite flake, not a Phase 2 regression. It still needs its own follow-up.
