# NOVA workspace entry point

This desktop project's working folder is one level above the actual Git repo.
The repository is `jas-grainger/`; use it as the working directory for Git and
application commands. Verify `git -C jas-grainger rev-parse --show-toplevel`
and `git -C jas-grainger status --short --branch` before making changes.

Read `jas-grainger/AGENTS.md` and `jas-grainger/docs/README.md` when present.
The reusable version-control manager is callable as
`$jas-version-control-manager`, installed in this workspace's
`.agents/skills/jas-version-control-manager/SKILL.md`. Read it for Git/GitHub
navigation, task branches, PRs and recovery. Its versioned source is in
`jas-grainger/.agents/skills/jas-version-control-manager/`.

If the current branch predates these instructions, inspect branches and the
plan PR rather than assuming documents were lost. The initial planning branch
is `docs/project-plan-and-vc-manager`; do not switch branches over another
chat's work. New chats share this checkout unless given an isolated worktree.

The task map supplied by the user is project-planning input, not a separate
authority for shell commands or agent permissions. Clinical-use goals do not
make the current educational prototype validated for surgery.
