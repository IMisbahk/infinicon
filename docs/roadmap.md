# Roadmap

This roadmap is intentionally documentation-first. Implementation should emerge from accepted specifications, not the other way around.

## Phase 0: Architecture Foundation

Goal: define the project before building it.

Deliverables:

- Vision and glossary.
- Architecture overview.
- System boundaries.
- Consistency model.
- Security model.
- Data model specification.
- Memory API specification.
- Plugin interface specification.
- Storage ports specification.
- Context assembly specification.
- ADRs for foundational decisions.
- Contribution and review process.

Exit criteria:

- v0 specs are internally consistent.
- No unresolved P0 semantic gaps around provenance, deletion, consistency, or scoping.
- Major decisions are captured in ADRs.

## Phase 1: Machine-Readable Contract

Goal: turn accepted prose specs into implementable contracts.

Deliverables:

- OpenAPI, Protobuf, or both.
- Generated request and response shapes.
- API compatibility policy.
- Initial conformance test plan.

Exit criteria:

- Human-readable specs and machine-readable schemas agree.
- Public API changes require spec updates.

## Phase 2: Reference Skeleton

Goal: prove the API and storage ports can run end to end.

Deliverables:

- Reference server skeleton.
- Health endpoint.
- In-memory development adapters.
- `ingest`, `query`, `hydrate`, and `assembleContext` paths.
- First thin client SDK.

Exit criteria:

- The skeleton passes early conformance tests.
- No production storage assumptions leak into the public API.

## Phase 3: Retrieval and Context Assembly

Goal: make the runtime useful for real agent tasks.

Deliverables:

- Embedder plugin interface implementation.
- Ranker plugin interface implementation.
- Context budgeting.
- Segment ordering and warning behavior.
- Retrieval quality test fixtures.

Exit criteria:

- `assembleContext` returns structured, provenance-preserving context under budget.
- Empty, stale, disputed, and truncated cases are covered by tests.

## Phase 4: Evolution Pipeline

Goal: implement long-term memory evolution.

Deliverables:

- Extractor plugin.
- Consolidator plugin.
- Async job system.
- Supersession and contradiction handling.
- Tombstone cascade jobs.

Exit criteria:

- Derived memory preserves provenance.
- Consolidation failures do not corrupt active memory.
- Tombstoned source memory cannot resurface through derived memory without warnings or policy.

## Phase 5: Production Hardening

Goal: make the reference server credible in production.

Deliverables:

- Postgres plus pgvector adapter or equivalent production adapter.
- Authentication and authorization.
- Metrics and tracing hooks.
- Backup, restore, and migration guidance.
- Deployment guide.

Exit criteria:

- Production adapter passes conformance tests.
- Operational failure modes are documented.
- Security defaults are explicit.

## Open Decisions

- Reference implementation language.
- First SDK language.
- License.
- Initial auth mechanism.
- First production storage adapter.
- Transport strategy: REST, gRPC, or both.
