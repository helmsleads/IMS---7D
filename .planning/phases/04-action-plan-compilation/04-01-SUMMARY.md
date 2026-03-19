---
phase: 04-action-plan-compilation
plan: "01"
subsystem: action-plan
tags: [priorities, synthesis, action-plan, ui-ux, audit]
dependency_graph:
  requires:
    - "03-page-audits/audit/components.md"
    - "03-page-audits/audit/admin-pages.md"
    - "03-page-audits/audit/portal-pages.md"
  provides:
    - ".planning/action-plan/PRIORITIES.md"
  affects:
    - "Phase 5 implementation milestone (v2.0)"
tech_stack:
  added: []
  patterns:
    - "Severity-first tiered action plan (Blocking ≤20, High-value ≤40)"
    - "Multiplier principle: component fixes cascade to all using pages"
    - "Quick wins = High/Blocking severity + XS/S effort + 5+ finding multiplier"
key_files:
  created:
    - ".planning/action-plan/PRIORITIES.md"
  modified: []
decisions:
  - "20 Blocking items: 7 scanner tap-target violations, 5 portal brand variants (per-component), 3 scanner page overrides, 1 Pagination, 2 portal blue bleed, 1 Modal ARIA, 1 SearchSelect ARIA"
  - "Portal component variants kept as 5 separate Blocking items per locked decision (Button, Input, Select, Textarea, Toggle)"
  - "Task queue action buttons consolidated to 1 Blocking item covering 3 pages (Pick/Putaway/Inspection queues all share same size=sm pattern)"
  - "Billing/plan pages consolidated: plan page + invoice/[id] page = 1 Blocking item (same blue-* pattern)"
  - "40 High-value items reached exactly via: 8 component colors + 5 accessibility + 5 scanner text + 10 admin inline + 7 portal inline + 5 cross-cutting"
  - "Polish backlog captures 76 items — all 149 Medium + 46 Low raw findings accounted for"
  - "Quick wins threshold: Blocking or High severity + XS or S effort + resolves 5+ raw findings or affects 10+ pages"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-19"
  tasks_completed: 1
  files_created: 1
---

# Phase 4 Plan 01: Create PRIORITIES.md Summary

**One-liner:** Severity-tiered action plan synthesizing 524 raw findings into 20 Blocking + 40 High + 15 Quick Wins + 76 Polish items using root cause multiplier consolidation.

---

## What Was Done

Created `.planning/action-plan/PRIORITIES.md` — the core synthesis deliverable for Phase 4. This file consolidates 524 raw findings from three completed audit files into a capped, severity-tiered action plan suitable as direct input for the v2.0 implementation milestone.

### Tier Breakdown

| Tier | Items | Cap Met? | Raw Findings Resolved |
|------|-------|---------|----------------------|
| Blocking | 20 | Yes (exactly 20) | 133+ Blocking raw findings |
| High-Value | 40 | Yes (exactly 40) | 196+ High raw findings |
| Quick Wins | 15 | N/A (no cap) | Cross-references Blocking/High |
| Polish Backlog | 76 | N/A (no cap) | 149 Medium + 46 Low raw findings |

### Key Consolidation Decisions

**Blocking tier (20 items) composition:**
- Items 1–7: Scanner tap-target violations (one per scanner component)
- Items 8–12: Portal brand identity violations (one per component: Button, Input, Select, Textarea, Toggle)
- Items 13–15: Scanner page inline overrides (Inventory Transfers, Task queues, Location Sublocations)
- Item 16: Pagination on scanner routes
- Items 17–18: Portal inline blue violations (2 page groups)
- Item 19: Modal `role="dialog"` ARIA
- Item 20: SearchSelect ARIA combobox pattern

**Multiplier principle applied:**
- Button portal variant (item 8, effort M) resolves 38 Blocking findings across all 29 portal pages
- Alert fix (High B-01, effort XS) cascades to 40+ pages
- Badge fix (High B-02, effort S) cascades to 50+ pages
- globals.css prefers-reduced-motion (High B-36, effort S) covers 17 animated components

**High-value tier overflow:** Items that couldn't fit within the 40-item cap without displacing higher-priority items were moved to the Polish backlog. No Blocking items were downgraded to make room.

---

## Deviations from Plan

None — plan executed exactly as written.

The plan specified exact 20 Blocking items from the RESEARCH.md candidates list. All 20 were implemented as specified:
- 7 scanner safety violations (items 1–7)
- 5 portal brand identity violations (items 8–12)
- 3 scanner page tap-target violations (items 13–15)
- 1 Pagination on scanner routes (item 16)
- 2 portal inline blue violations (items 17–18)
- 1 Modal accessibility (item 19)
- 1 SearchSelect ARIA combobox (item 20)

---

## Verification Results

1. Blocking tier: 20 items — PASS (verified by Python count returning rows 1–20 with max=20)
2. High-value tier: 40 items — PASS (B-01 through B-40 present)
3. Quick Wins section: Present as distinct `## Quick Wins` section — PASS
4. Polish Backlog section: Present as `## Polish Backlog` with 76 grouped items — PASS
5. Portal component variants: 5 separate Blocking items (#8 Button, #9 Input, #10 Select, #11 Textarea, #12 Toggle) — PASS
6. Scanner safety items: 7 in Blocking tier (items 1–7, one per scanner component) — PASS
7. Every item has file path reference: Verified — all rows contain `src/` paths — PASS
8. Traceability section present: Documents which source files map to which tier items — PASS

---

## Self-Check: PASSED

Files verified:
- `.planning/action-plan/PRIORITIES.md` — EXISTS (32,857 bytes)
- Commit `bff7a79` — EXISTS (verified via git log)
