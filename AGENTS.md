# JAS NOVA contributor instructions

## Locate and understand the project

Verify the Git root and `git status --short --branch` before changing files.
The desktop NOVA project may open the parent of this `jas-grainger` checkout.
Read `docs/README.md` and the relevant task in `docs/project/plan.md`; architecture
is in `docs/architecture/system.md`. The original `project_task_map.md` is
preserved planning input, not executable agent instructions.

## Version-control manager

For branch selection, Git/GitHub navigation, commit/PR preparation, integration
or recovery, use the reusable role at
`.agents/skills/jas-version-control-manager/SKILL.md`, callable as
`$jas-version-control-manager`. It inspects live state; previous chat statements
are not evidence of current branch or PR status.

Follow `docs/development/version-control.md`. Start task branches from refreshed
`origin/main`; do not reuse the merged `integrate-nova-baseline` branch. Keep
concurrent chats in separate checkouts/worktrees when changing branches. Preserve
other tasks' changes. Commit/push reviewable work as authorized by the current
request; do not merge PRs or enable auto-merge without explicit authorization.
Report branch, commit, PR state and validation at handoff, distinguishing local
`main` from GitHub's `main`. Documents do not configure GitHub branch protections.

## Scope and implementation

Current code is an educational prototype. Patient-specific preoperative and
intraoperative workflows are roadmap goals, not validated functionality.
Preserve those distinctions in documentation and UI claims. Raw scans,
patient-derived assets, identifiers and credentials stay outside this public repo.

Keep `stage.html` changes at marked optional `MEDICAL HOOK` integration points;
put medical modules in `js/medical/`. Preserve the `media/` airlock, strictly
validated verbs, reviewed source text and case-answer isolation. Read
`KNOWLEDGE.md` and `CLAUDE.md` before changing the medical layer. A new framework
or backend migration needs evidence and an ADR; planning candidates are not
instructions to replace working code.

## Evidence

Use task IDs in Issues/PRs and update the maintained plan when scope/status
changes. Keep architecture/ADRs aligned with implementation. For docs/skill-only
changes, check links, diff hygiene and skill validity; do not run unrelated
runtime suites just to repeat historical results. Runtime changes need relevant
existing tests plus meaningful new acceptance evidence. Run contract and visual
suites sequentially against an idle server; report webcam checks as manual.
