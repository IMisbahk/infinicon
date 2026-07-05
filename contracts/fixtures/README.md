# Fixture data

Fixtures are representative valid payloads for contract validation.

Current files:

- `data-model.valid.json` — valid atom envelope for `data-model.v0.schema.json`
- `data-model.invalid.missing-scope.json` — invalid envelope missing required `tenantId`
- `context-assembly.valid.json` — valid request/response envelope for context assembly schema
- `context-assembly.invalid.bad-warning.json` — invalid warning code outside allowed enum
- `memory-api.ingest.valid.json` — valid ingest request example matching API contract intent

Guidance:

- keep fixture names explicit (`<domain>.<scenario>.<valid|invalid>.json`)
- when adding a new normative rule, add at least one valid and one invalid fixture
- avoid domain-specific assumptions that are not in v0 specs
