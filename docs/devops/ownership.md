# DevOps Ownership

This branch owns repository-level guardrails that support all subsystem teams without redefining core runtime architecture.

## In scope

- CI workflows for deterministic validation.
- Repository integrity checks for spec/docs consistency.
- Tooling tests for guardrail reliability.
- Contributor-facing docs for local verification.

## Out of scope

- Runtime memory semantics implementation.
- Storage adapter implementation.
- Plugin implementation.
- Agent orchestration features.

Those are owned by their respective subsystem teams and must follow published specs in `docs/specs/`.

## Integration contract with other teams

- Checks should fail with actionable errors.
- Guardrails must remain dependency-light and portable.
- CI must stay fast enough to run on all feature branches.
- Validation rules must track accepted architecture/spec documents, not private branch assumptions.
