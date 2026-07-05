# Machine-Readable Contract Specification v0

Status: Draft

This document defines how Infinicon converts accepted human-readable specifications into machine-readable contracts.

It is a process and contract-shape document only.

It does not change runtime architecture, deployment model, or memory semantics.

## Scope

This specification applies to:

- `docs/specs/memory-api.v0.md`
- `docs/specs/data-model.v0.md`
- `docs/specs/plugin-interface.v0.md`
- `docs/specs/storage-ports.v0.md`
- `docs/specs/context-assembly.v0.md`

## Goals

- Keep prose specs as the source of truth.
- Publish machine-readable contracts that match accepted prose behavior.
- Support conservative transport evolution without changing semantics.
- Enable generated request and response shapes for SDKs and conformance tests.

## Artifacts

v0 machine-readable artifacts should include:

- OpenAPI contract for HTTP transport.
- Protobuf contract for gRPC transport.
- Generated language-agnostic schema bundle for stable request and response shapes.

If only one transport is shipped first, the missing transport may remain deferred, but semantic fields and behavior must remain aligned with prose specs.

## Contract Source Mapping

### Memory API

`docs/specs/memory-api.v0.md` is the normative source for operation semantics.

Machine-readable contracts must define these operations and shapes:

- `ingest`
- `query`
- `hydrate`
- `assembleContext`
- `consolidate`
- `tombstone`
- `subscribe`
- `getJob`

### Data Model

`docs/specs/data-model.v0.md` is the normative source for object lifecycle and field semantics.

Machine-readable contracts must model:

- Core durable object identities and shared fields.
- Scope fields and required scoping behavior.
- Lifecycle statuses and constraints.
- Provenance requirements.
- Working context response structure.

### Plugins and Storage Ports

`docs/specs/plugin-interface.v0.md` and `docs/specs/storage-ports.v0.md` are normative for capability declarations and behavior claims.

Machine-readable artifacts must include typed capability descriptors for:

- Plugin descriptors and plugin kind-specific contracts.
- Storage adapter capability descriptors.
- Consistency and transaction guarantees that adapters claim.

## Generation Rules

- Code generation must not invent new runtime semantics.
- Generated shapes must preserve field names, requiredness, and enums from accepted prose specs.
- Optional fields may be added only where prose already allows optionality.
- Any generated default values must be documented and must not change semantic behavior.

## Change Control

- A machine-readable change is invalid if it introduces behavior not present in accepted prose specs.
- A prose change that affects request, response, error, lifecycle, or compatibility behavior must update machine-readable artifacts in the same change.
- If transport constraints force divergence, the prose spec must be updated first and the divergence must be documented explicitly.

## Validation Pipeline

Each machine-readable contract update should include:

1. Schema validation.
2. Contract linting.
3. Diff classification as breaking or non-breaking.
4. Regeneration of typed shapes.
5. Conformance test impact review.

## Versioning

- `v0` prose specs map to `v0` machine-readable contracts.
- Breaking contract changes require a new major contract version and corresponding prose version update.
- Non-breaking changes may add optional fields, warning codes, event types, and capabilities already allowed by prose specs.

## Deferred in v0

- Stable wire-format guarantees across both OpenAPI and Protobuf in the same milestone.
- Streaming semantics for query or context assembly.
- Cross-transport canonical pagination contract.

These are deferred until the related open questions are resolved in the relevant specs or ADRs.

## Open Questions

- Should OpenAPI and Protobuf be mandatory in the first machine-readable release or staged sequentially?
- Should machine-readable artifacts be committed manually, generated in CI, or both?
- Should a single canonical schema source generate both OpenAPI and Protobuf representations?
