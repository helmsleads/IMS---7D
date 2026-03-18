---
phase: 2
slug: component-library-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification — this phase produces audit documentation, not application code |
| **Config file** | none |
| **Quick run command** | `test -f .planning/audit/components.md && echo "PASS"` |
| **Full suite command** | `test -f .planning/audit/components.md && grep -c "##" .planning/audit/components.md` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01 | 01 | 1 | COMP-01 | manual | `grep -c "###" .planning/audit/components.md` | N/A | ⬜ pending |
| 02-02 | 01 | 1 | COMP-02 | manual | `grep -c "Blocking\|High\|Medium\|Low" .planning/audit/components.md` | N/A | ⬜ pending |
| 02-03 | 01 | 1 | COMP-03 | manual | `grep -c "focus\|contrast\|ARIA\|a11y" .planning/audit/components.md` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. This phase produces audit documentation — no test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 37 components have findings | COMP-01 | Document completeness requires human counting | Count component sections in components.md, verify >= 37 |
| Each finding has severity rating | COMP-02 | Severity classification is subjective judgment | Verify every finding has Blocking/High/Medium/Low tag |
| Accessibility gaps identified | COMP-03 | a11y gaps require contextual evaluation | Check components.md for focus state, contrast, ARIA findings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
