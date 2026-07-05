# Storage Ports Specification v0

Status: Draft

This specification defines the storage contracts Infinicon expects from adapters.

## Principle

Infinicon uses separate storage ports instead of one monolithic backend interface.

Adapters may implement any combination of ports, but must declare capabilities and limitations.

## EpisodeStore

Stores immutable raw episodes.

Required capabilities:

- Append episode.
- Fetch episode by ref.
- Fetch episodes by refs.
- Resolve dedupe key within scope.
- Tombstone episode.

Required guarantees:

- Episodes are not overwritten in place.
- Dedupe lookup is scoped.
- Tombstoned content is excluded from normal reads.

## GraphStore

Stores typed links and provenance relationships.

Required capabilities:

- Add link.
- Fetch outgoing links.
- Fetch incoming links.
- Fetch provenance chain.
- Tombstone link.

Required guarantees:

- Links are scoped.
- Cross-tenant links are rejected unless explicitly supported.
- Tombstoned links are excluded from normal traversal.

## IndexStore

Stores retrieval indexes.

Index implementations may be vector, lexical, hybrid, graph-aware, or custom.

Required capabilities:

- Index memory payload.
- Remove or hide indexed payload.
- Search by query payload.
- Search by filters.
- Report index freshness when available.

Required guarantees:

- Tombstoned memory is not returned as eligible.
- Adapter declares whether indexing is synchronous or eventual.
- Adapter declares score interpretation limits.

## MetadataStore

Stores runtime metadata.

Required capabilities:

- Store scopes.
- Store access metadata.
- Store async jobs.
- Store plugin state.
- Store event cursors.
- Append lifecycle events.
- Read lifecycle events from cursor.

Required guarantees:

- Job state transitions are durable.
- Scope metadata is available before memory operations execute.
- Runtime metadata is not exposed as memory content.
- Cursor ordering must be stable within a scope.
- Event append and cursor reads are scoped and authorization-aware at runtime integration boundaries.
- Tombstoned memory content must not be embedded directly in emitted event payloads.
- Adapters should declare event retention limits and cursor expiration behavior when they cannot retain events indefinitely.

## Adapter Capability Descriptor

Each adapter must declare:

- Implemented ports.
- Transactional guarantees.
- Maximum object sizes if known.
- Index consistency behavior.
- Pagination behavior.
- Supported filters.
- Backup and restore expectations if production-ready.

## Reference Adapter Expectations

The first development adapter may be simple and local.

A production adapter must document durability, backup, restore, migration, and failure behavior. A Postgres plus pgvector adapter is a strong first production target, but not part of the core contract.

## Machine-Readable Contracts

The following machine-readable artifacts mirror this draft spec and should stay aligned with it:

- `docs/contracts/storage-ports.v0.json`
- `docs/contracts/storage-ports.v0.schema.json`
- `docs/contracts/storage-adapter-capabilities.v0.schema.json`
- `docs/contracts/examples/storage-adapter-capabilities.pgvector.example.v0.json`
- `docs/contracts/examples/storage-adapter-capabilities.local-dev.example.v0.json`

These artifacts are contract aids and do not supersede the human-readable specification.

Validation command:

```bash
python3 docs/contracts/validate_storage_contracts.py
```

For contract maintenance conventions, see `docs/contracts/README.md`.

## Open Questions

- Which port operations require transactions across ports?
- Should v0 require cursor pagination for every list operation?
- How should adapter migrations be versioned?
- Should event retention be configured per namespace or globally?
