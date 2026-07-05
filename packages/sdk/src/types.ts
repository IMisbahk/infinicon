export type * from "@infinicon/core-types"

import type { MemoryEventType, MemoryRef, Scope } from "@infinicon/core-types"

// HTTP subscribe returns a batch, not an async iterable
export type MemoryEvent = {
  id: string
  type: MemoryEventType
  scope: Scope
  timestamp: string
  payload: Record<string, unknown>
}

export type SubscribeResponse = MemoryEvent[]
