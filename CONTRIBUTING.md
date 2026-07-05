# Contributing to Infinicon

Infinicon is currently in a spec-first architecture phase.

The most valuable contributions right now are clear specifications, challenged assumptions, edge cases, and ADRs. Production code should wait until the relevant v0 spec is accepted.

## Contribution Principles

- Keep the core runtime small.
- Update specs before changing behavior.
- Use ADRs for major decisions.
- Prefer interfaces over implementations.
- Preserve storage, model, and framework independence.
- Document trade-offs honestly.

## Before Opening a Pull Request

Ask:

- Does this change affect public memory semantics?
- Does it cross the boundary into agent orchestration?
- Does it require an ADR?
- Does it update the relevant spec?
- Does it preserve provenance, scoping, consistency, and deletion behavior?

If the answer is unclear, open a design issue before writing implementation.

## Spec Changes

Spec changes should include:

- Motivation.
- Affected documents.
- Compatibility impact.
- Alternatives considered.
- Open questions.

If a changed prose spec has a machine-readable draft counterpart, update it in the same change and run:

```bash
python3 docs/specs/validate-machine-readable.py
python3 docs/specs/run-conformance.py
```

Breaking changes require a new major spec version once versioning begins.

See `docs/specs/README.md` for machine-readable artifact workflow.

## ADR Changes

Do not rewrite accepted ADR history to make old decisions look cleaner.

If a decision changes, create a new ADR that supersedes the old one.

## Code Contributions

Code contributions are expected later, after spec v0 stabilizes.

When implementation begins:

- Keep diffs small.
- Add tests for behavior, not just happy paths.
- Avoid dependencies unless they are justified by an ADR or accepted design.
- Do not couple the core runtime to one storage backend, model provider, or agent framework.

## Documentation Style

Write plainly. Prefer precise terms from the glossary.

Do not use marketing language where a technical definition is needed. For example, explain "unbounded effective memory" rather than implying an infinite model context window.

## Review Standard

A good review should challenge:

- Hidden coupling.
- Missing failure modes.
- Weak deletion semantics.
- Unclear provenance.
- Inconsistent scope handling.
- Spec behavior that cannot be implemented or tested.
