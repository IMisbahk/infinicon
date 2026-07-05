# Changelog

## [0.1.0] — 2026-07-05

### Published to npm
- `@infinicon/core-types@0.1.0` — spec-aligned TypeScript contracts
- `@infinicon/sdk@0.1.0` — memory API client with `openMemory()` helpers
- `@infinicon/server@0.1.0` — reference memory server (`npx @infinicon/server`)

### Added
- Scoped memory DX: `createClient`, `scopeFromEnv`, `withScope`, `openMemory`
- npm build pipeline (`bun run build:packages`)
- GitHub Actions: `publish-npm.yml` (on release + manual dispatch)
- Razorpay support link via `.github/FUNDING.yml`
- `@infinicon/server` npm package with `infinicon-server` CLI
- Dockerfile and Render deploy button for one-click hosting
