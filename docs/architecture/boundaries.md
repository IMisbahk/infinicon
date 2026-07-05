# System Boundaries

This document defines what Infinicon owns and what it deliberately does not own.

It should be used as a scope gate for architecture proposals, issues, plugins, and pull requests.

## Infinicon Owns

### Memory Lifecycle

Infinicon owns the lifecycle of memory objects:

- Ingest raw episodes.
- Extract atoms.
- Store provenance.
- Index memory for retrieval.
- Assemble working context.
- Consolidate and evolve memory over time.
- Represent contradictions and supersession.
- Tombstone memory and process deletion cascades.

The runtime must make these transitions explicit and observable.

### Memory Semantics

Infinicon defines what memory means in production:

- Which objects are immutable, versioned, superseded, disputed, or deleted.
- How derived memories trace back to source episodes.
- How consistency is requested by callers and reported by the runtime.
- How stale or disputed memory appears in working context.
- How deduplication protects ingest retries.

Without these semantics, the project collapses into storage glue.

### Context Assembly

Infinicon owns task-specific working context construction.

Given a task, scope, and budget, the runtime selects, ranks, hydrates, orders, and returns structured context segments with scores, provenance, and warnings.

The runtime does not need to decide how an agent reasons with that context.

### Extension Interfaces

Infinicon owns stable plugin contracts for:

- Extractors.
- Embedders.
- Rankers.
- Consolidators.
- Formatters.
- Storage adapters.

Implementations can vary, but the interfaces must remain small, versioned, and testable.

### Scoping and Access Model

Infinicon owns the memory scope model:

- Tenant.
- Namespace.
- Agent.
- Session.
- Optional domain-specific filters.

The exact hierarchy is a separate ADR, but every memory operation must be scoped. Unscoped memory is not acceptable for production use.

### Observability Hooks

Infinicon owns memory-runtime observability:

- Ingest counts and dedupe rates.
- Query latency.
- Retrieval scores.
- Context truncation.
- Consolidation lag.
- Tombstone cascade status.
- Plugin errors.

The runtime should expose hooks or metrics, but it does not need to dictate one observability vendor.

## Infinicon Does Not Own

### Agent Reasoning

Infinicon does not own planning, reflection loops, tool choice, task decomposition, or final answer generation.

Those belong to the agent or orchestration framework.

### Tool Execution

Infinicon may store tool calls and tool outputs as episodes, but it does not execute tools.

If the system starts deciding which shell command, browser action, API request, or database operation to run next, it has crossed into agent-framework territory.

### Model Inference

Infinicon does not own model inference.

The runtime may call embedder, extractor, or consolidator plugins that use models. Those plugins own provider selection, credentials, rate limits, and model-specific behavior unless the spec says otherwise.

### Application Workflow

Infinicon does not own chat sessions, ticket workflows, coding tasks, customer-support queues, or research notebooks.

It can remember those workflows. It should not become them.

### Framework-Specific Abstractions

LangChain, CrewAI, OpenAI Agents, Cursor, Claude Code, and similar systems are integration targets, not core dependencies.

Adapters may exist as plugins or examples. The core runtime must remain framework-agnostic.

### Storage Product Semantics

Infinicon defines storage ports, not a single database product.

Postgres, SQLite, S3, Redis, Neo4j, Qdrant, pgvector, and other systems may implement parts of the storage contract. The runtime should not expose vendor-specific behavior in the core API.

## Scope Gate

A proposed core feature belongs in Infinicon only if at least one of these is true:

- It changes memory lifecycle semantics.
- It changes context assembly semantics.
- It changes provenance, consistency, deletion, or scoping behavior.
- It defines or depends on a stable extension interface.
- It is required for conformance to the public memory spec.

If none of those are true, the feature should be an integration, plugin, example, or separate project.

## Examples

### In Scope

- Add a `contradicts` link type.
- Define how `assembleContext` reports stale consolidations.
- Add an `ExtractorPlugin` interface method.
- Specify how tombstoning an episode affects derived atoms.
- Implement a Postgres-backed `EpisodeStore`.

### Out of Scope

- Build a chat UI.
- Choose the next agent tool call.
- Add a LangChain-only memory abstraction to the core API.
- Store all data exclusively in one hosted vector database.
- Optimize prompts for a specific model provider inside the core spec.

## Default Rule

When unsure, keep the core smaller.

A plugin can graduate into the core after repeated use proves that the behavior is truly a memory-runtime semantic rather than an integration convenience.
