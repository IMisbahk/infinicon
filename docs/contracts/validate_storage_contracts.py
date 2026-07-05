#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def fail(message: str):
    raise ValueError(message)


def _ensure_exact_set(label: str, actual_values: list[str], expected_values: set[str]):
    actual_set = set(actual_values)
    if actual_set != expected_values:
        missing = sorted(expected_values - actual_set)
        extra = sorted(actual_set - expected_values)
        fail(f"{label} mismatch missing={missing} extra={extra}")


def validate_manifest(manifest: dict):
    required_top = {
        "spec",
        "status",
        "source",
        "adapterCapabilityDescriptor",
        "ports",
        "openQuestions",
    }
    optional_top = {"$schema"}
    actual_top = set(manifest.keys())
    missing = sorted(required_top - actual_top)
    extra = sorted(actual_top - (required_top | optional_top))
    if missing or extra:
        fail(f"manifest top-level keys mismatch missing={missing} extra={extra}")

    if manifest["spec"] != "storage-ports.v0":
        fail("manifest spec must equal storage-ports.v0")

    if manifest["status"] not in {"draft", "accepted"}:
        fail("manifest status must be draft or accepted")

    descriptor = manifest["adapterCapabilityDescriptor"]
    expected_required_declarations = {
        "implementedPorts",
        "transactionalGuarantees",
        "maximumObjectSizes",
        "indexConsistencyBehavior",
        "paginationBehavior",
        "supportedFilters",
    }
    _ensure_exact_set(
        "manifest adapterCapabilityDescriptor.requiredDeclarations",
        descriptor.get("requiredDeclarations", []),
        expected_required_declarations,
    )

    conditional = descriptor.get("conditionallyRequiredDeclarations", [])
    if len(conditional) != 1:
        fail("manifest conditionallyRequiredDeclarations must contain exactly one entry")
    rule = conditional[0]
    if rule.get("when") != "productionReady = true" or rule.get("field") != "backupRestoreExpectations":
        fail("manifest conditional requirement must be productionReady=true => backupRestoreExpectations")

    expected_ports = {"episodeStore", "graphStore", "indexStore", "metadataStore"}
    ports = manifest["ports"]
    _ensure_exact_set("manifest ports", list(ports.keys()), expected_ports)

    expected_port_content = {
        "episodeStore": {
            "requiredCapabilities": {
                "appendEpisode",
                "fetchEpisodeByRef",
                "fetchEpisodesByRefs",
                "resolveDedupeKeyWithinScope",
                "tombstoneEpisode",
            },
            "requiredGuarantees": {
                "episodesNotOverwrittenInPlace",
                "dedupeLookupIsScoped",
                "tombstonedContentExcludedFromNormalReads",
            },
        },
        "graphStore": {
            "requiredCapabilities": {
                "addLink",
                "fetchOutgoingLinks",
                "fetchIncomingLinks",
                "fetchProvenanceChain",
                "tombstoneLink",
            },
            "requiredGuarantees": {
                "linksAreScoped",
                "crossTenantLinksRejectedUnlessExplicitlySupported",
                "tombstonedLinksExcludedFromNormalTraversal",
            },
        },
        "indexStore": {
            "requiredCapabilities": {
                "indexMemoryPayload",
                "removeOrHideIndexedPayload",
                "searchByQueryPayload",
                "searchByFilters",
                "reportIndexFreshnessWhenAvailable",
            },
            "requiredGuarantees": {
                "tombstonedMemoryNotReturnedAsEligible",
                "indexingConsistencyBehaviorDeclared",
                "scoreInterpretationLimitsDeclared",
            },
        },
        "metadataStore": {
            "requiredCapabilities": {
                "storeScopes",
                "storeAccessMetadata",
                "storeAsyncJobs",
                "storePluginState",
                "storeEventCursors",
            },
            "requiredGuarantees": {
                "jobStateTransitionsAreDurable",
                "scopeMetadataAvailableBeforeMemoryOperations",
                "runtimeMetadataNotExposedAsMemoryContent",
            },
        },
    }

    for port_name, port in ports.items():
        for key in ("requiredCapabilities", "requiredGuarantees"):
            if key not in port or not isinstance(port[key], list) or len(port[key]) == 0:
                fail(f"{port_name}.{key} must be a non-empty array")
        _ensure_exact_set(
            f"{port_name}.requiredCapabilities",
            port["requiredCapabilities"],
            expected_port_content[port_name]["requiredCapabilities"],
        )
        _ensure_exact_set(
            f"{port_name}.requiredGuarantees",
            port["requiredGuarantees"],
            expected_port_content[port_name]["requiredGuarantees"],
        )


def validate_adapter_schema(adapter_schema: dict):
    expected = {
        "implementedPorts",
        "transactionalGuarantees",
        "maximumObjectSizes",
        "indexConsistencyBehavior",
        "paginationBehavior",
        "supportedFilters",
    }
    _ensure_exact_set("adapter schema required keys", adapter_schema.get("required", []), expected)


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


def run_validation():
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


def main():
    try:
        run_validation()
        print("storage contract validation passed")
    except ValueError as error:
        print(f"ERROR: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
