# Architecture Decision Records

Architecture Decision Records document important project decisions.

ADRs are required when a change affects public specifications, system boundaries, deployment model, storage contracts, plugin contracts, security posture, or long-term compatibility.

## ADR Format

Each ADR should include:

- Title.
- Status.
- Context.
- Decision.
- Consequences.
- Alternatives considered.
- Follow-up work.

## Status Values

- `Proposed`: under discussion.
- `Accepted`: approved and active.
- `Superseded`: replaced by a newer ADR.
- `Rejected`: considered and intentionally not adopted.

## Process

1. Create a proposed ADR before implementing the decision.
2. Link related specifications and issues.
3. Discuss trade-offs explicitly.
4. Accept the ADR before merging implementation that depends on it.
5. Supersede rather than rewrite history when decisions change.

## Current ADRs

- [0001: Spec-First Development](0001-spec-first-development.md)
- [0002: Hybrid Deployment Model](0002-hybrid-deployment-model.md)
- [0003: Core Memory Primitives](0003-memory-primitives.md)
- [0004: Separate Storage Ports](0004-storage-port-separation.md)
- [0005: Consolidation Ownership](0005-consolidation-ownership.md)

## Deferred Decisions

- Reference implementation language.
- Identity and authorization model.
- License.
- Multi-tenancy depth and sharding model.
- REST, gRPC, or dual transport for the first machine-readable API.
