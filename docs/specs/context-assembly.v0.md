# Context Assembly Specification v0

Status: Draft

Context assembly is the process of constructing bounded working context for an agent task.

## Goals

- Return relevant memory within a caller-provided budget.
- Preserve provenance for every segment.
- Report truncation, staleness, and disputed memory.
- Keep formatting separate from selection.

## Inputs

An assembly request includes:

- Scope.
- Task or query.
- Context budget.
- Filters.
- Constraints.
- Consistency preference.

Constraints may include:

- Must include refs.
- Excluded refs.
- Include or exclude disputed memory.
- Prefer recency.
- Prefer high-confidence memory.
- Maximum segments.

## Output

The output is a `WorkingContext`.

It must include:

- Segments.
- Token estimate.
- Truncation flag.
- Warnings.
- Generation time.

Each segment should include:

- Memory ref.
- Content or excerpt.
- Score.
- Reason for inclusion.
- Provenance.

## Abstract Algorithm

The v0 abstract algorithm is:

1. Validate scope, budget, filters, and constraints.
2. Retrieve candidate memory refs.
3. Apply authorization and lifecycle filters.
4. Rank candidates for the task.
5. Hydrate selected candidates.
6. Remove or mark stale, disputed, or superseded content according to request constraints.
7. Apply token and segment budgets.
8. Order segments for agent usability.
9. Return structured context with warnings.

Implementations may vary internally if they preserve externally visible behavior.

## Budgeting

Budgets are approximate unless the runtime and caller agree on a tokenizer.

The runtime must expose:

- Estimated token count.
- Whether truncation occurred.
- Whether required refs were omitted due to budget.

## Empty Context

If no memory matches, the runtime must return an empty working context.

It must not invent background knowledge to make the response look useful. That is the agent or model's responsibility.

## Warnings

Initial warning codes:

- `empty_context`
- `truncated`
- `required_ref_omitted`
- `stale_consolidation`
- `disputed_memory_included`
- `superseded_memory_included`
- `eventual_consistency`
- `partial_hydration`

## Formatting

Context assembly returns structured data.

Provider-specific prompt strings belong in formatter plugins. Formatting must not change the selected memory set unless the caller performs a new assembly request.

## Open Questions

- Should segment ordering optimize for chronology, relevance, or dependency graph order by default?
- Should the runtime support multiple named assembly strategies?
- How should context quality be evaluated in conformance tests?
