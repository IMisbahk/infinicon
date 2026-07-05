# Spec Review Process

This document defines how Infinicon reviews and accepts specification changes.

It operationalizes ADR 0001 spec-first development.

## Scope

This process applies to:

- Vision and architecture docs that define runtime behavior boundaries.
- v0 specifications in `docs/specs/`.
- ADRs that change public contracts, boundaries, or compatibility posture.

## Principles

- Specs are the source of truth.
- Behavior changes require spec updates first.
- Review must challenge hidden coupling and unclear semantics.
- Acceptance requires explicit compatibility classification.

## Change Types

### Clarification

No semantic behavior change.

Examples:

- Wording cleanup.
- Cross-link improvement.
- Typo fixes.

### Non-Breaking Semantic Change

Adds optional behavior or fields without breaking existing conforming integrations.

Examples:

- New optional warning code.
- New optional filter.
- New optional plugin capability declaration.

### Breaking Semantic Change

Changes required behavior or removes compatibility for existing conforming integrations.

Examples:

- Required field shape changes.
- Tightened enum constraints.
- Changed tombstone or consistency semantics.

Breaking changes require a new major spec version.

## Required Inputs for Spec PRs

Every semantic spec PR should include:

- Motivation.
- Affected documents.
- Compatibility classification.
- Alternatives considered.
- Open questions.
- Machine-readable contract impact.
- Conformance test impact.

These requirements extend the checklist in `CONTRIBUTING.md`.

## Review Checklist

Reviewers should verify:

- Scope and tenancy behavior remains explicit.
- Provenance requirements remain implementable.
- Deletion and tombstone semantics remain safe.
- Consistency guarantees and downgrade rules are explicit.
- Plugin and storage contracts avoid hidden coupling.
- Error and warning behavior is observable and testable.
- Prose and machine-readable contracts remain aligned.

## Acceptance Criteria

A semantic spec change is accepted only when:

1. Required inputs are present.
2. Compatibility classification is agreed.
3. Related docs are updated consistently.
4. Machine-readable impacts are documented.
5. Conformance impact is documented.

## Merge Gates

For semantic changes, merges should be blocked if:

- Compatibility classification is missing.
- Related spec docs are inconsistent.
- Machine-readable update impact is not addressed.
- Conformance impact is not addressed.

## Post-Acceptance

After acceptance:

- Update roadmap references when milestones are affected.
- Update ADR links when decisions are superseded.
- Ensure follow-up implementation work references accepted specs.

## Deferred

- Formal reviewer quorum rules.
- Automated compatibility diff enforcement.
- CI-based semantic linting for spec language.
