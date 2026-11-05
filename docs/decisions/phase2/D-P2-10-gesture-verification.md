# D-P2-10 How 3.4–3.6 "Verify" is done

2026-11-04 · tasks 3.4, 3.5, 3.6, G3 · proposed

This entry is its own file because this PR is based on `main`, not on #3's
decision log, and a separate file can't produce an append conflict.

```mermaid
flowchart TD
  Q{How do we verify pinch / point / manipulation<br/>without a webcam in CI?}
  Q --> A[Refactor the classifier out of stage.html into js/medical/]
  Q --> B[Copy the classifier into a test file]
  Q --> C[Slice the exact source between anchor lines;<br/>drive it with synthetic hands]
  A -->|stage.html is upstream barehands: only marked hooks;<br/>a refactor breaks clean merges of its gesture fixes| AX[Rejected]
  B -->|a copy drifts silently; tests pass on code<br/>that no longer runs| BX[Rejected]
  C --> C1{Tests the real code? Detects drift? Honest about limits?}
  C1 -->|runs the live text; missing anchor = loud failure;<br/>gaps reported as XFAIL, synthetic-only doubts marked| CY[Chosen]
```

Known limits:
- Synthetic hands are 2-D in-plane poses. They can't stand in for depth,
  blur or the real corpus the thresholds were fitted on.
- A webcam session on the target hardware is still required, and it is
  reported as manual.
- Fixing the XFAIL gaps would change behaviour, so each fix needs its own
  task/PR and owner sign-off (UI / G3). This PR only records them.
