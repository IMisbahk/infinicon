import subprocess
import unittest


class ContractCliTests(unittest.TestCase):
    def test_bundle_command_passes(self):
        completed = subprocess.run(
            [
                "python3",
                "-m",
                "docs.contracts.contract_cli",
                "bundle",
                "--root",
                "docs/contracts",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, msg=completed.stderr + completed.stdout)
        self.assertIn("bundle validation passed", completed.stdout)

    def test_adapter_command_fails_for_missing_file(self):
        completed = subprocess.run(
            [
                "python3",
                "-m",
                "docs.contracts.contract_cli",
                "adapter",
                "--file",
                "docs/contracts/examples/does-not-exist.json",
                "--name",
                "missing",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 1)
        self.assertIn("ERROR:", completed.stdout)


if __name__ == "__main__":
    unittest.main()
