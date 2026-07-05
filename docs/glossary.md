# Glossary

This glossary defines the project language used across Infinicon architecture documents, specifications, and ADRs.

## Agent

A software system that uses a model to reason, call tools, plan, or act. Infinicon does not own the agent loop.

## Atom

A versioned unit of extracted knowledge derived from one or more episodes. Atoms are smaller than summaries and more semantic than raw events.

Examples include facts, preferences, decisions, constraints, open questions, or learned procedures.

## Consolidation

A synthesized memory artifact produced from episodes, atoms, or earlier consolidations. Consolidations compress knowledge, resolve drift where possible, and may supersede older consolidations.

## Context Assembly

The process of selecting, ranking, hydrating, ordering, and packaging memory into a bounded working context for an agent task.

## Dedupe Key

A caller-provided or system-derived key used to make ingest retries idempotent.

## Episode

An immutable raw memory event. Episodes represent what happened: a message, tool result, observation, user correction, external document, or system event.

Episodes are append-only because they provide auditability and provenance.

## Evolution Pipeline

The asynchronous process that extracts, consolidates, decays, merges, disputes, supersedes, or tombstones memory over time.

## Link

A typed relationship between memory objects.

Common link types include `derived_from`, `supports`, `contradicts`, `supersedes`, `mentions`, and `same_as`.

## Memory Profile

An optional domain-specific layer that adds typed schemas and policies on top of the core primitives.

Examples: coding profile, research profile, customer-support profile.

## Memory Ref

A stable reference to a memory object. A memory ref identifies an episode, atom, consolidation, or link without necessarily including its full content.

## Namespace

A logical scope for memory. Namespaces are used for isolation, querying, retention policy, and access control.

## Plugin

An implementation of an extension interface such as extractor, embedder, ranker, consolidator, formatter, or storage adapter.

## Provenance

The chain of sources and transformations that explains where a memory came from and how it was derived.

## Scope

The queryable boundary for memory operations. A scope may include tenant, namespace, agent, session, or domain-specific filters.

## Tombstone

A deletion marker that records that memory content was removed or invalidated. Tombstones preserve enough metadata to prevent accidental resurrection while respecting deletion requirements.

## Working Context

An ephemeral, structured bundle assembled for one agent task. Working context is not itself durable memory unless explicitly ingested as a new episode.
