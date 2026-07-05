import unittest
from pathlib import Path

from docs.contracts.contract_validation import ValidationError
from docs.contracts.contract_validation import validate_adapter_descriptor
from docs.contracts.contract_validation import validate_contract_bundle


class ContractValidationLibraryTests(unittest.TestCase):
    def test_validate_contract_bundle_passes_for_repo_contracts(self):
        root = Path("docs/contracts")
        validate_contract_bundle(root)

    def test_validate_adapter_descriptor_rejects_missing_required_fields(self):
        bad_descriptor = {
            "implementedPorts": ["EpisodeStore", "GraphStore", "IndexStore", "MetadataStore"],
            "transactionalGuarantees": "x",
            "maximumObjectSizes": {"bytes": 1},
            "indexConsistencyBehavior": "x",
            "paginationBehavior": "x",
        }
        with self.assertRaises(ValidationError):
            validate_adapter_descriptor(bad_descriptor, "bad")


if __name__ == "__main__":
    unittest.main()
