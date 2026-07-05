# Security Architecture

This document defines the initial security posture for Infinicon.

Memory systems store sensitive context by default. Treating memory as harmless logs would be a serious design flaw.

## Security Goals

- Isolate tenants and namespaces.
- Enforce scoped access on every operation.
- Prevent tombstoned content from resurfacing.
- Preserve auditability without leaking deleted content.
- Keep model and storage credentials out of core memory content.
- Make plugin trust boundaries explicit.

## Scope and Tenancy

Every operation must include a scope.

The initial logical hierarchy is:

- Tenant.
- Namespace.
- Agent.
- Session.

Tenant is the strongest isolation boundary. Namespace is the primary memory collection boundary. Agent and session may be used for attribution, filtering, and policy.

Cross-tenant access must be rejected unless a future sharing model explicitly allows it.

## Authorization

The runtime must authorize these actions separately:

- Ingest.
- Query.
- Hydrate.
- Assemble context.
- Consolidate.
- Tombstone.
- Audit tombstoned metadata.
- Administer plugins and storage adapters.

Hydration deserves special care because query refs may reveal less sensitive data than full memory content.

## Secrets

Secrets should not be stored as memory content unless the caller explicitly ingests them.

Plugin credentials, model API keys, database passwords, and service tokens belong in runtime configuration or secret stores, not in episodes, atoms, or consolidations.

If a plugin detects likely secrets in memory content, it may emit warnings or tags, but automatic redaction policy must be explicit and configurable.

## Plugin Trust

In v0, plugins are trusted server extensions.

Plugins can leak data if misconfigured or malicious. Deployers must install only trusted plugins and must understand which scopes each plugin can access.

Future versions may add sandboxing, permission manifests, or remote plugin isolation. Those features are not assumed in v0.

## Deletion and Tombstones

Deletion must be represented as tombstoning plus index removal or hiding.

Normal query and context assembly must not return tombstoned content.

Tombstone metadata may remain for audit and dedupe safety, but it must not contain deleted content unless the retention policy explicitly permits it.

Derived memory must be handled according to cascade policy:

- `none`
- `mark_derived_stale`
- `tombstone_derived`

The system must prevent deleted content from resurfacing through stale embeddings, cached context, or consolidations.

## Auditability

The runtime should record:

- Who ingested memory.
- Who tombstoned memory.
- Which plugin produced derived memory.
- Which sources contributed to a consolidation.
- Which policy was used for a deletion cascade.

Audit metadata must be scoped and authorized like other runtime metadata.

## Data Minimization

Memory profiles and extractors should avoid creating more derived data than needed.

Consolidation can reduce prompt cost, but it can also spread sensitive information into more objects. Provenance and cascade policies exist because derived data must be managed as carefully as source data.

## Transport and Deployment

Production deployments should require:

- TLS for network transport.
- Authentication on every API call.
- Principle-of-least-privilege service credentials.
- Backups and restore tests for production storage adapters.
- Metrics and logs that avoid dumping memory content by default.

## Open Questions

- What auth mechanism should the reference server support first?
- Should v0 include built-in redaction plugins?
- How should encrypted-at-rest behavior be represented in adapter capabilities?
- Should namespace-level retention policy be mandatory?
