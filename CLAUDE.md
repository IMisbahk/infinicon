# CLAUDE.md

## Project

Infinicon is a **production-grade memory runtime for AI agents** with a strict **spec-first** development approach.

Current repo state: documentation/specification phase with initial machine-readable contracts and validation scaffolding under `contracts/`.

Core goals from docs:

- memory lifecycle semantics over time (ingest, derive, consolidate, tombstone)
- provenance-preserving retrieval and context assembly
- storage/model/framework agnosticism
- explicit consistency, deletion, and scope behavior

Primary stack right now:

- Markdown specifications and ADRs
- Architecture-first process

## Structure

- `README.md` — high-level project entry and doc map
- `CONTRIBUTING.md` — contribution principles and spec/ADR review expectations
- `docs/vision.md` — project thesis and non-goals
- `docs/glossary.md` — canonical terminology
- `docs/roadmap.md` — phased delivery plan (Phase 0 docs to later implementation)
- `docs/architecture/` — overview, boundaries, consistency, security
- `docs/specs/` — v0 draft specs (`data-model`, `memory-api`, `plugin-interface`, `storage-ports`, `context-assembly`)
- `docs/adr/` — accepted architecture decisions (0001–0005)
- `docs/comparisons/landscape.md` — positioning and scope boundaries
- `contracts/openapi/memory-api.v0.json` — draft machine-readable API contract
- `contracts/schemas/*` — draft JSON schemas for data model and interfaces
- `contracts/fixtures/*` — valid/invalid fixture payloads for contract checks
- `contracts/scripts/validate_contracts.py` — dependency-free contract validation runner

## Build & run

This repository is still primarily docs/spec, plus early contracts and verification scripts.

Current practical verification commands:

```bash
# repo health
git status

# inspect project docs tree
find docs -maxdepth 3 -type f | sort

# contract validation
python3 contracts/scripts/validate_contracts.py
```

When runtime packages land, extend this section with exact build/test/run commands from the project toolchain.

## Conventions

Observed project conventions:

- spec-first: behavior changes should be reflected in specs/ADRs first
- avoid coupling core runtime to a specific storage backend, model provider, or agent framework
- use explicit boundaries: Infinicon owns memory semantics, not agent orchestration/tool execution/model inference
- use precise glossary language; avoid marketing phrasing in technical docs
- ADRs are append-only history; supersede, don’t rewrite accepted decisions
- keep contributions modular and explicit about trade-offs and failure modes

## My role as contributor

- I am Claude, a contributor on this project. My branch is `claude`. Misbah owns `main`.
- I never touch `main` or push to it directly.
- I commit my work to `claude` and open PRs to `main` when I have something meaningful.
- I use judgment on PRs — small fixes just get committed, feature-complete work gets a PR.
- I maintain `primer.md` every session — rewrite it at session start from git log + context, update it at session end.
- I update this `CLAUDE.md` when the project meaningfully evolves.
- I log all conflict fixes and sync notes to `CHANGELOG.md`.
- I never add dependencies without asking Misbah first.
- I never rewrite entire files for small fixes.
- I never delete files without asking.
