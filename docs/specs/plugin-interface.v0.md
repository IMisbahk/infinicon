# Plugin Interface Specification v0

Status: Draft

This specification defines the initial plugin model for Infinicon.

## Goals

- Extend runtime behavior without changing the core API.
- Keep plugin contracts small and versioned.
- Make side effects and idempotency explicit.
- Avoid coupling core memory semantics to one model, framework, or storage product.

## Trust Model

In v0, plugins are trusted code running in process with the reference server.

Plugins may access configured credentials and runtime data allowed by their role. Sandboxing is not part of v0. Deployers must treat plugins like server extensions, not untrusted user scripts.

## Common Plugin Descriptor

Each plugin must declare:

- `name`
- `version`
- `kind`
- `supportedSpecVersion`
- `configSchema`
- `capabilities`
- `sideEffects`
- `idempotencyGuarantees`

The runtime should validate plugin configuration at startup.

## Extractor Plugin

Extractor plugins derive atoms and links from episodes or consolidations.

Input:

- Source memory refs.
- Hydrated source content.
- Scope.
- Extraction policy.

Output:

- Proposed atoms.
- Proposed links.
- Warnings.

Requirements:

- Must preserve provenance to source memory.
- Must not mutate source episodes.
- Should be idempotent for the same input and plugin version.

## Embedder Plugin

Embedder plugins convert text or structured content into indexable representations.

Input:

- Memory ref.
- Text or normalized content.
- Metadata.

Output:

- Embedding vectors or other index payloads.
- Model or algorithm identifier.
- Token or input statistics when available.

Requirements:

- Must declare vector dimensions when producing vectors.
- Must declare whether output is deterministic.
- Must not own durable memory lifecycle.

## Ranker Plugin

Ranker plugins score candidate memory refs for a query or task.

Input:

- Query or task.
- Candidate refs.
- Optional hydrated excerpts.
- Scope and filters.

Output:

- Scores.
- Optional inclusion reasons.
- Optional warnings.

Requirements:

- Must not return tombstoned memory as eligible.
- Should make score interpretation explicit.
- Should be deterministic when configured for test mode.

## Consolidator Plugin

Consolidator plugins synthesize durable memory from source memory.

Input:

- Source refs and content.
- Prior consolidations when relevant.
- Scope.
- Consolidation policy.

Output:

- Proposed consolidations.
- Proposed links.
- Proposed supersession changes.
- Warnings and confidence metadata.

Requirements:

- Must preserve provenance.
- Must not delete source memory.
- Must surface uncertainty rather than hiding contradictions.

## Formatter Plugin

Formatter plugins translate working context into model- or framework-specific shapes.

Input:

- Working context.
- Formatting target.
- Optional caller preferences.

Output:

- Provider-specific messages or prompt fragments.

Requirements:

- Must not change memory selection.
- Must not persist new memory unless explicitly called through ingest.

## Storage Adapter Plugin

Storage adapters implement one or more storage ports.

Requirements:

- Must declare supported ports.
- Must declare transactional guarantees.
- Must declare indexing consistency behavior.
- Must pass port-level conformance tests before being marked production-ready.

## Versioning

Plugin interfaces are versioned independently from plugin implementations.

A plugin may support multiple spec versions if it can preserve behavior. Breaking interface changes require a new interface version.

## Open Questions

- Should plugins be loaded dynamically or statically linked in v0?
- Should plugin descriptors use JSON Schema, Cue, or another schema language?
- How much runtime resource accounting belongs in the core plugin host?
