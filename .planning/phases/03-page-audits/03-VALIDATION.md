---
phase: 3
slug: page-audits
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification — audit documentation phase |
| **Config file** | none |
| **Quick run command** | `test -f .planning/audit/admin-pages.md && test -f .planning/audit/portal-pages.md && echo "PASS"` |
| **Full suite command** | `grep -c "^### " .planning/audit/admin-pages.md && grep -c "^### " .planning/audit/portal-pages.md` |
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
| 03-01 | 01 | 1 | PADM-01,02,03 | manual | `grep -c "^### " .planning/audit/admin-pages.md` | N/A | pending |
| 03-02 | 02 | 2 | PPRT-01,02,03 | manual | `grep -c "^### " .planning/audit/portal-pages.md` | N/A | pending |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Document-only phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All admin pages covered | PADM-01 | Completeness requires human counting | Count page entries in admin-pages.md |
| Scanner pages have floor rubric | PADM-02 | Rubric application is contextual | Check 12 scanner pages for 44px+/16px+ findings |
| Per-page findings documented | PADM-03 | Quality of inconsistency notes | Review finding format and source classification |
| All portal pages covered | PPRT-01 | Completeness requires human counting | Count page entries in portal-pages.md |
| Portal brand guidelines applied | PPRT-02 | Brand compliance is visual judgment | Check for cyan brand findings |
| Brand divergence identified | PPRT-03 | Intentional vs unintentional requires judgment | Check for indigo-on-portal findings flagged |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
