# Landscape

Infinicon overlaps with several categories of tools, but it should not pretend to be the same thing.

This document exists to clarify positioning and avoid accidental scope creep.

## Vector Databases

Examples: pgvector, Qdrant, Pinecone, Weaviate, Milvus.

Vector databases provide similarity search over indexed representations.

Infinicon may use vector databases through `IndexStore` adapters, but vector search alone does not define memory lifecycle semantics. It does not decide how raw events become knowledge, how contradictions are represented, how consolidations supersede older memory, or how deletion cascades through derived artifacts.

## Knowledge Graphs

Examples: Neo4j, RDF stores, custom graph layers.

Knowledge graphs are strong for relationships and graph traversal.

Infinicon may use graph storage through `GraphStore`, but a graph alone does not preserve raw episodes, indexing policy, context budgets, or consolidation lifecycle. The graph is an implementation tool, not the whole memory runtime.

## Agent Memory Libraries

Examples: framework-specific memory modules in LangChain or similar systems.

These are useful integration points but often live inside a specific agent framework.

Infinicon should remain framework-agnostic. Framework adapters can exist, but the core API should not inherit one framework's concepts.

## Memory Platforms

Examples: Mem0, Zep, and similar agent memory systems.

These projects validate that agent memory is a real category. Infinicon's intended differentiation is:

- Spec-first open architecture.
- Self-hostable reference server.
- Stable plugin contracts.
- Explicit storage ports.
- Provenance-first data model.
- First-class context assembly.
- Honest consistency and deletion semantics.

This does not mean other systems are wrong. It means Infinicon should compete on clarity, portability, and production semantics.

## Databases and Caches

Examples: Postgres, Redis, SQLite, S3.

These systems provide durable or fast storage.

Infinicon may use them as storage adapters, but they do not define agent memory behavior by themselves.

## Agent Frameworks

Examples: LangChain, CrewAI, OpenAI Agents, Cursor, Claude Code.

Agent frameworks own reasoning loops, tools, orchestration, and application behavior.

Infinicon owns memory runtime behavior. Integrations should connect the two without merging their responsibilities.

## Positioning Statement

Infinicon is the memory runtime layer for agents.

It is below agent orchestration and above storage. It turns persistent observations into evolving, provenance-aware, task-specific working context.
