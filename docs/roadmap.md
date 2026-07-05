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
- Lifecycle event subscription and cursor semantics in machine-readable form.
- API compatibility policy ([spec](specs/api-compatibility-policy.v0.md)).
- Initial conformance test plan ([spec](specs/conformance-test-plan.v0.md)).
- Machine-readable contract mapping ([spec](specs/machine-readable-contract.v0.md)).

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

Implementation note:

- The reference runtime lives in `src/runtime/` (`MemoryRuntimeService`, in-memory adapters, contract tests).
- The Bun HTTP reference server entrypoint is `src/server.ts` (health endpoint, v0 memory API routes).
- The thin typed client SDK is `src/client.ts`. There is no standalone `runtime/` package.

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

Implementation note:

- Default plugins register via `src/runtime/pluginBootstrap.ts` (keyword extractor, simple embedder/ranker/consolidator).
- Retrieval fixtures live under `tests/fixtures/retrieval/`.

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

Implementation note:

- Async jobs drain via `JobRunner` (background poll in `src/server.ts`).
- Supersession applied when consolidator returns `supersedes`.
- Large tombstone cascades enqueue `tombstone_cascade` jobs (threshold: 5 refs).

## Phase 5: Production Hardening

Goal: make the reference server credible in production.

Deliverables:

- Postgres plus pgvector adapter or equivalent production adapter.
- Authentication and authorization.
- Metrics and tracing hooks.
- Backup, restore, and migration guidance.
- Deployment guide.

Implementation note:

- Postgres JSONB adapters in `src/runtime/adapters/postgresStores.ts` (set `DATABASE_URL`).
- Bearer auth middleware in `src/transport/auth.ts`.
- JSON metrics on `/health` and `/metrics`.
- Ops docs: `docs/devops/deployment.md`, `docs/devops/backup-restore.md`, `render.yaml`.

Exit criteria:

- Production adapter passes conformance tests.
- Operational failure modes are documented.
- Security defaults are explicit.

## Open Decisions

A centralized, source-linked register is maintained in [`open-decisions.md`](open-decisions.md).

Current program-level decisions:

- Reference implementation language.
- First SDK language.
- License.
- Initial auth mechanism.
- First production storage adapter.
- Transport strategy: REST, gRPC, or both.
