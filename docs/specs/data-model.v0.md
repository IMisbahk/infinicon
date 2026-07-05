# Data Model Specification v0

Status: Draft

This specification defines Infinicon's core memory primitives. It is intentionally vertical-agnostic. Domain-specific schemas belong in memory profiles or plugins unless they affect core memory semantics.

## Normative Language

The words must, must not, should, should not, and may are used in their usual specification sense.

## Design Goals

- Preserve raw provenance.
- Support knowledge evolution over time.
- Keep memory objects addressable and auditable.
- Allow storage and model implementations to vary.
- Avoid forcing all domains into one rigid ontology.

## Shared Fields

Every durable memory object must include:

- `id`: stable object identifier.
- `type`: object kind.
- `scope`: scope in which the object exists.
- `createdAt`: creation timestamp.
- `createdBy`: actor that created the object.
- `status`: lifecycle status.
- `metadata`: implementation-neutral key/value metadata.

Durable objects should include:

- `updatedAt` when the object is versioned or has lifecycle changes.
- `schemaVersion` for migration and compatibility.
- `provenance` when the object is derived.

## Scope

Every memory operation must be scoped.

The v0 logical scope model is:

- `tenantId`: isolation boundary for organizations or owners.
- `namespaceId`: logical memory collection within a tenant.
- `agentId`: optional writer or reader identity.
- `sessionId`: optional short-lived interaction boundary.

The exact identity and authorization model is deferred to a dedicated ADR, but unscoped ingest and query operations are invalid.

## Lifecycle Status

Memory objects may use these statuses:

- `active`: eligible for retrieval and context assembly.
- `disputed`: known to conflict with other memory.
- `superseded`: replaced by newer memory but retained for provenance.
- `tombstoned`: removed from normal use and retained only as a deletion marker.
- `pending`: accepted but not fully processed by asynchronous pipelines.
- `failed`: processing failed and requires retry or inspection.

Callers must be able to exclude disputed, superseded, or tombstoned objects from queries.

## Episode

An episode is an immutable raw event.

Episodes must be append-only. If a correction is needed, a new episode must be written and linked to the previous episode. Mutating an episode would destroy provenance.

Examples:

- User message.
- Agent response.
- Tool call.
- Tool result.
- External document import.
- User correction.
- System event.

Illustrative shape:

```typescript
type Episode = {
  id: string
  type: "episode"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "tombstoned" | "pending" | "failed"
  dedupeKey?: string
  contentType: string
  content: unknown
  metadata: Record<string, unknown>
}
```

### Episode Requirements

- Episodes must preserve original content or a content-addressed reference to it.
- Episodes must support idempotent ingest through a dedupe key or equivalent mechanism.
- Episodes must not be overwritten in place.
- Episodes may be excluded from retrieval while still available for audit.

## Atom

An atom is a versioned unit of extracted knowledge.

Atoms are derived from one or more episodes or consolidations. They are smaller than summaries and should represent one claim, decision, preference, constraint, or reusable observation.

Illustrative shape:

```typescript
type Atom = {
  id: string
  type: "atom"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "disputed" | "superseded" | "tombstoned" | "pending" | "failed"
  atomType: string
  content: string
  confidence?: number
  provenance: Provenance
  metadata: Record<string, unknown>
}
```

### Atom Requirements

- Atoms must retain provenance to source memory.
- Atoms should be independently retrievable.
- Atoms may be versioned by supersession rather than mutation.
- Contradictory atoms must be represented explicitly, not silently overwritten.

## Consolidation

A consolidation is a synthesized memory artifact over a set of source memories.

Consolidations are useful for long-term compression and stable context assembly. They must not erase the fact that they are derived.

Illustrative shape:

```typescript
type Consolidation = {
  id: string
  type: "consolidation"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "disputed" | "superseded" | "tombstoned" | "pending" | "failed"
  title?: string
  content: string
  sourceRefs: MemoryRef[]
  supersedes?: MemoryRef[]
  provenance: Provenance
  metadata: Record<string, unknown>
}
```

### Consolidation Requirements

- Consolidations must reference their source memory.
- Consolidations may supersede earlier consolidations.
- Consolidations must be invalidated or regenerated when required source memory is tombstoned.
- Consolidations should expose enough metadata for freshness and staleness checks.

## Link

A link is a typed relationship between memory objects.

Links make provenance and knowledge evolution explicit. Link types may be extended, but core link semantics must stay stable.

Initial core link types:

- `derived_from`
- `supports`
- `contradicts`
- `supersedes`
- `mentions`
- `same_as`
- `corrects`
- `invalidates`

Illustrative shape:

```typescript
type Link = {
  id: string
  type: "link"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "tombstoned"
  linkType: string
  from: MemoryRef
  to: MemoryRef
  metadata: Record<string, unknown>
}
```

### Link Requirements

- Links must not point across tenant boundaries unless an explicit cross-tenant sharing model exists.
- Links should be append-only.
- Links may be tombstoned if they were created in error.

## WorkingContext

Working context is an ephemeral response assembled for a task.

It is not durable memory unless explicitly ingested as a new episode. This prevents accidental feedback loops where every prompt assembly permanently changes memory.

Illustrative shape:

```typescript
type WorkingContext = {
  scope: Scope
  task: string
  budget: ContextBudget
  segments: ContextSegment[]
  tokenEstimate: number
  truncated: boolean
  warnings: ContextWarning[]
  generatedAt: string
}
```

Each segment should include:

- `ref`: memory reference.
- `content`: hydrated content or selected excerpt.
- `score`: ranking score.
- `reason`: short explanation for inclusion.
- `provenance`: source chain.

## Provenance

Derived memory must explain where it came from.

At minimum, provenance should include:

- Source memory refs.
- Plugin or actor that produced the derived object.
- Creation time.
- Transformation type.
- Optional confidence or quality metadata.

Provenance must be preserved through consolidation chains. If memory is derived from derived memory, callers must be able to trace back to original episodes where retention policy allows.

## Tombstones

Tombstoning removes content from normal use without allowing accidental resurrection.

When a source object is tombstoned:

- Direct indexes must remove or hide the content.
- Derived atoms and consolidations must be marked for review, regeneration, or tombstoning depending on cascade policy.
- Working context must not include tombstoned content.
- Provenance may retain deletion markers without retaining deleted content.

The exact cascade policies are defined in the consistency and security documents.

## Memory Profiles

The core data model intentionally avoids domain-specific object types like `CodeDecision`, `ResearchCitation`, or `CustomerPreference`.

Those should be implemented as memory profiles that map onto atoms, consolidations, links, and metadata. A profile may define stronger validation rules without changing the core runtime.

## Open Questions

- Should `confidence` be core or profile-specific?
- Should link types be centrally registered or plugin-scoped?
- Should `agentId` belong in scope, actor metadata, or both?
- How strict should cross-namespace links be in v0?
