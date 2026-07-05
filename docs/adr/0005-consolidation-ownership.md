# ADR 0005: Consolidation Ownership

Status: Accepted

## Context

Memory consolidation may require model calls, custom business rules, budget limits, and domain-specific judgment.

If Infinicon hard-codes one summarization model or one consolidation algorithm, it becomes model-coupled and expensive to operate in environments with different latency, privacy, cost, or compliance requirements.

At the same time, consolidation is a core memory lifecycle concept. The runtime cannot ignore it.

## Decision

Infinicon will own the consolidation lifecycle and plugin contract, but not a single required consolidation implementation.

The reference server may ship an optional default consolidator. Production users may replace it with their own plugin or external workflow.

The runtime owns:

- Scheduling consolidation.
- Selecting source memory.
- Passing inputs to the consolidator contract.
- Storing consolidation outputs.
- Preserving provenance.
- Marking stale, failed, superseded, or tombstoned consolidation state.

The consolidator plugin owns:

- Model provider selection.
- Prompting or non-LLM synthesis logic.
- Cost and latency trade-offs inside the plugin.
- Domain-specific merge behavior.

## Consequences

Infinicon remains model-agnostic while still treating consolidation as a first-class memory lifecycle event.

Users can choose cheap, local, deterministic, or high-quality model-backed consolidators depending on their environment.

The plugin boundary must be carefully specified so bad consolidators cannot corrupt provenance or silently erase source memory.

## Alternatives Considered

### Built-in LLM consolidation only

This is easier to demo but creates vendor, latency, and cost coupling.

### External consolidation only

This keeps the runtime small but weakens the memory lifecycle story and makes default deployments incomplete.

### No consolidation in v0

This would make Infinicon little more than persistent retrieval. It would fail the long-term memory goal.

## Follow-Up Work

- Draft the consolidator plugin interface.
- Define consolidation failure and retry semantics.
- Define how tombstones invalidate derived consolidations.
