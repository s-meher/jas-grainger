# Repository and version-control navigation

This is the shared development workflow for JAS NOVA. The repo is
[s-meher/jas-grainger](https://github.com/s-meher/jas-grainger).
`main` is the reviewed integration branch; it is not a certification of
clinical readiness. There is no separate `develop` branch in this workflow.

## 1. Find the repository before running Git

The Codex project named NOVA currently opens the parent folder:

```text
D:\Personal Projects\JAS NOVA Grainger\       Codex workspace, not a Git repo
  AGENTS.md                                local project entry point
  .agents/skills/jas-version-control-manager/ local callable manager
  jas-grainger/                            actual Git repository
    .git/
    AGENTS.md
    .agents/skills/jas-version-control-manager/ versioned manager source
    docs/
    stage.html
    server.py
```

From PowerShell:

```powershell
cd "D:\Personal Projects\JAS NOVA Grainger\jas-grainger"
git rev-parse --show-toplevel
git status --short --branch
git branch --show-current
git remote -v
```

Expected `origin`: `https://github.com/s-meher/jas-grainger.git`.
`nova` points to `https://github.com/AbdulMueedd/NOVA.git` for upstream imports.
Remote configuration is local: other clones must add `nova` themselves if needed.
Do not push project changes to `nova`.

GitHub's branch selector, your local checked-out branch, and a Codex chat's
context are different things. Selecting `main` on GitHub does not switch local
files. Local branch switching changes the tracked files in that same checkout
for every chat/editor using it. Ignored generated files can remain visible.

## 2. Branch policy and names

| Branch/prefix | Purpose | Base and destination |
| --- | --- | --- |
| `main` | Reviewed integration history | Normal development enters through PRs. |
| `feat/data/<task>-<slug>` | Coder 1 ingestion/backend task | Fresh `origin/main` -> PR to `main`. |
| `feat/graphics/<task>-<slug>` | Coder 2 rendering task | Fresh `origin/main` -> PR to `main`. |
| `feat/ui/<task>-<slug>` | Coder 3 CV/UI task | Fresh `origin/main` -> PR to `main`. |
| `fix/<task>-<slug>` | Focused bug fix | Fresh `origin/main` -> PR to `main`. |
| `docs/<slug>` | Plans, architecture, guides, reusable roles | Fresh `origin/main` -> PR to `main`. |
| `integrate/nova-<revision>` | Deliberately reviewed upstream update | Fresh `origin/main` -> PR to `main`. |

Use `1-2` for source task `1.2` in branch names. Example:
`feat/data/1-2-nifti-loader`. One branch/PR should deliver one reviewable task or
cohesive group with explicit dependencies. Do not open three different tasks on
one old integration branch just because that branch is already checked out.

`integrate-nova-baseline` is the historical import branch. PR #1 merged it into
`main` at `08a8fa1` on 2026-10-24. Preserve that history and start new work from
current `origin/main`; don't use the import branch as a permanent development base.

This plan itself is proposed on `docs/project-plan-and-vc-manager`. Until its PR
is merged, open that branch on GitHub to see these new documents. A feature branch
can exist locally and on GitHub without its files appearing on GitHub `main`.

## 3. Where project details belong

| Information | Location |
| --- | --- |
| All project navigation | `docs/README.md` |
| Goals, milestones, task IDs, dependencies, owners and status | `docs/project/plan.md` |
| Original task map | `docs/project/project_task_map.md` (preserved source; edit the maintained plan) |
| Component/system diagrams, interfaces and proposed layouts | `docs/architecture/system.md` |
| Rationale and alternatives | `docs/decisions/NNNN-short-title.md` |
| Test evidence, scope limits and release gates | `docs/validation/` |
| Assignment, questions, task progress | GitHub Issue, titled with task ID |
| Concrete changes and review evidence | PR linked to task/Issue |
| Shared AI contributor instructions | Root `AGENTS.md` |
| Version-control manager definition | `.agents/skills/jas-version-control-manager/` |
| Existing medical code/contracts/content | `js/medical/`, `schemas/`, `pathology/`, `cases/`, `review/` |
| Private scan data and patient-derived artifacts | Approved external private storage; never public Git |

Do not add raw datasets, patient screenshots, secrets, local config or generated
test outputs to a PR. Ignore rules are an accidental-staging guard, not security.
Do not commit chat transcripts as the project plan; record maintained decisions
and the evidence that future contributors need.

## 4. Start a task

First check `git status`. If changes belong to another task, keep them and use an
isolated checkout/worktree; do not reset or stash someone else's work blindly.
When the checkout is clean and no other active chat is using it:

```powershell
git fetch origin
git switch -c feat/data/1-2-nifti-loader --no-track origin/main
```

`--no-track` avoids temporarily making a feature branch track `origin/main`.
When a task intentionally depends on another unmerged branch, name that
dependency and PR base explicitly; retarget after the prerequisite merges.

For simultaneous chats, use separate checkouts or worktrees, not two branches
in the same working folder. Example from this repository, choosing an unused
directory and a branch not checked out elsewhere:

```powershell
git fetch origin
git worktree add -b feat/ui/3-10-browser-speech ../jas-ui-speech origin/main
git -C ../jas-ui-speech branch --unset-upstream
git worktree list
```

Open the new chat against that worktree's folder and verify its Git root. This
command example does not create a worktree until you run it. The Codex managed
worktree UI is also suitable when the project points to an actual Git repo.

## 5. Commit, validate and publish

Review the diff and run tests appropriate to your task. Use the exact file paths
for the change instead of staging the entire working tree. Example for a plan edit:

```powershell
git diff -- docs/project/plan.md
git diff --check
git add docs/project/plan.md
git diff --cached --stat
git commit -m "docs: update task dependencies for scan ingestion"
git push -u origin HEAD
```

Open a PR from your task branch into `main`. In the body include the problem,
resulting behavior, task/Issue IDs, relevant ADRs, exact validation outcomes and
remaining limitations. Follow the [PR handoff guide](pr-handoff.md) and fill the
repository [PR template](../../.github/pull_request_template.md), including a
review route and one explanatory row for every changed file. Refresh that map
after each push. Do not label the old baseline tests as newly run.

Use the connected GitHub tools, GitHub web UI, or `gh pr create` if GitHub CLI
is installed and authenticated. `gh` is optional; it was not installed during
the original import. Local Git sign-in and the Codex GitHub connector have
separate permissions. A connector reconnect may not fix local Git credentials.
If publishing fails, report the actual error and preserve the commits; never
paste tokens into a chat or Git remote URL.

No automatic merge is part of this workflow. The manager prepares and publishes
reviewable work within the user's task authorization; merging or enabling
auto-merge requires an explicit request for that action. Prefer a merge commit
for upstream imports to preserve ancestry. Ordinary PRs may be squash-merged
when repository settings and reviewers agree. Never rewrite shared `main`.

Branch protections/rulesets are **not configured by this documentation**.
Recommended administrator settings are PR review and relevant required checks
before main updates, plus disabled force pushes/deletion. Enable only checks
that actually exist and are useful; a documented policy is not GitHub enforcement.

## 6. Finish or update a task

After GitHub confirms the PR is merged and this checkout is safe to switch:

```powershell
git fetch origin
git switch main
git merge --ff-only origin/main
git status --short --branch
```

Keep task branches until their work is confirmed integrated. Branch deletion is
optional; do not delete another chat's active branch or worktree. For an
unmerged shared branch, integrate updated `origin/main` deliberately and review
conflicts. Rebase only a private task branch when the team agrees; rewriting a
published branch needs explicit coordination, never a blind force push.

For a new NOVA import, fetch `nova`, inspect commits/diffs and create
`integrate/nova-<revision>` from current `origin/main`. Since the original
histories were already joined, normal future merges should not need
`--allow-unrelated-histories`. Do not merge `nova/main` directly on `main`.
The existing update scripts compare barehands, not NOVA.

## 7. Explain the current branch and recover safely

```powershell
git fetch origin
git branch -avv
git log --graph --decorate --oneline -15
git log --first-parent --oneline origin/main
git diff --stat origin/main...HEAD
git ls-tree --name-only main
git ls-tree --name-only origin/main
git reflog -15
```

`origin/main` is your last fetched view of GitHub, not a live query. Local `main`
does not advance when you merely fetch. `git diff origin/main...HEAD` compares
the current task against its common ancestor with main; it may be empty after
merge. Use the PR diff to inspect historical merged work.

The pre-NOVA JAS baseline is commit `b4cf2dc`. Inspect without moving anything:

```powershell
git ls-tree --name-only b4cf2dc
git show b4cf2dc:Ideation.md
```

A shared-main rollback should be an explained revert PR, including dependency
and migration effects. Do not use `reset --hard`, `clean -fd`, force pushes or
delete a worktree as a casual navigation command. A bundle is a recovery copy,
not another active working directory or evidence that a branch was published.

## 8. Call the version-control manager from new chats

In a new chat inside this NOVA project, say:

```text
Use $jas-version-control-manager. Show the repo root, current branch, local
versus GitHub main, uncommitted changes, and the safe branch for task 1.2.
```

Other examples:

- `Use $jas-version-control-manager to prepare and push my task branch and open a PR. Do not merge it.`
- `Use $jas-version-control-manager to explain why these files appear on main.`
- `Use $jas-version-control-manager to review branch overlap across my active worktrees.`

This is a reusable agent role implemented as a skill, not an always-running
background agent or a separate memory store. It reads the live Git state and
versioned project documents each invocation. Existing chats retain their own
task context; starting a new chat does not create an isolated Git checkout.

On this computer, a project-local installed copy sits under the parent
workspace's `.agents/skills/`, so chats launched in that parent can discover it.
The versioned source lives in the repository. After updating the manager,
synchronize the installed project copy with the reviewed source. Future clones
opened at the Git root discover the repository copy directly.

For a teammate whose project also opens one directory above `jas-grainger`,
install the project entry point and skill from the repository (inspect existing
destination files before copying; do not overwrite another project's guidance):

```powershell
# From the Git root, after confirming the parent is this project's workspace:
Copy-Item docs/development/workspace-AGENTS.md ../AGENTS.md
New-Item -ItemType Directory ../.agents/skills -Force
Copy-Item .agents/skills/jas-version-control-manager ../.agents/skills/ -Recurse
```

If a new skill is not listed, open a new chat/restart Codex; the fallback is to
ask it to read `.agents/skills/jas-version-control-manager/SKILL.md` in the
project workspace. Until the plan PR is merged, switching to an older branch
can remove the repository source; the installed parent copy remains available
and can explain which branch contains the plan.

Discovery and instructions follow official OpenAI documentation for
[skills](https://learn.chatgpt.com/docs/build-skills) and
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
