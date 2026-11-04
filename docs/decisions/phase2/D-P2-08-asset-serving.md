# D-P2-08 Serving scan bundles from the localhost server

2026-11-04 · tasks 1.7, G1, G4 · proposed

This entry lives in its own file because this PR is not stacked on the PR that
adds [`phase2-decision-log.md`](../phase2-decision-log.md) (#3). Two branches
appending to the same log would conflict at merge, and a separate file keeps
the intent intact either way. Once #3 merges, the log can link here.

```mermaid
flowchart TD
  Q{How does the board fetch GLB/NRRD/manifest bundles,<br/>without exposing private research data?}
  Q --> A[New FastAPI/Flask asset server]
  Q --> B[Reuse server.py static GET as-is]
  Q --> C[Reuse server.py, add explicit types + deny private areas]
  A -->|plan.md 1.7: reuse server.py; a new backend needs<br/>evidence + ADR; no measured need| AX[Rejected]
  B --> B1{Measured on origin/main b5535eb}
  B1 -->|.glb served as application/octet-stream;<br/>data/, artifacts/, private-data/, .git/, barehands.json<br/>all served with 200, including via %2e%2e and //| BX[Rejected]
  C --> C1{Airlock unchanged? All URL spellings refused?}
  C1 -->|check on translate_path result, so GET+HEAD share it;<br/>media/ staging and /cmd untouched;<br/>18 new contract checks fail on main, pass here| CY[Chosen]
```

Not added: `.nrrd` in the `/props` browser list. `/props` lists things the
board can *stage*, and the board cannot stage a volume until 2.5 (Phase 3).
Listing it would offer a prop that fails to open.

Still open for G4: this is a development server bound to 127.0.0.1. It is not an
authenticated delivery boundary for patient data.
