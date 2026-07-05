# Vision

Infinicon is a production-grade memory runtime for AI agents.

It gives agents unbounded effective memory by storing, organizing, retrieving, compressing, and evolving knowledge outside the model context window. The model still receives a bounded working context, but that context is assembled from a persistent memory system that can grow over time.

Infinicon is not a chatbot framework, orchestration framework, vector database, or prompt library. It is the memory layer that those systems can plug into.

## Definition of Unbounded Memory

Infinicon does not make a model's context window physically infinite. That would be technically inaccurate.

Instead, Infinicon provides unbounded effective memory:

- The backing memory store may grow without a fixed application-level limit.
- The runtime keeps model inputs within a caller-provided context budget.
- Retrieval, ranking, consolidation, and provenance determine what enters working context.
- Old knowledge can be compressed, superseded, disputed, or tombstoned without losing auditability.

This distinction matters because production systems need predictable latency, cost, deletion behavior, and failure modes.

## Product Thesis

Agents need memory semantics, not just storage.

Raw vector search can find similar text, but it does not define what memory means over time. It does not decide how observations become durable knowledge, how contradictions are represented, how stale knowledge is replaced, how provenance is preserved, or how a bounded prompt is assembled from an ever-growing store.

Infinicon provides those semantics through a stable memory API, a reference server, thin client SDKs, and plugin interfaces for storage, models, ranking, extraction, and consolidation.

## Principles

- Production-first architecture over demos.
- Interfaces before implementations.
- Stable specifications before code.
- Modular components with explicit boundaries.
- Storage-agnostic, model-agnostic, framework-agnostic design.
- Provenance and auditability by default.
- Extensibility without breaking existing users.
- Simplicity over cleverness.
- Decisions captured as architecture decision records.

## Non-Goals

Infinicon will not own agent reasoning loops, tool execution, model inference, UI surfaces, or framework-specific abstractions. Those belong in agents, model providers, applications, or integration plugins.

Infinicon may provide adapters and examples, but the core runtime must remain independent of any single agent framework, model vendor, or storage backend.

## Success Criteria

Infinicon succeeds when an agent developer can:

- Persist observations and knowledge across sessions.
- Ask for task-specific working context within a fixed budget.
- Understand why each returned memory was selected.
- Trace derived knowledge back to source episodes.
- Replace storage, model, and ranking implementations without changing agent logic.
- Run the reference server in production or implement the public spec independently.
