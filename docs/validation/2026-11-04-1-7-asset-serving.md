# 2026-11-04: task 1.7 asset serving

Scope: Phase 2 PR C (`feat/data/1-7-asset-serving`), based on `origin/main` `b5535eb`.
Environment: macOS 26.6.2 arm64, Python 3.11.4 (system, stdlib only), Node 24.12.0,
Google Chrome (`/Applications`). Local `barehands.json` copied from the example.
All suites were run one after another against one idle `python3 server.py`.

| Check | Command | Result |
| --- | --- | --- |
| Contract suite, patched server | `python3 tests/test_contract.py` | 97/97 passed |
| New checks, **unpatched** server (`git show origin/main:server.py`) | same | 79/97: all 18 failures are the new asset-serving checks (`.glb` typed `application/octet-stream`; `data/`, `artifacts/`, `private-data/`, `.git/HEAD`, `barehands.json` returned 200 under GET and HEAD, including `/media/../`, `%2e%2e` and `//` spellings) |
| Visual suite (heart regression) | `python3 tests/test_visual.py` | 6 runs. 5 exited 0 with `TEARDOWN: PASS — pixel-identical to baseline`. 1 run exited 1, with its output discarded (`>/dev/null`); 3 immediate re-runs passed. Recorded as an unexplained flake, not a pass. |
| Gesture suite | `node tests/test_gesture.mjs` | 54 passed, 0 failed |
| `.nrrd` content type | contract suite | Skipped on this branch: there's no `.nrrd` under `media/` until PR B's phantom fixture. The check runs automatically once one exists. |

Not exercised: loading a bundle in the browser (PR D); webcam use (manual, not done).
