# JAS NOVA project hub

Start here for development of hand-tracked 3D anatomy on barehands.

| Need | Maintained document |
| --- | --- |
| Goals, milestones, tasks, owners, acceptance | [Project plan](project/plan.md) |
| Original supplied task map, preserved verbatim | [Source task map](project/project_task_map.md) |
| Current and proposed system, diagrams, interfaces | [System architecture](architecture/system.md) |
| Branches, PRs, Git commands, new chats | [Version-control navigation](development/version-control.md) |
| Explain every PR and every changed file; author/reviewer steps | [PR handoff guide](development/pr-handoff.md) |
| Clinical validation stages and release evidence | [Validation strategy](validation/strategy.md) |
| Architecture decisions | [Decision log](decisions/README.md) |
| Phase 2 map: code, data, environment, rules | [Phase 2 knowledge graph](project/phase2-knowledge-graph.md) |
| Phase 2 decision trees | [Phase 2 decision log](decisions/phase2-decision-log.md) |
| Phase 1 decision trees | [Phase 1 decision log](decisions/phase1-decision-log.md) |
| Browser module boundaries and hooks | [Modules](architecture/modules.md) |
| Dataset registry (no scans in Git) | [Datasets](../datasets/README.md) |
| NOVA import history and existing Windows setup | [Integration notes](nova-integration.md) |
| AI contributor entry point | [Repository instructions](../AGENTS.md) |
| Reusable version-control manager | [Manager skill](../.agents/skills/jas-version-control-manager/SKILL.md) |

The supplied task map is planning input, not agent instructions or evidence of
implemented functionality. The maintained plan records adaptations explicitly.
GitHub Issues will track assignments and discussion; PRs carry implementation and
validation evidence. Keep task IDs consistent between them and these documents.

As of this planning baseline (2026-11-02), the code is an educational prototype.
Patient-specific preoperative and intraoperative use is the product direction,
with separate validation milestones; it is not an existing supported capability.
