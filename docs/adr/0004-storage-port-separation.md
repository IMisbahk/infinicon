# ADR 0004: Separate Storage Ports

Status: Accepted

## Context

Infinicon must be storage-agnostic.

Different deployments may use Postgres, SQLite, object storage, vector databases, graph databases, search engines, or managed services. A single `StorageBackend` interface would either become too broad or force every backend to pretend it supports capabilities it does not actually provide.

## Decision

Infinicon will define separate storage ports:

- `EpisodeStore` for append-only raw memory events.
- `GraphStore` for links, provenance, and relationships.
- `IndexStore` for vector, lexical, or hybrid retrieval indexes.
- `MetadataStore` for scopes, ACLs, jobs, cursors, and runtime state.

A single adapter may implement multiple ports, but the contracts remain separate.

## Consequences

The runtime can support simple local development adapters and production adapters without changing the core API.

Storage capabilities can evolve independently. A Postgres adapter may implement every port; another deployment might use S3 for episodes, Qdrant for vectors, and Postgres for metadata.

The downside is more adapter complexity. That complexity is explicit and testable instead of hidden in a god interface.

## Alternatives Considered

### One storage backend interface

This looks simpler initially but becomes hard to evolve. Every new capability bloats the interface.

### Require Postgres for v1

Postgres is a strong reference target, especially with pgvector, but making it the core contract would violate storage agnosticism.

### Expose database-specific APIs

This would make some implementations powerful but would break portability.

## Follow-Up Work

- Draft `storage-ports.v0.md`.
- Define required vs optional port capabilities.
- Build conformance tests for each port once implementation starts.
