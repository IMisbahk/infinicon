# @infinicon/core-types

Spec-aligned TypeScript contracts for Infinicon v0.

This package implements the type surface described by:

- `docs/specs/data-model.v0.md`
- `docs/specs/memory-api.v0.md`
- `docs/specs/plugin-interface.v0.md`
- `docs/specs/storage-ports.v0.md`
- `docs/specs/context-assembly.v0.md`

## What this package owns

- Core memory primitives and lifecycle statuses
- Scoped memory refs and working context shapes
- Memory API request and response contracts
- Plugin contract interfaces
- Storage port interfaces
- Runtime guard helpers for scope safety
- Runtime request validators for ingest/query/context/tombstone
- Normalizers for filters, budgets, and constraints
- JSON schemas for scope, refs, and primary API requests

## What this package does not own

- Transport implementation
- Storage adapters
- Ranking or consolidation logic
- Agent orchestration behavior

## Usage

```ts
import type { MemoryApiContract, Scope, WorkingContext } from "@infinicon/core-types"
import { assertScope } from "@infinicon/core-types"

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "default",
}

assertScope(scope)

const api: MemoryApiContract = /* implemented by runtime */ null as never

const contextResponse = await api.assembleContext({
  scope,
  task: "prepare support context",
  budget: { maxTokens: 4000 },
  consistency: "strong",
})

const context: WorkingContext = contextResponse.context
```

## Runtime helpers

```ts
import {
  normalizeContextBudget,
  validateAssembleContextRequest,
  assembleContextRequestSchema,
} from "@infinicon/core-types"

const request = {
  scope: { tenantId: "tenant-1", namespaceId: "default" },
  task: "prepare coding context",
  budget: normalizeContextBudget({ maxTokens: 4096.9, reservedTokens: 512.1 }),
}

const validation = validateAssembleContextRequest(request)
if (!validation.ok) {
  throw new Error(validation.issues.map((x) => `${x.path}: ${x.message}`).join("\n"))
}

console.log(assembleContextRequestSchema.$id)
```

## Verification

- `bun test packages/core-types/test`
- `bun run build:core-types`
