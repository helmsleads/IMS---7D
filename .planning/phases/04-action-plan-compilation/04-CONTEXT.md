# Phase 4: Action Plan Compilation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Synthesize all audit findings from components.md (195), admin-pages.md (235), and portal-pages.md (116) into two deliverables: PRIORITIES.md (severity-tiered with capped tiers) and IMPLEMENTATION.md (sequenced with file paths, changes, and effort estimates). Include a quick wins list and suggested implementation phases for the next milestone. No code changes.

</domain>

<decisions>
## Implementation Decisions

### Priority Logic
- **Severity first** — highest severity wins regardless of component vs page; a Blocking page fix beats a Medium component fix
- **Per-component granularity** for portal brand divergence — list each component needing a portal variant (Button, Input, Select, Textarea, Toggle) as separate Blocking items, not one consolidated CC-04 item
- **Per-component granularity** for scanner tap-target violations — each scanner component with violations gets its own Blocking item, not consolidated by pattern

### Quick Wins Criteria
- **Claude's discretion** on what qualifies (likely High+ severity + XS-S effort)
- **No cap** — list all items that qualify as quick wins
- Quick wins surfaced as a **distinct list** within PRIORITIES.md

### Action Plan Structure
- **Claude's discretion** on IMPLEMENTATION.md organization (likely by implementation wave: components → admin → portal)
- **Include suggested phases** — recommend how many implementation phases/PRs the next milestone should have
- Two output files:
  - `.planning/action-plan/PRIORITIES.md` — Blocking (≤20), High-value (≤40), Polish tiers
  - `.planning/action-plan/IMPLEMENTATION.md` — sequenced items with file path, change, effort estimate

### Carried from Prior Phases (locked)
- Tier caps: Blocking ≤20, High-value ≤40 (from roadmap success criteria)
- 546 total findings across 3 source files to synthesize
- Root cause taxonomy: RC-01 through RC-05, CC-01 through CC-05
- Effort estimates already present on most findings (XS/S/M/L)
- Action plan must be usable as direct input for implementation milestone (PLAN-04)

### Claude's Discretion
- Quick win threshold definition
- IMPLEMENTATION.md organization (wave-based, severity-based, or root-cause-based)
- How many implementation phases to suggest
- Whether to include a dependency graph between action items
- How to handle the consolidation from 546 findings down to ≤60 tiered items (Blocking 20 + High 40)

</decisions>

<specifics>
## Specific Ideas

- The consolidation challenge is the core intellectual work — 546 raw findings must become ≤60 actionable items without losing information
- Component fixes have multiplier effects (fixing Button resolves findings on 40+ pages) — even though severity-first is the primary sort, the effort-to-impact ratio should be visible in IMPLEMENTATION.md
- The suggested implementation phases should be concrete enough that `/gsd:new-milestone` for v2.0 can consume them directly

</specifics>

<code_context>
## Existing Code Insights

### Source Audit Files
- `.planning/audit/components.md`: 195 findings, 37 components, RC-01–RC-05 taxonomy
- `.planning/audit/admin-pages.md`: 235 findings, 62 pages, 20 feature areas
- `.planning/audit/portal-pages.md`: 116 findings, 29 pages, 14 feature areas, brand divergence summary

### Key Consolidation Opportunities
- RC-01 (gray→slate): affects 19/27 shared components + most pages — one migration pass
- CC-04 (portal variant absence): 38 Blocking findings resolved by adding portal variants to 5 components
- Scanner tap targets: pattern-based fix (remove size="sm") resolves multiple scanner components
- prefers-reduced-motion: one globals.css addition covers 17 animated components

### Output Location
- `.planning/action-plan/PRIORITIES.md`
- `.planning/action-plan/IMPLEMENTATION.md`
- Phase 4 action plan consumed by implementation milestone v2.0

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-action-plan-compilation*
*Context gathered: 2026-03-19*
