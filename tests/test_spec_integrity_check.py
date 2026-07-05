from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.spec_integrity_check import SpecIntegrityChecker


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class SpecIntegrityCheckerTests(unittest.TestCase):
    def _build_valid_repo(self, root: Path) -> None:
        write(root / "README.md", "# infinicon\n\n- [Vision](docs/vision.md)\n")
        write(root / "CONTRIBUTING.md", "# Contributing\n")
        write(root / "CODE_OF_CONDUCT.md", "# CoC\n")

        write(root / "docs/vision.md", "# Vision\n")
        write(root / "docs/glossary.md", "# Glossary\n")
        write(root / "docs/roadmap.md", "# Roadmap\n")

        write(root / "docs/architecture/overview.md", "# Overview\n")
        write(root / "docs/architecture/boundaries.md", "# Boundaries\n")
        write(root / "docs/architecture/consistency.md", "# Consistency\n")
        write(root / "docs/architecture/security.md", "# Security\n")

        write(root / "docs/specs/data-model.v0.md", "# Data model\n\nStatus: Draft\n")
        write(root / "docs/specs/memory-api.v0.md", "# Memory API\n\nStatus: Draft\n")
        write(root / "docs/specs/plugin-interface.v0.md", "# Plugin interface\n\nStatus: Draft\n")
        write(root / "docs/specs/storage-ports.v0.md", "# Storage ports\n\nStatus: Draft\n")
        write(root / "docs/specs/context-assembly.v0.md", "# Context assembly\n\nStatus: Draft\n")

        write(root / "docs/adr/0001-first.md", "# ADR\n")
        write(root / "docs/adr/0002-second.md", "# ADR\n")
        write(
            root / "docs/adr/README.md",
            "# ADRs\n\n- [0001](0001-first.md)\n- [0002](0002-second.md)\n",
        )

    def test_valid_repo_passes_all_checks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._build_valid_repo(root)
            results = SpecIntegrityChecker(repo_root=root).run()
            failed = [result for result in results if not result.ok]
            self.assertEqual([], failed)

    def test_missing_required_file_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._build_valid_repo(root)
            (root / "docs/specs/memory-api.v0.md").unlink()

            results = SpecIntegrityChecker(repo_root=root).run()
            required = next(result for result in results if result.name == "required-files")

            self.assertFalse(required.ok)
            self.assertTrue(any("memory-api.v0.md" in error for error in required.errors))

    def test_adr_index_mismatch_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._build_valid_repo(root)
            write(root / "docs/adr/README.md", "# ADRs\n\n- [0001](0001-first.md)\n")

            results = SpecIntegrityChecker(repo_root=root).run()
            adr = next(result for result in results if result.name == "adr-index")

            self.assertFalse(adr.ok)
            self.assertTrue(any("missing from index" in error for error in adr.errors))

    def test_readme_broken_doc_link_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._build_valid_repo(root)
            write(
                root / "README.md",
                "# infinicon\n\n- [Vision](docs/vision.md)\n- [Nope](docs/nope.md)\n",
            )

            results = SpecIntegrityChecker(repo_root=root).run()
            links = next(result for result in results if result.name == "readme-links")

            self.assertFalse(links.ok)
            self.assertTrue(any("docs/nope.md" in error for error in links.errors))


if __name__ == "__main__":
    unittest.main()
