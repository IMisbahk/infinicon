#!/usr/bin/env python3

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [
  ROOT / "memory-api.v0.openapi.json",
  ROOT / "data-model.v0.schema.json",
  ROOT / "context-assembly.v0.schema.json",
  ROOT / "plugin-interface.v0.schema.json",
  ROOT / "storage-ports.v0.schema.json",
]


def load_json(path: Path) -> dict:
  with path.open("r", encoding="utf-8") as f:
    return json.load(f)


def require(condition: bool, message: str) -> None:
  if not condition:
    raise AssertionError(message)


def validate_openapi(doc: dict) -> None:
  require(doc.get("openapi") == "3.1.0", "openapi version must be 3.1.0")
  require("paths" in doc and isinstance(doc["paths"], dict), "openapi paths missing")
  expected_paths = {
    "/v0/memory/ingest",
    "/v0/memory/query",
    "/v0/memory/hydrate",
    "/v0/memory/assemble-context",
    "/v0/memory/consolidate",
    "/v0/memory/tombstone",
    "/v0/memory/subscribe",
    "/v0/memory/get-job",
  }
  require(expected_paths.issubset(set(doc["paths"].keys())), "openapi missing required v0 endpoints")


def validate_data_model(doc: dict) -> None:
  defs = doc.get("definitions", {})
  required_defs = {
    "Scope",
    "MemoryRef",
    "Episode",
    "Atom",
    "Consolidation",
    "Link",
    "WorkingContext",
  }
  require(required_defs.issubset(set(defs.keys())), "data-model schema missing core definitions")


def validate_context_assembly(doc: dict) -> None:
  warnings = doc.get("properties", {}).get("warningCodes", {}).get("items", {}).get("enum", [])
  expected = {
    "empty_context",
    "truncated",
    "required_ref_omitted",
    "stale_consolidation",
    "disputed_memory_included",
    "superseded_memory_included",
    "eventual_consistency",
    "partial_hydration",
  }
  require(set(warnings) == expected, "context-assembly warning codes must match v0 spec")


def validate_plugin_interface(doc: dict) -> None:
  kinds = doc.get("definitions", {}).get("PluginKind", {}).get("enum", [])
  expected = {
    "extractor",
    "embedder",
    "ranker",
    "consolidator",
    "formatter",
    "storage_adapter",
  }
  require(set(kinds) == expected, "plugin-interface kinds must match v0 spec")


def validate_storage_ports(doc: dict) -> None:
  ports = doc.get("properties", {}).get("ports", {}).get("properties", {})
  require({"episodeStore", "graphStore", "indexStore", "metadataStore"}.issubset(set(ports.keys())), "storage-ports missing required ports")


def main() -> None:
  loaded = {}
  for path in FILES:
    require(path.exists(), f"missing file: {path}")
    loaded[path.name] = load_json(path)

  validate_openapi(loaded["memory-api.v0.openapi.json"])
  validate_data_model(loaded["data-model.v0.schema.json"])
  validate_context_assembly(loaded["context-assembly.v0.schema.json"])
  validate_plugin_interface(loaded["plugin-interface.v0.schema.json"])
  validate_storage_ports(loaded["storage-ports.v0.schema.json"])

  print("machine-readable spec validation passed")


if __name__ == "__main__":
  main()
