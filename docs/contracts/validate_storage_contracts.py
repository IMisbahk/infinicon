#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def fail(message: str):
    print(f"ERROR: {message}")
    sys.exit(1)


def validate_manifest(manifest: dict):
    required_top = {
        "spec",
        "status",
        "source",
        "adapterCapabilityDescriptor",
        "ports",
        "openQuestions",
    }
    missing = required_top - set(manifest.keys())
    if missing:
        fail(f"manifest missing keys: {sorted(missing)}")

    if manifest["spec"] != "storage-ports.v0":
        fail("manifest spec must equal storage-ports.v0")

    if manifest["status"] not in {"draft", "accepted"}:
        fail("manifest status must be draft or accepted")

    ports = manifest["ports"]
    expected_ports = {"episodeStore", "graphStore", "indexStore", "metadataStore"}
    if set(ports.keys()) != expected_ports:
        fail("manifest ports must contain exactly episodeStore graphStore indexStore metadataStore")

    for port_name, port in ports.items():
        for key in ("requiredCapabilities", "requiredGuarantees"):
            if key not in port or not isinstance(port[key], list) or len(port[key]) == 0:
                fail(f"{port_name}.{key} must be a non-empty array")


def validate_adapter_schema(adapter_schema: dict):
    required = set(adapter_schema.get("required", []))
    expected = {
        "implementedPorts",
        "transactionalGuarantees",
        "maximumObjectSizes",
        "indexConsistencyBehavior",
        "paginationBehavior",
        "supportedFilters",
    }
    if required != expected:
        fail("adapter schema required keys drifted from storage spec declarations")


def validate_example(example: dict, name: str):
    required_example = {
        "implementedPorts",
        "transactionalGuarantees",
        "maximumObjectSizes",
        "indexConsistencyBehavior",
        "paginationBehavior",
        "supportedFilters",
    }
    missing = required_example - set(example.keys())
    if missing:
        fail(f"example {name} missing required adapter fields: {sorted(missing)}")

    expected_ports = {"EpisodeStore", "GraphStore", "IndexStore", "MetadataStore"}
    implemented_ports = set(example.get("implementedPorts", []))
    if implemented_ports != expected_ports:
        fail(f"example {name} implementedPorts must contain exactly {sorted(expected_ports)}")

    if example.get("productionReady") is True and "backupRestoreExpectations" not in example:
        fail(f"example {name} sets productionReady=true but omits backupRestoreExpectations")


def main():
    manifest_path = ROOT / "storage-ports.v0.json"
    manifest_schema_path = ROOT / "storage-ports.v0.schema.json"
    adapter_schema_path = ROOT / "storage-adapter-capabilities.v0.schema.json"
    pgvector_example_path = ROOT / "examples" / "storage-adapter-capabilities.pgvector.example.v0.json"
    local_example_path = ROOT / "examples" / "storage-adapter-capabilities.local-dev.example.v0.json"

    manifest = load_json(manifest_path)
    _ = load_json(manifest_schema_path)
    adapter_schema = load_json(adapter_schema_path)
    pgvector_example = load_json(pgvector_example_path)
    local_example = load_json(local_example_path)

    validate_manifest(manifest)
    validate_adapter_schema(adapter_schema)
    validate_example(pgvector_example, "pgvector")
    validate_example(local_example, "local-dev")

    print("storage contract validation passed")


if __name__ == "__main__":
    main()
