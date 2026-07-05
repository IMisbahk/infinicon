export type {
  ActorRef,
  Atom,
  Consolidation,
  ContextBudget,
  ContextConstraints,
  ContextSegment,
  ContextWarning,
  ContextWarningCode,
  DurableMemoryObject,
  Episode,
  LifecycleStatus,
  Link,
  MemoryFilters,
  MemoryObjectType,
  MemoryRef,
  Provenance,
  Scope,
  WorkingContext,
} from "@infinicon/core-types"

export type {
  AssembleContextRequest,
  AssembleContextResponse,
  ConsolidateRequest,
  ConsolidateResponse,
  GetJobRequest,
  GetJobResponse,
  HydrateRequest,
  HydrateResponse,
  IngestEpisode,
  IngestRequest,
  IngestResponse,
  MemoryApiError,
  MemoryEventType,
  QueryRequest,
  QueryResponse,
  SubscribeRequest,
  TombstoneCascadePolicy,
  TombstoneRequest,
  TombstoneResponse,
} from "@infinicon/core-types"

import type { MemoryEventType, MemoryRef, Scope } from "@infinicon/core-types"

export type MemoryEvent = {
  id: string
  type: MemoryEventType
  scope: Scope
  timestamp: string
  payload: Record<string, unknown>
}

export type SubscribeResponse = MemoryEvent[]

export type MemoryType = MemoryRef["type"]
