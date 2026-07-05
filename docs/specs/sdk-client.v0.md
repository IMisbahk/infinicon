# SDK Client Specification v0

Status: Draft

This document defines the v0 thin client behavior for the Infinicon Memory API.

It is intentionally conservative and aligns with existing API, architecture, and ADR documentation.

## Purpose

The SDK exists to provide ergonomic typed bindings to the memory runtime without introducing client-side business logic that belongs in the server runtime.

This follows ADR 0002 (hybrid deployment model): thin client SDKs call the reference server and should not redefine core memory semantics.

## Scope

The v0 SDK includes:

- Typed request and response contracts for core memory API operations.
- A transport abstraction based on HTTP JSON requests.
- Typed error mapping from API and HTTP failures.
- Optional auth header support via bearer token.

The v0 SDK does not include:

- Local memory lifecycle implementation.
- Plugin host behavior.
- Context formatting behavior.
- Client-side lifecycle mutation logic.

## Operations

The SDK exposes one method per v0 API operation:

- `ingest`
- `query`
- `hydrate`
- `assembleContext`
- `consolidate`
- `tombstone`
- `subscribe`
- `getJob`

Each method sends the provided request body to a stable v0 endpoint path under `/v0/memory/*`.

## Validation Rules

The SDK must validate minimum scope requirements before sending requests:

- `scope.tenantId` is required.
- `scope.namespaceId` is required.

If these fields are missing or empty, the SDK rejects locally.

The SDK should avoid deep semantic validation that might diverge from server enforcement.

## Error Model

The SDK maps failures into a stable error class.

- `InfiniconSdkError` includes `code`, `message`, optional `status`, optional `retryable`, and optional `details`.
- If the response provides structured `error` content, the SDK preserves this shape.
- If the response is non-JSON, the SDK returns a conservative HTTP error form.

## Transport

The SDK uses a small HTTP client abstraction:

- Configurable `baseUrl`.
- Optional custom fetch implementation.
- Optional default headers.
- Optional bearer token header (`Authorization: Bearer <token>`).

Transport decisions should remain replaceable and testable.

## Compatibility

Breaking SDK changes must align with API spec versioning.

v0 should prefer additive, non-breaking evolution:

- Add optional fields.
- Add optional convenience helpers.
- Preserve existing request and response contract types.

## Testing Expectations

The SDK should include tests for:

- Endpoint path routing and request payload shaping.
- Scope gate behavior.
- Error mapping behavior.
- Exported contract unions for critical API values.

## Open Questions

- Whether to provide generated types from future machine-readable schemas.
- Whether to support REST and gRPC clients in one package or separate packages.
- Whether subscribe should expose a typed streaming helper once server transport is finalized.
