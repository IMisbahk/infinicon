#!/usr/bin/env python3
import sys
from pathlib import Path

try:
    from docs.contracts.contract_validation import ValidationError
    from docs.contracts.contract_validation import validate_contract_bundle
except ModuleNotFoundError:
    from contract_validation import ValidationError
    from contract_validation import validate_contract_bundle

ROOT = Path(__file__).resolve().parent


def run_validation():
    validate_contract_bundle(ROOT)


def main():
    try:
        run_validation()
        print("storage contract validation passed")
    except ValidationError as error:
        print(f"ERROR: {error}")
        sys.exit(1)
    except Exception as error:
        print(f"ERROR: unexpected validation failure: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
