-- initial postgres schema for infinicon reference adapter
-- applied automatically on startup; kept here for ops review

CREATE TABLE IF NOT EXISTS infinicon_objects (
  ref_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  object_type TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS infinicon_jobs (
  job_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS infinicon_events (
  id BIGSERIAL PRIMARY KEY,
  scope_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS infinicon_index (
  ref_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  search_text TEXT NOT NULL,
  payload JSONB NOT NULL
);
