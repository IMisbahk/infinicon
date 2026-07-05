# ADR 0003: Core Memory Primitives

Status: Accepted

## Context

Infinicon must represent memory across many agent domains without baking in one vertical such as coding, research, or customer support.

A simple fact table is too weak because agent memory changes over time, contradictions happen, and source auditability matters. A pure knowledge graph is also not enough because raw observations and synthesized summaries have different lifecycle semantics.

## Decision

Infinicon will define these core memory primitives:

- Episode: immutable raw event.
- Atom: versioned extracted unit of knowledge.
- Consolidation: synthesized memory artifact over source memory.
- Link: typed relationship between memory objects.
- WorkingContext: ephemeral assembled context for one task.

Domain-specific schemas must be implemented as memory profiles or plugins unless they change core memory semantics.

## Consequences

The runtime can preserve provenance while still supporting retrieval and compression.

Episodes remain auditable. Atoms allow fine-grained retrieval. Consolidations provide long-term compression. Links represent provenance, contradiction, support, and supersession.

The model is more complex than a vector-only memory store, but that complexity is necessary for production memory semantics.

## Alternatives Considered

### Facts, entities, and relations only

This works for some knowledge-graph use cases but underrepresents temporal history, raw observations, and consolidation lineage.

### Raw episodes only

This maximizes auditability but makes long-term retrieval and compression poor.

### Summaries only

This is simple but loses provenance and makes deletion cascade behavior hard to reason about.

## Follow-Up Work

- Define profile extension rules.
- Decide whether confidence is core or profile-specific.
- Define lifecycle transitions for disputed, superseded, and tombstoned objects.
