# Open Decisions Register

This register centralizes unresolved design decisions that already exist across roadmap, architecture docs, ADR follow-ups, and v0 specs.

It does not introduce new decisions.

## Prioritization

Priority order uses roadmap phase ordering and architectural dependency:

1. Contract and transport decisions needed for machine-readable contracts.
2. Identity and authorization decisions needed for secure implementation.
3. Storage and adapter behavior decisions needed for production adapters.
4. Plugin host and runtime operation decisions needed for production hardening.

## Contract and Transport

### Transport strategy for first machine-readable API

- Decision: REST, gRPC, or both
- Source: `docs/roadmap.md`, `docs/specs/memory-api.v0.md`, `docs/adr/0002-hybrid-deployment-model.md`
- Impact: schema generation, SDK generation strategy, conformance harness wiring

### Streaming behavior

- Decision: whether query and assemble support streaming partial results in v0
- Source: `docs/specs/memory-api.v0.md`
- Impact: API contract complexity and client behavior

### Pagination contract across heterogeneous adapters

- Decision: how pagination must behave for mixed storage capabilities
- Source: `docs/specs/memory-api.v0.md`
- Impact: cross-adapter compatibility and deterministic retrieval behavior

## Identity, Scope, and Security

### Initial authentication mechanism

- Decision: first auth mechanism for reference server
- Source: `docs/roadmap.md`, `docs/architecture/security.md`
- Impact: authorization model, SDK auth helpers, deployment defaults

### Identity and authorization model depth

- Decision: concrete model for tenant, namespace, agent, and session authority
- Source: `docs/adr/README.md` deferred decisions, `docs/specs/data-model.v0.md`
- Impact: enforcement semantics for all operations

### Namespace-level retention policy requirements

- Decision: mandatory or optional retention policy at namespace scope
- Source: `docs/architecture/security.md`
- Impact: deletion guarantees and compliance posture

## Storage and Consistency

### Primary index definition for indexed ingest

- Decision: indexed ingest waits on lexical, vector, or declared primary index set
- Source: `docs/architecture/consistency.md`
- Impact: ingest latency and read-your-writes guarantees

### Tombstone cascade depth and default behavior

- Decision: graph-depth limits and default cascade strategy
- Source: `docs/architecture/consistency.md`
- Impact: safety, latency, and derived-memory correctness

### Adapter migration versioning

- Decision: versioning strategy for adapter migrations
- Source: `docs/specs/storage-ports.v0.md`
- Impact: production upgrade reliability

### Transaction boundaries across ports

- Decision: which operations require cross-port transactional guarantees
- Source: `docs/specs/storage-ports.v0.md`
- Impact: correctness under partial failures

## Plugin and Runtime Operations

### Plugin loading strategy in v0

- Decision: dynamic loading vs static linking
- Source: `docs/specs/plugin-interface.v0.md`
- Impact: deployment model and operational safety

### Plugin descriptor schema language

- Decision: JSON Schema, Cue, or alternative
- Source: `docs/specs/plugin-interface.v0.md`
- Impact: validation tooling and SDK generation

### Plugin resource accounting in core host

- Decision: degree of runtime accounting in v0 plugin host
- Source: `docs/specs/plugin-interface.v0.md`
- Impact: operational controls and observability expectations

## Data Model and Context Assembly

### Confidence field ownership

- Decision: confidence as core field or profile-specific extension
- Source: `docs/specs/data-model.v0.md`, `docs/adr/0003-memory-primitives.md`
- Impact: core schema stability and profile ergonomics

### Link type governance

- Decision: centrally registered vs plugin-scoped link types
- Source: `docs/specs/data-model.v0.md`
- Impact: interoperability and extension safety

### Context ordering default

- Decision: chronology, relevance, or dependency-graph default order
- Source: `docs/specs/context-assembly.v0.md`
- Impact: agent usability and reproducibility

### Context quality evaluation

- Decision: conformance metrics for context quality
- Source: `docs/specs/context-assembly.v0.md`
- Impact: testability and implementation comparability

## Program-Level Deferred Decisions

### Reference implementation language

- Source: `docs/roadmap.md`, `docs/adr/README.md`

### First SDK language

- Source: `docs/roadmap.md`

### License

- Source: `docs/roadmap.md`, `docs/adr/README.md`

### First production storage adapter

- Source: `docs/roadmap.md`

## Maintenance Rule

When an open decision is resolved:

1. Update the source spec or ADR first.
2. Remove or mark resolved in this register.
3. Link to the decision artifact that resolved it.
