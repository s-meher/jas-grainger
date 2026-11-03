# Pull request handoff and review guide

Every PR should let an engineer answer: **What does this change do, where should
I start reading, what does each changed file contain, and how was it checked?**
The PR description is the canonical handoff. Use the repository's
[PR template](../../.github/pull_request_template.md), keep it current after
new pushes, and write for someone who has not read the author's chat.

## Author: prepare a reviewable handoff

1. **State the outcome.** Describe the problem, the resulting behavior and the
   boundaries of this PR. Name task IDs, Issues and prerequisite PRs. Distinguish
   proposed architecture from implemented behavior.
2. **Give a review route.** Link the entry point, then list the files to read in
   dependency order. Explain how the parts fit together and identify the areas
   needing specialist review (data, graphics, interaction or clinical content).
3. **Explain every changed file.** Add one row per added, modified, deleted or
   renamed file to the file map below. Include what the file contains and what
   this PR changes in it. Do not substitute a folder name or "miscellaneous
   updates" for individual files. Include config, schemas, tests and assets.
4. **Make verification reproducible.** Give the working directory, prerequisites,
   exact commands or manual steps, expected results and actual results. Separate
   passed, failed, skipped and not-run checks. Link non-sensitive evidence.
5. **Explain integration.** Name the base/head branches, dependencies, compatibility
   changes, setup/migration steps and known limitations. State rollback guidance
   proportionate to the change. Never put patient data or credentials in a PR.
6. **Refresh before requesting review.** Compare the file map to GitHub's complete
   Files changed list after the last push. Update the description after changes;
   a comment can explain a revision but does not replace the maintained handoff.

### File-map format

| File | Change | Contents and purpose of this change |
| --- | --- | --- |
| `path/to/file` (linked) | Added / Modified / Deleted / Renamed | What this file is responsible for, what changed, and why the reviewer should read it. |

Use real file links in the submitted PR. For added/modified files, prefer GitHub
permalinks to the PR head commit (`/blob/<head-SHA>/<path>`), or a verified diff
link. For a deleted file, link its base revision and explain the deletion. For
renames, show both old and new paths. Refresh commit links when a new push changes
the reviewed revision; the PR's Files changed tab remains the authoritative diff.

For a model/image/other binary, explain its role, provenance/license, expected
size and how to inspect or regenerate it; a line diff cannot explain its contents.
If a PR is too large for a readable body, link a versioned handoff appendix that
still inventories every file, and keep the summary/review route in the PR body.

### Obtain the actual file inventory

GitHub: open the PR, select **Files changed**, and compare every filename with
the map. Use **Commits** to understand revisions and **Conversation** for the
handoff, checks, unresolved questions and review status.

Locally, from the repository root on the PR branch (these Git commands work in
PowerShell, Bash and other common shells):

```text
git status --short --branch
git fetch origin
git diff --name-status --find-renames origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

These examples assume the PR targets `main`; substitute the actual base for a
stacked PR. The three-dot diff uses the merge base, matching task changes rather
than unrelated changes added to main. Uncommitted files are not part of a PR;
check both `git diff` and `git diff --cached` while preparing a commit. After a
merge, use the GitHub PR's historical diff rather than assuming this command
still shows the original changes.

## Reviewer: explore and verify

1. Read the summary, task/Issue and prerequisites; check the intended base/head.
2. Follow the review route and file map. Use **Files changed** to read the actual
   patches, including config/schema/test changes. Raise a question if any file
   is unexplained, has unrelated edits or contains unexpected assets.
3. Run relevant verification in an isolated checkout/worktree. Another chat may
   be using the author's checkout; a browser branch selection does not switch
   local files. See the [Git navigation guide](version-control.md).
4. Assess whether test evidence covers the claimed behavior and whether manual
   work remains. Review diagrams/contracts against the implementation. Clinical
   readiness is separate from software review.
5. Submit **Approve**, **Request changes**, or **Comment** on GitHub as appropriate.
   Approval and merging are separate actions; the assigned maintainer merges
   after required reviews/checks. Do not treat a successful push as approval.

## When this standard takes effect

After this planning PR is merged into the default branch, GitHub will offer the
updated template when engineers open new PRs. Templates do not retroactively
update existing PR descriptions; their authors should paste/fill the same
sections manually. The current planning PR is updated to demonstrate the format.

This is a shared author/reviewer convention, not an automated completeness
check or a GitHub branch-protection rule. The version-control manager checks the
file inventory when preparing PRs; engineers using other tools follow the same
guide and template. No particular editor, operating system or Codex setup is
required.
