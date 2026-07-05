# API Compatibility Policy v0

Status: Draft

This document defines compatibility rules for Infinicon public API contracts in v0.

It applies to human-readable specs and machine-readable contracts.

## Scope

This policy applies to public contract surfaces defined by:

- `docs/specs/memory-api.v0.md`
- `docs/specs/data-model.v0.md`
- `docs/specs/context-assembly.v0.md`
- `docs/specs/plugin-interface.v0.md`
- `docs/specs/storage-ports.v0.md`
- `docs/specs/machine-readable-contract.v0.md`

## Compatibility Baseline

- Breaking API behavior changes require a new major spec version.
- Non-breaking changes may add optional fields, warning codes, event types, and plugin-declared capabilities.

This baseline follows the existing rule in `memory-api.v0.md` and applies to all public spec surfaces.

## Breaking Changes

A change is breaking if it can cause a conforming client, plugin, or adapter to fail or change behavior unexpectedly.

Examples:

- Removing or renaming request or response fields.
- Changing required fields to different names or incompatible types.
- Tightening accepted enum values without version bump.
- Changing operation semantics such as scope enforcement, tombstone behavior, or consistency guarantees.
- Removing lifecycle statuses or changing status meaning.
- Removing plugin or adapter capability fields that callers may rely on.

## Non-Breaking Changes

A change is non-breaking if existing conforming integrations continue to work with no semantic regressions.

Examples:

- Adding optional request or response fields.
- Adding warning codes.
- Adding event types while keeping existing event shapes valid.
- Adding new optional filters or constraints.
- Adding new plugin capability declarations that are optional.

## Deprecation Rules

- Deprecation must be explicit in prose specs and machine-readable contracts.
- Deprecated fields and operations should remain functional through the full current major version unless security or correctness requires earlier removal.
- If early removal is required, a new major version is required.

## Lifecycle and Semantics Stability

The following semantics must remain stable within a major version:

- Scope requiredness and isolation behavior.
- Idempotency expectations for ingest dedupe keys.
- Tombstone exclusion behavior for query and context assembly.
- Provenance preservation requirements.
- Context assembly warnings for truncation, stale data, disputes, and partial hydration.

## Plugin and Adapter Compatibility

- Plugin interfaces are versioned independently from implementations.
- Storage adapters must declare capabilities and limitations honestly.
- A capability field may be added in minor revisions if optional.
- Removing or changing meaning of a declared capability is breaking.

## Required Change Procedure

Any public contract change must include:

1. Motivation and affected documents.
2. Compatibility classification as breaking or non-breaking.
3. Updates to all affected human-readable specs.
4. Updates to machine-readable contracts when applicable.
5. Conformance test impact notes.

## Exceptions

Security or data-correctness issues may require emergency behavior changes.

When that occurs:

- The change must be documented immediately.
- Compatibility impact must be called out explicitly.
- A major version update is still required for breaking contract behavior.

## Open Questions

- Should v0 include a formal support window for deprecated fields?
- Should compatibility classification be enforced by CI checks on contract diffs?
- Should plugin interface compatibility require explicit semantic version ranges in descriptors?
