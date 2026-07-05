# Examples

## Runnable (SDK)

Start with the **one-file** agent — same env as agent-chat:

```bash
cp examples/agent-chat/.env.example examples/agent-chat/.env
bun run dev          # repo root, separate terminal
bun run example:simple
```

| Path | Description |
|------|-------------|
| [`simple-chat.ts`](simple-chat.ts) | Minimal query → LLM → ingest loop |
| [`agent-chat/`](agent-chat/README.md) | Full example: recall fan-out, consolidation, config split |

## Spec fixtures (not runnable)

Normative JSON samples — if an example and a spec diverge, the spec wins.

- `data-model/` — sample objects from `docs/specs/data-model.v0.md`
- `memory-api/` — request/response payloads from `docs/specs/memory-api.v0.md`
- `context-assembly/` — edge cases from `docs/specs/context-assembly.v0.md`
- `plugin-interface/` — plugin descriptors from `docs/specs/plugin-interface.v0.md`

Validate fixtures:

```bash
node tests/validate-examples.js
```
