# Agent chat example

A minimal **real agent loop** that uses `@infinicon/sdk` for long-term memory.

Each turn:

1. `assembleContext` — pull relevant memory for the user's message
2. LLM reply — OpenAI (if configured) or local echo mode
3. `ingest` — store user + assistant turns as episodes
4. `consolidate` (every N turns) — enqueue background memory merge

## Prerequisites

From the **repo root**, start the reference memory server:

```bash
bun run dev
```

## Setup

```bash
cd examples/agent-chat
cp .env.example .env
# edit .env — set OPENAI_API_KEY if you want real LLM replies
bun install
```

## Run

From repo root:

```bash
bun run example:agent
```

Or from this directory:

```bash
bun run start
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `INFINICON_BASE_URL` | yes | Memory API base URL |
| `INFINICON_API_KEY` | no | Bearer token when server auth is enabled |
| `INFINICON_TENANT_ID` | yes | Memory tenant scope |
| `INFINICON_NAMESPACE_ID` | yes | Memory namespace scope |
| `INFINICON_AGENT_ID` | yes | Agent id stored in provenance |
| `INFINICON_SESSION_ID` | no | Optional session scope |
| `OPENAI_API_KEY` | no | Enables OpenAI chat completions |
| `OPENAI_MODEL` | no | Default `gpt-4o-mini` |
| `CONTEXT_MAX_TOKENS` | no | Context budget for `assembleContext` |
| `CONSOLIDATE_EVERY_TURNS` | no | Enqueue consolidation every N turns |

Without `OPENAI_API_KEY`, the agent runs in **local echo mode** so you can test memory ingest/query without an LLM bill.

## What to try

1. Tell the agent your name and a preference.
2. Exit and restart — ask "what do you remember about me?"
3. Watch memory warnings when context is empty vs populated.

## Layout

```
src/
  main.ts           # REPL chat loop
  config.ts         # .env loader
  memorySession.ts  # SDK wrapper (ingest, assemble, consolidate)
  llmProvider.ts    # OpenAI or local echo
```
