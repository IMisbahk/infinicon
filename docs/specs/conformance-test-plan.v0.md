# Conformance Test Plan v0

Status: Draft

This document defines the initial conformance strategy for Infinicon v0 contracts.

It is a test-plan document, not an implementation test suite.

## Goals

- Verify that implementations match accepted v0 specifications.
- Verify that adapters and plugins honor declared capabilities.
- Catch semantic regressions before public contract changes merge.

## Scope

Conformance applies to:

- Public API operations.
- Data model lifecycle behavior.
- Context assembly behavior.
- Storage port contracts.
- Plugin interface contracts.

## Test Levels

### Level 1: Contract Shape Conformance

Ensures request and response schema compatibility.

Checks include:

- Required and optional field presence.
- Enum value validity.
- Error shape compatibility.
- Event payload compatibility.

### Level 2: Semantic Operation Conformance

Ensures behavior matches prose specs.

Checks include:

- `ingest` idempotency with dedupe keys.
- `query` returning refs instead of hydrated objects.
- `hydrate` reporting missing refs.
- `assembleContext` token estimate, truncation, and warnings.
- `tombstone` exclusion from query and context results.
- `consolidate` and `getJob` lifecycle state visibility.

### Level 3: Storage Port Conformance

Each storage port is tested independently.

Checks include:

- `EpisodeStore` append-only and scoped dedupe behavior.
- `GraphStore` scoped link traversal and provenance chain behavior.
- `IndexStore` tombstone exclusion and freshness reporting.
- `MetadataStore` durable job state transitions and scope metadata readiness.

### Level 4: Plugin Contract Conformance

Checks each plugin kind against contract behavior.

Checks include:

- Descriptor completeness.
- Kind-specific input and output shape validity.
- Provenance requirements for extractor and consolidator outputs.
- Determinism declarations for embedder and ranker where applicable.
- No unauthorized mutation of source memory.

## Core Test Matrix

Implementations should be tested against this matrix:

- Consistency mode: `accepted` and `indexed` ingest.
- Read consistency: `strong` and `eventual`.
- Lifecycle status filters: active, disputed, superseded, tombstoned.
- Cascade policy: `none`, `mark_derived_stale`, `tombstone_derived`.
- Empty-context, truncated-context, and partial-hydration cases.

## Required Fixtures

- Scoped multi-tenant fixture data.
- Contradictory atom fixture set.
- Supersession chain fixture set.
- Tombstone cascade fixture set.
- Stale consolidation fixture set.

Fixtures should be transport-agnostic and reusable across implementations.

## Failure Classification

Conformance failures are classified as:

- `shape_failure`: schema mismatch.
- `semantic_failure`: behavior mismatch.
- `capability_mismatch`: adapter or plugin claim mismatch.
- `stability_failure`: non-deterministic behavior in declared deterministic modes.

## Execution Model

- Contract shape checks should run on every public spec or contract change.
- Semantic conformance should run before release candidates.
- Adapter and plugin conformance should run before marking production-ready capability declarations.

## Exit Criteria for Phase 1

Phase 1 is complete when:

- Human-readable specs and machine-readable contracts are aligned.
- This conformance plan is accepted.
- At least one implementation path can execute Level 1 and Level 2 checks.

## Open Questions

- Should conformance tests be implementation-hosted or maintained as a separate compatibility suite?
- Should plugin conformance be self-reported by plugins, runner-enforced, or both?
- Should deterministic test mode be mandatory for all ranker plugins in v0?
