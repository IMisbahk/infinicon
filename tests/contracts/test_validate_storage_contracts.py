import unittest

from docs.contracts.contract_validation import ValidationError
from docs.contracts.contract_validation import validate_adapter_descriptor
from docs.contracts.contract_validation import validate_manifest


class ValidateStorageContractsTests(unittest.TestCase):
    def make_valid_manifest(self):
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "spec": "storage-ports.v0",
            "status": "draft",
            "source": "../specs/storage-ports.v0.md",
            "adapterCapabilityDescriptor": {
                "requiredDeclarations": [
                    "implementedPorts",
                    "transactionalGuarantees",
                    "maximumObjectSizes",
                    "indexConsistencyBehavior",
                    "paginationBehavior",
                    "supportedFilters",
                ],
                "conditionallyRequiredDeclarations": [
                    {
                        "when": "productionReady = true",
                        "field": "backupRestoreExpectations",
                    }
                ],
            },
            "ports": {
                "episodeStore": {
                    "requiredCapabilities": [
                        "appendEpisode",
                        "fetchEpisodeByRef",
                        "fetchEpisodesByRefs",
                        "resolveDedupeKeyWithinScope",
                        "tombstoneEpisode",
                    ],
                    "requiredGuarantees": [
                        "episodesNotOverwrittenInPlace",
                        "dedupeLookupIsScoped",
                        "tombstonedContentExcludedFromNormalReads",
                    ],
                },
                "graphStore": {
                    "requiredCapabilities": [
                        "addLink",
                        "fetchOutgoingLinks",
                        "fetchIncomingLinks",
                        "fetchProvenanceChain",
                        "tombstoneLink",
                    ],
                    "requiredGuarantees": [
                        "linksAreScoped",
                        "crossTenantLinksRejectedUnlessExplicitlySupported",
                        "tombstonedLinksExcludedFromNormalTraversal",
                    ],
                },
                "indexStore": {
                    "requiredCapabilities": [
                        "indexMemoryPayload",
                        "removeOrHideIndexedPayload",
                        "searchByQueryPayload",
                        "searchByFilters",
                        "reportIndexFreshnessWhenAvailable",
                    ],
                    "requiredGuarantees": [
                        "tombstonedMemoryNotReturnedAsEligible",
                        "indexingConsistencyBehaviorDeclared",
                        "scoreInterpretationLimitsDeclared",
                    ],
                },
                "metadataStore": {
                    "requiredCapabilities": [
                        "storeScopes",
                        "storeAccessMetadata",
                        "storeAsyncJobs",
                        "storePluginState",
                        "storeEventCursors",
                    ],
                    "requiredGuarantees": [
                        "jobStateTransitionsAreDurable",
                        "scopeMetadataAvailableBeforeMemoryOperations",
                        "runtimeMetadataNotExposedAsMemoryContent",
                    ],
                },
            },
            "openQuestions": ["question"],
        }

    def test_validate_manifest_accepts_current_shape(self):
        validate_manifest(self.make_valid_manifest())

    def test_validate_manifest_rejects_capability_drift(self):
        manifest = self.make_valid_manifest()
        manifest["ports"]["episodeStore"]["requiredCapabilities"].append("newCapability")

        with self.assertRaises(ValidationError):
            validate_manifest(manifest)

    def test_validate_example_requires_backup_restore_when_production(self):
        example = {
            "implementedPorts": ["EpisodeStore", "GraphStore", "IndexStore", "MetadataStore"],
            "transactionalGuarantees": "x",
            "maximumObjectSizes": {"a": 1},
            "indexConsistencyBehavior": "x",
            "paginationBehavior": "x",
            "supportedFilters": ["x"],
            "productionReady": True,
        }
        with self.assertRaises(ValidationError):
            validate_adapter_descriptor(example, "prod")


if __name__ == "__main__":
    unittest.main()
