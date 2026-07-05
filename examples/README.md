# Examples Subsystem

This directory contains normative-style examples for Infinicon v0 draft specifications.

These files are implementation guidance, not a replacement for the specs. If an example and a spec ever diverge, the spec wins.

## Layout

- `data-model/` — sample durable and ephemeral objects from `docs/specs/data-model.v0.md`
- `memory-api/` — sample request/response payloads from `docs/specs/memory-api.v0.md`
- `context-assembly/` — focused context assembly edge-case examples from `docs/specs/context-assembly.v0.md`
- `plugin-interface/` — plugin descriptor examples from `docs/specs/plugin-interface.v0.md`
- `agent-chat/` — full agent using `@infinicon/sdk` ([README](agent-chat/README.md))
- `simple-chat.ts` — **one-file** minimal agent (`bun run example:simple`, same `.env` as agent-chat)

## Validation

Run the repository validator:

```bash
node tests/validate-examples.js
```

The validator checks that examples parse and satisfy required v0 semantic constraints.
