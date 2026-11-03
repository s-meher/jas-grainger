# Project-plan and reusable-manager validation

Date: 2026-11-02. Scope: documentation, project instructions, skill metadata,
source-map preservation and ignore rules. No application runtime changed.
The commit containing this record is the planning baseline under review.

## Checks performed

- Original Downloads task map matches `docs/project/project_task_map.md`
  byte-for-byte; SHA-256:
  `C70BD032CCB9622D01B01ED65CB90A6063797F0086FE1E84F1561E8B663DE85B`.
  `.gitattributes` disables text conversion for that source artifact.
- All 29 original task IDs have explicit rows in the maintained plan.
- Relative Markdown file links resolve, and fenced code blocks are balanced.
- Skill Creator's `quick_validate.py` passes for both the versioned repository
  skill and the installed parent-workspace copy. The local Python lacked PyYAML;
  it was installed only into ignored `scratch/skill-validation`, not globally.
- Parsed `agents/openai.yaml`: description length is within the creator's
  bounds; default prompt explicitly invokes `$jas-version-control-manager`.
- Installed skill and workspace entry point match their versioned sources.
- `git check-ignore data/example.dcm artifacts/derived.glb private-data/scan.nii`
  confirms the local work areas are ignored. This does not test data security.
- `git diff --check` passes.

Commands for the skill check from the Git root:

```powershell
$env:PYTHONUTF8 = '1'
$env:PYTHONPATH = Join-Path (Get-Location) 'scratch\skill-validation'
python C:/Users/joeln/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/jas-version-control-manager
python C:/Users/joeln/.codex/skills/.system/skill-creator/scripts/quick_validate.py ../.agents/skills/jas-version-control-manager
```

The creator path is machine-specific; teammates should use their installed
Skill Creator validator. PyYAML is a tooling dependency, not an application one.

## Fresh-agent acceptance

A fresh read-only manager instance was given the installed skill and asked to
explain why NOVA files are visible, identify the actual branch, recommend the
branch/prerequisites for task 1.2, and explain invocation from another chat.
It discovered the installed skill, found the nested Git root, distinguished
local main from cached origin/main, identified the shared dirty planning
checkout, recommended isolation rather than switching it, and reported that
the planning PR must merge before new main-based branches inherit the docs.
It did not mutate files, branches or PRs. No blocking inconsistencies were found.

## Not exercised

Application suites and webcam/clinical evaluation were not re-run for this
documentation change. Mermaid source diagrams were reviewed for structure but
not rendered in a browser during this check. No branch rules, clinical approval,
dataset access or issue assignments were provisioned by the documentation.
