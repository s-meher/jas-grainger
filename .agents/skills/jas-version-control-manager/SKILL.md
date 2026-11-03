---
name: jas-version-control-manager
description: Manage JAS NOVA repository branches, GitHub PR preparation, integration history and version-control navigation across project chats. Use for JAS Git workflows, not general application implementation.
---

# JAS version-control manager

Act as the project's version-control manager for the current request. This role
is reusable, not a background worker; persist decisions in the repo and recover
live state each invocation rather than trusting chat memory.

## Locate and inspect

Find the current Git root. If the chat starts in the NOVA workspace parent,
try its `jas-grainger` child. Confirm `origin` identifies
`s-meher/jas-grainger` before any remote mutation. If it identifies another repo,
do not apply this project's workflow there; locate the intended checkout or ask.

Read the root `AGENTS.md`, `docs/development/version-control.md` and relevant
tasks in `docs/project/plan.md` when present. An installed parent-workspace copy
of this skill may be available even when the checkout predates those files:
report the missing docs and inspect `docs/project-plan-and-vc-manager` or its PR
without silently switching the shared checkout.

Inspect branch, status, remotes and worktrees. Fetch `origin` when current remote
state matters and access is available. Distinguish checked-out HEAD, local
`main`, last-fetched `origin/main`, and the live GitHub PR/branch. If fetch/access
fails, call cached data stale rather than asserting main is unchanged. Use PR
state and merge timestamps to explain merges; an account name alone does not
identify which human or agent performed an action.

## Execute within the request

- Start a focused task branch from refreshed `origin/main`, normally with
  `--no-track` until its first push sets the same-name upstream. Name it with
  `feat/data/`, `feat/graphics/`, `feat/ui/`, `fix/`, `docs/` or `integrate/`
  plus task ID/slug. Reuse a suitable current task branch when continuing work.
- The old `integrate-nova-baseline` branch is historical; its PR #1 was merged.
  Verify current history, but do not treat it as the default for future work.
- Preserve unrelated changes. Check worktrees/active checkout context before
  switching; isolate concurrent work instead of switching another task's files.
- Stage only intended paths, inspect the staged diff, run proportional checks,
  and keep commits/PR descriptions tied to task IDs and actual evidence. Update
  plan/architecture/ADRs when the change affects them. Never claim old tests ran.
- Push task branches and open/update reviewable PRs when authorized by the task.
  Follow `docs/development/pr-handoff.md`: provide an entry point/review route,
  verification steps and a linked file map with one explanatory row for every
  changed file. Compare it against the actual base-to-head PR inventory after
  the final push and update the description when the branch changes.
  Do not infer permission to merge, enable auto-merge, deploy, rewrite shared
  history or discard work from permission to prepare a PR. Obtain specific
  authorization for those actions; existing explicit authorization still applies.
- Use available GitHub tools first; local Git/API or web UI can fill capability
  gaps. Keep credential values out of outputs, files, remote URLs and chat. On
  authentication failure, preserve commits and report the actual blocked action.
- Import later NOVA changes only on an integration branch, reviewing the source
  diff and preserving provenance. Normal merges should work after the historical
  unrelated-history join; never add that flag reflexively or change `main`.
- Keep private scans, patient-derived models, local secrets and generated outputs
  out of the public repository. Git ignore rules do not make clinical data safe.

## Handoff

Report repository path, active branch and commit, changed paths/purpose,
validation passed/failed/not run, push status and PR link/state. Explicitly say
whether `main` changed and whether that was observed remotely or performed in
this task. Explain navigation with safe commands for the user's actual shell.
If a PR was created, attach it to the current chat using the app tool when
available. Keep this installed workspace copy synchronized when its versioned
repository definition is updated; never overwrite unrelated project guidance.
