from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from docs.contracts.contract_validation import ValidationError
from docs.contracts.contract_validation import load_json
from docs.contracts.contract_validation import validate_adapter_descriptor
from docs.contracts.contract_validation import validate_contract_bundle


def build_parser():
    parser = argparse.ArgumentParser(description="Storage contract validation CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    bundle_parser = subparsers.add_parser("bundle", help="Validate contract bundle")
    bundle_parser.add_argument(
        "--root",
        type=Path,
        default=Path("docs/contracts"),
        help="Contracts root directory",
    )

    adapter_parser = subparsers.add_parser("adapter", help="Validate adapter descriptor JSON file")
    adapter_parser.add_argument("--file", type=Path, required=True, help="Path to adapter descriptor JSON")
    adapter_parser.add_argument("--name", type=str, default="adapter", help="Descriptor label for errors")

    return parser


def run_bundle(root: Path):
    validate_contract_bundle(root)
    print("bundle validation passed")


def run_adapter(file_path: Path, name: str):
    descriptor = load_json(file_path)
    if not isinstance(descriptor, dict):
        raise ValidationError("adapter descriptor must be a JSON object")
    validate_adapter_descriptor(descriptor, name)
    print(f"adapter validation passed for {name}")


def main(argv: list[str] | None = None):
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "bundle":
            run_bundle(args.root)
            return 0
        if args.command == "adapter":
            run_adapter(args.file, args.name)
            return 0

        print(f"ERROR: unsupported command {args.command}")
        return 2
    except (ValidationError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}")
        return 1
    except FileNotFoundError as error:
        print(f"ERROR: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
