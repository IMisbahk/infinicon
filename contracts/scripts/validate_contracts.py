#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMAS_DIR = ROOT / "contracts" / "schemas"
FIXTURES_DIR = ROOT / "contracts" / "fixtures"
OPENAPI_PATH = ROOT / "contracts" / "openapi" / "memory-api.v0.json"


def load_json(path: Path):
  with path.open("r", encoding="utf-8") as f:
    return json.load(f)


def assert_true(condition: bool, message: str):
  if not condition:
    raise AssertionError(message)


def _validate_type(schema_type, payload):
  if isinstance(schema_type, list):
    return any(_validate_type(st, payload) for st in schema_type)
  if schema_type == "object":
    return isinstance(payload, dict)
  if schema_type == "array":
    return isinstance(payload, list)
  if schema_type == "string":
    return isinstance(payload, str)
  if schema_type == "integer":
    return isinstance(payload, int) and not isinstance(payload, bool)
  if schema_type == "number":
    return (isinstance(payload, int) or isinstance(payload, float)) and not isinstance(payload, bool)
  if schema_type == "boolean":
    return isinstance(payload, bool)
  if schema_type == "null":
    return payload is None
  return True


def _resolve_ref(schema, ref):
  if not ref.startswith("#/"):
    raise AssertionError(f"unsupported schema reference: {ref}")
  node = schema
  for part in ref[2:].split("/"):
    node = node[part]
  return node


def _validate_payload(schema_root, schema_node, payload, path):
  if "$ref" in schema_node:
    return _validate_payload(schema_root, _resolve_ref(schema_root, schema_node["$ref"]), payload, path)

  if "oneOf" in schema_node:
    for option in schema_node["oneOf"]:
      try:
        _validate_payload(schema_root, option, payload, path)
        return True
      except AssertionError:
        continue
    raise AssertionError(f"{path}: payload does not match any oneOf branch")

  if "const" in schema_node and payload != schema_node["const"]:
    raise AssertionError(f"{path}: expected const value {schema_node['const']}")

  if "enum" in schema_node and payload not in schema_node["enum"]:
    raise AssertionError(f"{path}: value not in enum")

  if "type" in schema_node and not _validate_type(schema_node["type"], payload):
    raise AssertionError(f"{path}: type mismatch for {schema_node['type']}")

  if isinstance(payload, dict):
    required = schema_node.get("required", [])
    for key in required:
      if key not in payload:
        raise AssertionError(f"{path}: missing required key '{key}'")

    properties = schema_node.get("properties", {})
    for key, value in payload.items():
      if key in properties:
        _validate_payload(schema_root, properties[key], value, f"{path}/{key}")
      elif schema_node.get("additionalProperties") is False:
        raise AssertionError(f"{path}: unexpected key '{key}'")

  if isinstance(payload, list):
    min_items = schema_node.get("minItems")
    if min_items is not None and len(payload) < min_items:
      raise AssertionError(f"{path}: expected at least {min_items} items")
    items_schema = schema_node.get("items")
    if items_schema:
      for index, value in enumerate(payload):
        _validate_payload(schema_root, items_schema, value, f"{path}/{index}")

  if isinstance(payload, (int, float)) and not isinstance(payload, bool):
    minimum = schema_node.get("minimum")
    if minimum is not None and payload < minimum:
      raise AssertionError(f"{path}: value must be >= {minimum}")
    maximum = schema_node.get("maximum")
    if maximum is not None and payload > maximum:
      raise AssertionError(f"{path}: value must be <= {maximum}")

  return True


def validate_with_schema(schema_path: Path, payload_path: Path):
  schema = load_json(schema_path)
  payload = load_json(payload_path)
  _validate_payload(schema, schema, payload, payload_path.name)


def expect_invalid(schema_path: Path, payload_path: Path):
  try:
    validate_with_schema(schema_path, payload_path)
  except AssertionError:
    return
  raise AssertionError(f"{payload_path.name}: expected invalid payload but validation passed")


