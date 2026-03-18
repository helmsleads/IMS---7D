---
phase: 1
slug: tool-setup-and-design-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification — this phase produces configuration and markdown artifacts, not application code |
| **Config file** | none |
| **Quick run command** | `uipro --version && python3 --version` |
| **Full suite command** | `uipro --version && test -f design-system/ims7d/MASTER.md && echo "PASS"` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `uipro --version && python3 --version`
- **After every plan wave:** Run `uipro --version && test -f design-system/ims7d/MASTER.md && echo "PASS"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | SETUP-01 | manual | `uipro --version` | N/A | ⬜ pending |
| 01-02 | 01 | 1 | SETUP-03 | manual | `python3 --version` | N/A | ⬜ pending |
| 01-03 | 01 | 1 | SETUP-02 | manual | Review constraint config | N/A | ⬜ pending |
| 01-04 | 01 | 1 | SETUP-04 | manual | `test -f .planning/audit/SCANNER-ROUTES.md` | N/A | ⬜ pending |
| 02-01 | 02 | 2 | DSYS-01 | manual | `test -f design-system/ims7d/MASTER.md` | N/A | ⬜ pending |
| 02-02 | 02 | 2 | DSYS-02 | manual | Review MASTER.md for dual-brand sections | N/A | ⬜ pending |
| 02-03 | 02 | 2 | DSYS-03 | manual | Compare MASTER.md tokens vs globals.css properties | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. This phase produces documentation and configuration artifacts — no test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| uipro-cli installs and initializes | SETUP-01 | CLI install is a one-time setup, not testable in CI | Run `npm install -g uipro-cli && uipro init --ai claude`, verify no errors |
| Dual-brand constraints configured | SETUP-02 | Configuration is a design decision verified by reading output | Check MASTER.md has separate admin/portal token sections |
| Python 3.x available | SETUP-03 | Environment check, not app code | Run `python3 --version`, verify >= 3.x |
| Scanner routes compiled | SETUP-04 | Document audit, not code test | Verify `.planning/audit/SCANNER-ROUTES.md` lists all 12 routes |
| MASTER.md generated with 3PL tokens | DSYS-01 | Design system output is subjective, requires human review | Open MASTER.md, verify colors/typography/layouts/effects/anti-patterns present |
| Dual-brand token sections | DSYS-02 | Brand alignment requires visual judgment | Verify MASTER.md has distinct admin and portal sections |
| Tokens match globals.css | DSYS-03 | Cross-reference check between two files | Compare CSS custom property names in MASTER.md vs globals.css |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
