#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_REQUIRED_FILES = [
    "README.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "docs/vision.md",
    "docs/glossary.md",
    "docs/roadmap.md",
]

ARCH_REQUIRED_FILES = [
    "docs/architecture/overview.md",
    "docs/architecture/boundaries.md",
    "docs/architecture/consistency.md",
    "docs/architecture/security.md",
]

SPEC_REQUIRED_FILES = [
    "docs/specs/data-model.v0.md",
    "docs/specs/memory-api.v0.md",
    "docs/specs/plugin-interface.v0.md",
    "docs/specs/storage-ports.v0.md",
    "docs/specs/context-assembly.v0.md",
]

ADR_DIR = "docs/adr"
ADR_INDEX = "docs/adr/README.md"


@dataclass(frozen=True)
class CheckResult:
    name: str
    errors: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


class SpecIntegrityChecker:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    def run(self) -> list[CheckResult]:
        return [
            self._check_required_files(),
            self._check_specs_status(),
            self._check_adr_index_matches_files(),
            self._check_readme_links_exist(),
        ]

    def _check_required_files(self) -> CheckResult:
        errors: list[str] = []
        for rel in (*REPO_REQUIRED_FILES, *ARCH_REQUIRED_FILES, *SPEC_REQUIRED_FILES, ADR_INDEX):
            if not (self.repo_root / rel).is_file():
                errors.append(f"missing required file: {rel}")
        return CheckResult(name="required-files", errors=tuple(errors))

    def _check_specs_status(self) -> CheckResult:
        errors: list[str] = []
        for rel in SPEC_REQUIRED_FILES:
            path = self.repo_root / rel
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            if "Status: Draft" not in text:
                errors.append(f"{rel}: expected 'Status: Draft'")
            filename = path.name
            if ".v0." not in filename:
                errors.append(f"{rel}: expected v0 filename segment")
        return CheckResult(name="spec-status", errors=tuple(errors))

    def _check_adr_index_matches_files(self) -> CheckResult:
        errors: list[str] = []
        adr_dir = self.repo_root / ADR_DIR
        index_path = self.repo_root / ADR_INDEX
        if not adr_dir.is_dir() or not index_path.is_file():
            return CheckResult(name="adr-index", errors=("adr directory or index missing",))

        adr_files = sorted(p.name for p in adr_dir.glob("[0-9][0-9][0-9][0-9]-*.md"))
        index_text = index_path.read_text(encoding="utf-8")
        listed = sorted({m.group(1) for m in re.finditer(r"\(([^)]+\.md)\)", index_text)})

        missing_from_index = [f for f in adr_files if f not in listed]
        missing_from_dir = [f for f in listed if f not in adr_files]

        if missing_from_index:
            errors.append("adr files missing from index: " + ", ".join(missing_from_index))
        if missing_from_dir:
            errors.append("index references missing adr files: " + ", ".join(missing_from_dir))

        # contiguous numbering keeps adr history explicit no weird gaps
        numbers = sorted(int(name[:4]) for name in adr_files)
        if numbers:
            expected = list(range(numbers[0], numbers[-1] + 1))
            if numbers != expected:
                errors.append(f"adr numbering not contiguous: expected {expected}, found {numbers}")

        return CheckResult(name="adr-index", errors=tuple(errors))

    def _check_readme_links_exist(self) -> CheckResult:
        errors: list[str] = []
        readme_path = self.repo_root / "README.md"
        if not readme_path.is_file():
            return CheckResult(name="readme-links", errors=("README.md missing",))

        text = readme_path.read_text(encoding="utf-8")
        links = [match.group(1) for match in re.finditer(r"\((docs/[^)]+\.md)\)", text)]
        for rel in links:
            if not (self.repo_root / rel).is_file():
                errors.append(f"README links missing target: {rel}")
        return CheckResult(name="readme-links", errors=tuple(errors))


def render_results(results: Iterable[CheckResult]) -> int:
    failures = [result for result in results if not result.ok]
    for result in results:
        if result.ok:
            print(f"[ok] {result.name}")
            continue
        print(f"[fail] {result.name}")
        for error in result.errors:
            print(f"  - {error}")

    if failures:
        print(f"\nIntegrity check failed with {len(failures)} failing check group(s)")
        return 1

    print("\nIntegrity check passed")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate repository spec and docs integrity")
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Path to repository root (default: current directory)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    repo_root = Path(args.repo_root).resolve()
    checker = SpecIntegrityChecker(repo_root=repo_root)
    return render_results(checker.run())


if __name__ == "__main__":
    raise SystemExit(main())
