#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"

REQUIRED_FIXTURES = {
  "ingest.request.valid.json",
  "ingest.response.valid.json",
  "query.request.valid.json",
  "query.response.valid.json",
  "assemble-context.request.valid.json",
  "assemble-context.response.valid.json",
  "tombstone.request.valid.json",
  "tombstone.response.valid.json",
  "get-job.request.valid.json",
  "get-job.response.valid.json",
}


def require(condition: bool, message: str) -> None:
  if not condition:
    raise AssertionError(message)


def load_json(path: Path) -> dict:
  with path.open("r", encoding="utf-8") as f:
    return json.load(f)


def validate_scope(scope: dict, context: str) -> None:
  require(isinstance(scope, dict), f"{context}: scope must be object")
  require(isinstance(scope.get("tenantId"), str) and scope["tenantId"], f"{context}: scope.tenantId required")
  require(isinstance(scope.get("namespaceId"), str) and scope["namespaceId"], f"{context}: scope.namespaceId required")


def validate_memory_ref(ref: dict, context: str) -> None:
  require(isinstance(ref, dict), f"{context}: ref must be object")
  require(isinstance(ref.get("id"), str) and ref["id"], f"{context}: ref.id required")
  require(ref.get("type") in {"episode", "atom", "consolidation", "link"}, f"{context}: ref.type invalid")
  validate_scope(ref.get("scope"), f"{context}.scope")


def validate_ingest_request(doc: dict) -> None:
  validate_scope(doc.get("scope"), "ingest.request.scope")
  episodes = doc.get("episodes")
  require(isinstance(episodes, list) and len(episodes) > 0, "ingest.request.episodes must be non-empty list")
  require(doc.get("consistency") in {"accepted", "indexed"}, "ingest.request.consistency invalid")
  for idx, episode in enumerate(episodes):
    require(isinstance(episode.get("contentType"), str), f"ingest.request.episodes[{idx}].contentType required")
    require("content" in episode, f"ingest.request.episodes[{idx}].content required")
    require(isinstance(episode.get("dedupeKey"), str), f"ingest.request.episodes[{idx}].dedupeKey required")
    require(isinstance(episode.get("createdBy"), str), f"ingest.request.episodes[{idx}].createdBy required")
    require(isinstance(episode.get("metadata"), dict), f"ingest.request.episodes[{idx}].metadata required")


def validate_ingest_response(doc: dict) -> None:
  results = doc.get("results")
  require(isinstance(results, list), "ingest.response.results must be list")
  for idx, result in enumerate(results):
    validate_memory_ref(result.get("ref"), f"ingest.response.results[{idx}].ref")
    require(result.get("status") in {"created", "deduplicated", "rejected"}, f"ingest.response.results[{idx}].status invalid")


def validate_query_request(doc: dict) -> None:
  validate_scope(doc.get("scope"), "query.request.scope")
  require(isinstance(doc.get("query"), str) and doc["query"], "query.request.query required")
  require(doc.get("consistency") in {"strong", "eventual"}, "query.request.consistency invalid")


def validate_query_response(doc: dict) -> None:
  refs = doc.get("refs")
  require(isinstance(refs, list), "query.response.refs must be list")
  for idx, item in enumerate(refs):
    validate_memory_ref(item.get("ref"), f"query.response.refs[{idx}].ref")
    require(isinstance(item.get("score"), (int, float)), f"query.response.refs[{idx}].score required")


def validate_assemble_context_request(doc: dict) -> None:
  validate_scope(doc.get("scope"), "assemble-context.request.scope")
  require(isinstance(doc.get("task"), str) and doc["task"], "assemble-context.request.task required")
  budget = doc.get("budget")
  require(isinstance(budget, dict), "assemble-context.request.budget required")
  require(isinstance(budget.get("maxTokens"), int) and budget["maxTokens"] > 0, "assemble-context.request.budget.maxTokens invalid")


