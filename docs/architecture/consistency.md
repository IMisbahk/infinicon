# Consistency Model

This document defines the initial consistency expectations for Infinicon.

Memory runtimes have multiple timelines: durable ingest, indexing, extraction, consolidation, and deletion cascade. Treating all of those as instantly consistent would be dishonest and expensive.

## Consistency Layers

### Durable Write Consistency

An ingested episode is durable when the `EpisodeStore` has accepted it and the runtime can return its ref.

Durable does not imply indexed, extracted, or consolidated.

### Index Consistency

Indexed means the memory can appear in query results.

Indexing may be synchronous or eventual depending on adapter and request consistency.

### Derivation Consistency

Derived memory includes atoms, links, and consolidations.

Derivation is usually asynchronous. Callers must not assume an ingested episode has immediately produced atoms or consolidations.

### Context Consistency

Context assembly depends on query, hydration, ranking, and budget application.

A context response must report warnings when it used eventual consistency, stale consolidations, partial hydration, or disputed memory.

## Write Semantics

Ingest supports two consistency modes:

- `accepted`: return once raw episodes are durable.
- `indexed`: return only after episodes are visible to query, or fail with a timeout or adapter error.

Extraction and consolidation remain asynchronous unless a future spec adds stronger modes.

## Read Semantics

Query and context assembly support:

- `strong`: prefer indexes and stores that include all writes acknowledged under compatible consistency.
- `eventual`: allow lower latency by using possibly stale indexes or consolidations.

If the runtime cannot provide requested strong consistency, it must fail or downgrade only when the caller explicitly allows downgrade.

## Read Your Writes

A caller that ingests with `consistency: "indexed"` and then queries the same scope with `consistency: "strong"` should be able to observe the newly indexed episode, assuming the same adapter supports that guarantee.

The runtime must document when an adapter cannot provide this.

## Idempotency

Ingest must be idempotent when a dedupe key is provided.

The dedupe key is scoped. The same key in different namespaces must not collide.

If a retry uses the same dedupe key with different content, the runtime should reject the request or return a conflict error rather than silently accepting divergent content.

## Asynchronous Jobs

Operations such as consolidation, large tombstone cascades, reindexing, and backfills may be asynchronous.

Job state must be durable and inspectable.

Job failures must not corrupt already active memory.

## Event Stream Consistency

Lifecycle events are derived from durable memory operations.

- Event delivery is at-least-once.
- Cursor ordering should be stable within a scope.
- Duplicate lifecycle events are valid and consumers must be idempotent.
- If a requested resume cursor is invalid or expired, the runtime should fail loud with a structured error.
- Strong consistency for subscription means no gap before the first returned event after a valid cursor.
- Eventual consistency for subscription may return delayed lifecycle events and should include an eventual-consistency warning when exposed in transport metadata.

Subscriptions are not a consensus log. They provide lifecycle awareness aligned with memory semantics.

## Contradictions

Contradictions are represented, not hidden.

When memory conflicts:

- Existing memory may be marked `disputed`.
- New competing memory may be created.
- A `contradicts` link should connect the competing objects.
- Consolidation may later resolve, preserve, or escalate the contradiction.

Context assembly should warn when disputed memory is included.

## Supersession

Supersession replaces memory for normal use without deleting provenance.

Superseded objects should be excluded from normal retrieval unless the caller asks for historical memory.

Consolidations should supersede older consolidations rather than mutating them in place.

## Tombstone Cascade

Tombstone behavior is one of the hardest parts of production memory.

Initial cascade policies:

- `none`: tombstone only the specified refs.
- `mark_derived_stale`: tombstone specified refs and mark derived memory for review or regeneration.
- `tombstone_derived`: tombstone specified refs and derived memory reachable through provenance links.

The runtime must remove or hide tombstoned content from indexes before returning successful completion for synchronous tombstone operations.

Large cascades may run as jobs. Until complete, context assembly must warn about cascade-in-progress if affected memory might be stale.

## Stale Memory

A memory object is stale when its sources, dependencies, or consolidation window changed after it was produced.

Stale memory may remain visible only if:

- It is not tombstoned.
- The caller allows stale memory.
- The response includes a warning.

## Failure Modes

The runtime should fail loud on semantic uncertainty.

Examples:

- Strong consistency requested but adapter supports only eventual consistency.
- Tombstone cascade cannot confirm index removal.
- Dedupe key conflict with mismatched content.
- Plugin produces derived memory without provenance.

Silent best-effort behavior is not acceptable for production memory semantics.

## Open Questions

- Should `indexed` ingest wait for lexical and vector indexes or only one declared primary index?
- Should deletion cascades be graph-depth limited by default?
- Should context assembly expose an `asOf` timestamp for reproducibility?
