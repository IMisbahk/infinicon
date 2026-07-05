# ADR 0002: Hybrid Deployment Model

Status: Accepted

## Context

Infinicon must support different integration styles.

Some agent systems need a central memory service shared across many agents. Others need low-latency local operation or embedded behavior. A purely embedded library would make multi-agent sharing, operations, and cross-language use harder. A purely hosted service would limit self-hosting and local-first use cases.

The project also wants to remain language-agnostic where practical.

## Decision

Infinicon will use a hybrid deployment model:

- A normative public specification defines the contract.
- A reference server implements the contract for production deployments.
- Thin client SDKs call the server and provide ergonomic language bindings.
- Future embedded runtimes may implement the same contract locally.

The specification is the stable product boundary. The reference server is the default implementation, not the only valid implementation.

## Consequences

The API and data model must be designed before committing to server internals.

Client SDKs should avoid business logic that belongs in the runtime. They may handle transport, retries, authentication helpers, local buffering, and typed request/response shapes.

Conformance tests become important because multiple implementations may exist.

## Alternatives Considered

### Embedded SDK only

This minimizes network hops and simplifies early development, but it makes shared memory, operations, and multi-language support harder.

### Standalone service only

This is operationally clear, but it may make local-first and edge use cases awkward.

### Hosted cloud product first

This could simplify onboarding, but it would weaken the open-source infrastructure identity and risk coupling the spec to one hosted backend.

## Follow-Up Work

- Decide REST, gRPC, or both for the first machine-readable schema.
- Define SDK responsibilities explicitly.
- Add conformance tests after the v0 API schema exists.
