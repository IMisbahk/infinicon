# Backup and restore

## Postgres reference adapter

The reference Postgres adapter stores memory objects, jobs, events, and index payloads in JSONB tables (`infinicon_objects`, `infinicon_jobs`, `infinicon_events`, `infinicon_index`).

### Backup expectations

- Enable WAL archiving on managed Postgres (Render, Neon, Supabase, etc.).
- Take nightly logical or base backups.
- Target **RPO 15 minutes** and **RTO 2 hours** for production workloads (matches capability descriptor example).

### Backup command (logical)

```bash
pg_dump "$DATABASE_URL" --format=custom --file=infinicon-backup.dump
```

### Restore command

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" infinicon-backup.dump
```

Run restore against a staging instance first. Schema is created automatically on startup via `initPostgresSchema`.

## Migrations

Schema is idempotent (`CREATE TABLE IF NOT EXISTS`). For additive migrations, append SQL under `docs/devops/migrations/` and apply before deploy.

## In-memory mode

No backup — data is lost on process exit. Do not use in-memory storage in production.
