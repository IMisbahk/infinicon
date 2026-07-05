from __future__ import annotations

import json
from pathlib import Path

REQUIRED_MANIFEST_TOP_KEYS = {
    "spec",
    "status",
    "source",
    "adapterCapabilityDescriptor",
    "ports",
    "openQuestions",
}
OPTIONAL_MANIFEST_TOP_KEYS = {"$schema"}

EXPECTED_REQUIRED_DECLARATIONS = {
    "implementedPorts",
    "transactionalGuarantees",
    "maximumObjectSizes",
    "indexConsistencyBehavior",
    "paginationBehavior",
    "supportedFilters",
}

EXPECTED_PORT_KEYS = {"episodeStore", "graphStore", "indexStore", "metadataStore"}
EXPECTED_IMPLEMENTED_PORTS = {"EpisodeStore", "GraphStore", "IndexStore", "MetadataStore"}

EXPECTED_PORT_CONTENT = {
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


class ValidationError(ValueError):
    pass


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _fail(message: str):
    raise ValidationError(message)


def _ensure_exact_set(label: str, actual_values: list[str], expected_values: set[str]):
    actual_set = set(actual_values)
    if actual_set != expected_values:
        missing = sorted(expected_values - actual_set)
        extra = sorted(actual_set - expected_values)
        _fail(f"{label} mismatch missing={missing} extra={extra}")


def validate_manifest(manifest: dict):
    actual_top = set(manifest.keys())
    missing = sorted(REQUIRED_MANIFEST_TOP_KEYS - actual_top)
    extra = sorted(actual_top - (REQUIRED_MANIFEST_TOP_KEYS | OPTIONAL_MANIFEST_TOP_KEYS))
    if missing or extra:
        _fail(f"manifest top-level keys mismatch missing={missing} extra={extra}")

    if manifest["spec"] != "storage-ports.v0":
        _fail("manifest spec must equal storage-ports.v0")

    if manifest["status"] not in {"draft", "accepted"}:
        _fail("manifest status must be draft or accepted")

    descriptor = manifest["adapterCapabilityDescriptor"]
    _ensure_exact_set(
        "manifest adapterCapabilityDescriptor.requiredDeclarations",
        descriptor.get("requiredDeclarations", []),
        EXPECTED_REQUIRED_DECLARATIONS,
    )

    conditional = descriptor.get("conditionallyRequiredDeclarations", [])
    if len(conditional) != 1:
        _fail("manifest conditionallyRequiredDeclarations must contain exactly one entry")

    rule = conditional[0]
    if rule.get("when") != "productionReady = true" or rule.get("field") != "backupRestoreExpectations":
        _fail("manifest conditional requirement must be productionReady=true => backupRestoreExpectations")

    ports = manifest["ports"]
    _ensure_exact_set("manifest ports", list(ports.keys()), EXPECTED_PORT_KEYS)

    for port_name, port in ports.items():
        for key in ("requiredCapabilities", "requiredGuarantees"):
            if key not in port or not isinstance(port[key], list) or len(port[key]) == 0:
                _fail(f"{port_name}.{key} must be a non-empty array")

        _ensure_exact_set(
            f"{port_name}.requiredCapabilities",
            port["requiredCapabilities"],
            EXPECTED_PORT_CONTENT[port_name]["requiredCapabilities"],
        )
        _ensure_exact_set(
            f"{port_name}.requiredGuarantees",
            port["requiredGuarantees"],
            EXPECTED_PORT_CONTENT[port_name]["requiredGuarantees"],
        )


def validate_adapter_schema(adapter_schema: dict):
    _ensure_exact_set(
        "adapter schema required keys",
        adapter_schema.get("required", []),
        EXPECTED_REQUIRED_DECLARATIONS,
    )


def validate_adapter_descriptor(adapter_descriptor: dict, name: str):
    missing = EXPECTED_REQUIRED_DECLARATIONS - set(adapter_descriptor.keys())
    if missing:
        _fail(f"example {name} missing required adapter fields: {sorted(missing)}")

    implemented_ports = set(adapter_descriptor.get("implementedPorts", []))
    if implemented_ports != EXPECTED_IMPLEMENTED_PORTS:
        _fail(f"example {name} implementedPorts must contain exactly {sorted(EXPECTED_IMPLEMENTED_PORTS)}")

    if adapter_descriptor.get("productionReady") is True and "backupRestoreExpectations" not in adapter_descriptor:
        _fail(f"example {name} sets productionReady=true but omits backupRestoreExpectations")


def validate_contract_bundle(root: Path):
    manifest_path = root / "storage-ports.v0.json"
    adapter_schema_path = root / "storage-adapter-capabilities.v0.schema.json"
    manifest = load_json(manifest_path)
    adapter_schema = load_json(adapter_schema_path)

    validate_manifest(manifest)
    validate_adapter_schema(adapter_schema)

    examples = [
        (root / "examples" / "storage-adapter-capabilities.pgvector.example.v0.json", "pgvector"),
        (root / "examples" / "storage-adapter-capabilities.local-dev.example.v0.json", "local-dev"),
    ]
    for path, name in examples:
        validate_adapter_descriptor(load_json(path), name)
