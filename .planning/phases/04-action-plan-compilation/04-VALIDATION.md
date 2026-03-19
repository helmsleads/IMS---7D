---
phase: 4
slug: action-plan-compilation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | N/A — documentation-only phase |
| **Config file** | none |
| **Quick run command** | `ls .planning/action-plan/PRIORITIES.md .planning/action-plan/IMPLEMENTATION.md` |
| **Full suite command** | Manual review against success criteria checklist |
| **Estimated runtime** | ~2 seconds (file existence check) |

---

## Sampling Rate

- **After every task commit:** Run `ls .planning/action-plan/PRIORITIES.md .planning/action-plan/IMPLEMENTATION.md`
- **After every plan wave:** Manual review against success criteria
- **Before `/gsd:verify-work`:** Full checklist must pass
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PLAN-01 | manual | Count rows in PRIORITIES.md Blocking/High sections | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PLAN-02 | manual | Grep for `## Quick Wins` in PRIORITIES.md | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | PLAN-03 | manual | Verify `src/` paths in Files column of IMPLEMENTATION.md | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | PLAN-04 | manual | Grep for `## Wave` sections in IMPLEMENTATION.md | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/action-plan/` directory — create before writing files
- [ ] `.planning/action-plan/PRIORITIES.md` — covers PLAN-01, PLAN-02
- [ ] `.planning/action-plan/IMPLEMENTATION.md` — covers PLAN-03, PLAN-04

*No test framework installation needed — documentation deliverables only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blocking tier ≤20 items | PLAN-01 | Document structure review | Count items under `## Blocking` heading; verify ≤20 |
| High-value tier ≤40 items | PLAN-01 | Document structure review | Count items under `## High-Value` heading; verify ≤40 |
| Quick wins list present | PLAN-02 | Document content review | Verify `## Quick Wins` section exists with distinct item list |
| Each item has file path + change + effort | PLAN-03 | Content completeness | Spot-check 5 random items for all three fields |
| Wave structure for v2.0 handoff | PLAN-04 | Document organization | Verify implementation waves present and logically ordered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