def validate_assemble_context_response(doc: dict) -> None:
  context = doc.get("context")
  require(isinstance(context, dict), "assemble-context.response.context required")
  validate_scope(context.get("scope"), "assemble-context.response.context.scope")
  require(isinstance(context.get("segments"), list), "assemble-context.response.context.segments required")
  for idx, segment in enumerate(context["segments"]):
    validate_memory_ref(segment.get("ref"), f"assemble-context.response.context.segments[{idx}].ref")
    require(isinstance(segment.get("score"), (int, float)), f"assemble-context.response.context.segments[{idx}].score required")
  warnings = context.get("warnings")
  require(isinstance(warnings, list), "assemble-context.response.context.warnings must be list")
  warning_codes = {
    "empty_context",
    "truncated",
    "required_ref_omitted",
    "stale_consolidation",
    "disputed_memory_included",
    "superseded_memory_included",
    "eventual_consistency",
    "partial_hydration",
  }
  for idx, warning in enumerate(warnings):
    require(warning.get("code") in warning_codes, f"assemble-context.response.context.warnings[{idx}].code invalid")


def validate_tombstone_request(doc: dict) -> None:
  validate_scope(doc.get("scope"), "tombstone.request.scope")
  refs = doc.get("refs")
  require(isinstance(refs, list) and refs, "tombstone.request.refs must be non-empty list")
  for idx, ref in enumerate(refs):
    validate_memory_ref(ref, f"tombstone.request.refs[{idx}]")
  require(doc.get("cascadePolicy") in {"none", "mark_derived_stale", "tombstone_derived"}, "tombstone.request.cascadePolicy invalid")


def validate_tombstone_response(doc: dict) -> None:
  results = doc.get("results")
  require(isinstance(results, list), "tombstone.response.results must be list")
  for idx, result in enumerate(results):
    validate_memory_ref(result.get("ref"), f"tombstone.response.results[{idx}].ref")
    require(result.get("status") in {"tombstoned", "already_tombstoned", "not_found", "rejected"}, f"tombstone.response.results[{idx}].status invalid")


def validate_get_job_request(doc: dict) -> None:
  validate_scope(doc.get("scope"), "get-job.request.scope")
  require(isinstance(doc.get("jobId"), str) and doc["jobId"], "get-job.request.jobId required")


def validate_get_job_response(doc: dict) -> None:
  require(isinstance(doc.get("jobId"), str), "get-job.response.jobId required")
  require(isinstance(doc.get("type"), str), "get-job.response.type required")
  require(doc.get("status") in {"queued", "running", "completed", "failed", "cancelled"}, "get-job.response.status invalid")
  require(isinstance(doc.get("createdAt"), str), "get-job.response.createdAt required")
  require(isinstance(doc.get("updatedAt"), str), "get-job.response.updatedAt required")


def main() -> None:
  require(FIXTURES.exists(), f"fixtures directory missing: {FIXTURES}")
  files = {p.name for p in FIXTURES.glob("*.json")}
  missing = REQUIRED_FIXTURES - files
  require(not missing, f"missing fixtures: {sorted(missing)}")

  docs = {name: load_json(FIXTURES / name) for name in REQUIRED_FIXTURES}

  validate_ingest_request(docs["ingest.request.valid.json"])
  validate_ingest_response(docs["ingest.response.valid.json"])
  validate_query_request(docs["query.request.valid.json"])
  validate_query_response(docs["query.response.valid.json"])
  validate_assemble_context_request(docs["assemble-context.request.valid.json"])
  validate_assemble_context_response(docs["assemble-context.response.valid.json"])
  validate_tombstone_request(docs["tombstone.request.valid.json"])
  validate_tombstone_response(docs["tombstone.response.valid.json"])
  validate_get_job_request(docs["get-job.request.valid.json"])
  validate_get_job_response(docs["get-job.response.valid.json"])

  print("conformance fixtures validation passed")


if __name__ == "__main__":
  main()