def validate_fixtures():
  validate_with_schema(SCHEMAS_DIR / "data-model.v0.schema.json", FIXTURES_DIR / "data-model.valid.json")
  validate_with_schema(SCHEMAS_DIR / "context-assembly.v0.schema.json", FIXTURES_DIR / "context-assembly.valid.json")
  expect_invalid(SCHEMAS_DIR / "data-model.v0.schema.json", FIXTURES_DIR / "data-model.invalid.missing-scope.json")
  expect_invalid(SCHEMAS_DIR / "context-assembly.v0.schema.json", FIXTURES_DIR / "context-assembly.invalid.bad-warning.json")

  ingest_fixture = load_json(FIXTURES_DIR / "memory-api.ingest.valid.json")
  assert_true("scope" in ingest_fixture and "episodes" in ingest_fixture, "ingest fixture must include scope and episodes")
  assert_true(isinstance(ingest_fixture["episodes"], list) and len(ingest_fixture["episodes"]) > 0, "ingest fixture must include at least one episode")
  for key in ["contentType", "content", "dedupeKey", "createdBy", "metadata"]:
    assert_true(key in ingest_fixture["episodes"][0], f"ingest fixture episode must include {key}")


def validate_openapi_shape(path: Path):
  document = load_json(path)
  assert_true(document.get("openapi") == "3.1.0", "OpenAPI version must be 3.1.0")

  required_paths = [
    "/v0/ingest",
    "/v0/query",
    "/v0/hydrate",
    "/v0/assemble-context",
    "/v0/consolidate",
    "/v0/tombstone",
    "/v0/subscribe",
    "/v0/jobs/{jobId}",
  ]
  paths = document.get("paths", {})
  for p in required_paths:
    assert_true(p in paths, f"OpenAPI missing required path: {p}")

  schemas = document.get("components", {}).get("schemas", {})
  for schema_name in [
    "Scope",
    "MemoryRef",
    "IngestRequest",
    "QueryRequest",
    "HydrateRequest",
    "AssembleContextRequest",
    "ConsolidateRequest",
    "TombstoneRequest",
    "GetJobResponse",
  ]:
    assert_true(schema_name in schemas, f"OpenAPI missing schema: {schema_name}")


def validate_openapi_fixture_alignment(path: Path):
  document = load_json(path)
  schemas = document.get("components", {}).get("schemas", {})

  ingest_schema = schemas.get("IngestRequest", {})
  required = ingest_schema.get("required", [])
  assert_true("scope" in required and "episodes" in required, "OpenAPI IngestRequest required keys must include scope and episodes")

  consistency_enum = ingest_schema.get("properties", {}).get("consistency", {}).get("enum", [])
  assert_true("accepted" in consistency_enum and "indexed" in consistency_enum, "IngestRequest consistency enum must include accepted and indexed")

  episode_schema = schemas.get("IngestEpisode", {})
  episode_required = episode_schema.get("required", [])
  for key in ["contentType", "content", "dedupeKey", "createdBy", "metadata"]:
    assert_true(key in episode_required, f"OpenAPI IngestEpisode required must include {key}")

  warning_schema = schemas.get("ContextWarning", {})
  warning_enum = warning_schema.get("properties", {}).get("code", {}).get("enum", [])
  assert_true("truncated" in warning_enum, "ContextWarning enum must include truncated")
  assert_true("eventual_consistency" in warning_enum, "ContextWarning enum must include eventual_consistency")


def run_all_validations():
  validate_fixtures()
  validate_openapi_shape(OPENAPI_PATH)
  validate_openapi_fixture_alignment(OPENAPI_PATH)


def main():
  run_all_validations()
  print("contract validation passed")


def test_validate_contracts_passes():
  run_all_validations()


def test_invalid_fixture_is_rejected():
  expect_invalid(SCHEMAS_DIR / "data-model.v0.schema.json", FIXTURES_DIR / "data-model.invalid.missing-scope.json")


def test_openapi_required_paths_exist():
  validate_openapi_shape(OPENAPI_PATH)


def test_openapi_fixture_alignment_checks_ingest_and_warnings():
  validate_openapi_fixture_alignment(OPENAPI_PATH)


if __name__ == "__main__":
  try:
    main()
  except Exception as err:
    print(f"contract validation failed: {err}", file=sys.stderr)
    raise
