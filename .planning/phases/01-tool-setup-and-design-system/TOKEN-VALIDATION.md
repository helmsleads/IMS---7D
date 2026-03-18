# DSYS-03: Token Validation — MASTER.md vs globals.css

**Date:** 2026-03-18
**MASTER.md version:** IMS-7D Design System — MASTER.md (Version 1.0, locked)
**globals.css location:** src/app/globals.css

---

## Validation Summary

- Total CSS custom properties: 29
- Covered in MASTER.md: 29
- Gaps (not covered): 0
- Status: **PASS**

All 29 CSS custom properties from `src/app/globals.css` are explicitly referenced in `design-system/ims7d/MASTER.md`, either in the token tables (Sections 1-4) or in the Appendix CSS Custom Properties Reference.

---

## Admin Brand Tokens

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--color-primary` | `#4F46E5` | Retain as-is. Admin brand deep indigo. Used for primary buttons, active nav, focus rings, links. Tailwind: `indigo-600`. | N |
| `--color-primary-hover` | `#4338CA` | Retain as-is. Admin button hover, interactive hover states. Tailwind: `indigo-700`. | N |
| `--color-primary-light` | `#EEF2FF` | Retain as-is. Admin pill backgrounds, selected rows, subtle highlights. Tailwind: `indigo-50`. | N |

---

## Portal Brand Tokens

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--color-portal` | `#0891B2` | Retain as-is. Portal primary brand, buttons, active portal nav, portal links. Tailwind: `cyan-600`. | N |
| `--color-portal-hover` | `#0E7490` | Retain as-is. Portal button hover states. Tailwind: `cyan-700`. | N |
| `--color-portal-light` | `#ECFEFF` | Retain as-is. Portal pill backgrounds, portal selected rows. Tailwind: `cyan-50`. | N |

---

## Semantic Tokens

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--color-success` | `#16a34a` | Retain as-is. Maps to received, confirmed, shipped, completed, in-stock states. Tailwind: `green-600`. | N |
| `--color-success-light` | `#f0fdf4` | Retain as-is. Success alert backgrounds, positive row highlights. Tailwind: `green-50`. | N |
| `--color-warning` | `#d97706` | Retain as-is. Maps to pending, processing, low stock, expiring soon states. Tailwind: `amber-600`. | N |
| `--color-warning-light` | `#fffbeb` | Retain as-is. Warning alert backgrounds. Tailwind: `amber-50`. | N |
| `--color-error` | `#dc2626` | Retain as-is. Maps to failed, rejected, damaged, overdue, out-of-stock states. Tailwind: `red-600`. | N |
| `--color-error-light` | `#fef2f2` | Retain as-is. Error alert backgrounds. Tailwind: `red-50`. | N |
| `--color-info` | `#4F46E5` | Retain as-is. Info badges, info alerts. Note: intentionally shares admin primary hue — informational states are admin-branded. | N |
| `--color-info-light` | `#EEF2FF` | Retain as-is. Info alert backgrounds. Tailwind: `indigo-50`. | N |

---

## Neutral Tokens

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--color-bg-page` | `#F8FAFC` | Retain as-is. Page background. Slate-50 is correct for the professional logistics aesthetic — warm enough to not feel clinical, cool enough for data-dense interfaces. | N |
| `--color-bg-subtle` | `#F1F5F9` | Retain as-is. Subtle section backgrounds, zebra rows. Slate-100. | N |
| `--color-bg-card` | `#ffffff` | Retain as-is. Pure white card surfaces maintain clean contrast against the slate-50 page background. | N |
| `--color-text-primary` | `#0F172A` | Retain as-is. Slate-900 for primary text gives excellent contrast (>12:1 on white). Correct for data-dense tables and headings. | N |
| `--color-text-secondary` | `#64748B` | Retain as-is. Slate-500. Verify: contrast ratio against `--color-bg-page` (#F8FAFC) is approximately 4.6:1 — passes WCAG AA for normal text. | N |
| `--color-border` | `#E2E8F0` | Retain as-is. Slate-200 default borders, table dividers, input borders. | N |
| `--color-border-light` | `#F1F5F9` | Retain as-is. Slate-100 subtle dividers, section separators. Note: matches `--color-bg-subtle` — intentional for flush section separators. | N |

---

## Effect Tokens — Shadows

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.03)` | Retain as-is. Subtle depth on flat elements. Correct opacity for premium logistics aesthetic (very light-handed shadows). | N |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` | Retain as-is. Default card elevation. Two-layer shadow is the correct approach — produces more realistic shadows than single-value. | N |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)` | Retain as-is. Card hover state. Appropriate lift to indicate interactivity without being dramatic. | N |
| `--shadow-elevated` | `0 8px 25px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)` | Retain as-is. Popovers, dropdowns. Correct elevation hierarchy. | N |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.05)` | Retain as-is. Modal dialogs. Heavy shadow appropriate for full-overlay modal pattern. | N |

---

## Effect Tokens — Radii

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| `--radius-sm` | `0.375rem` (6px) | Retain as-is. Badges, pills, small inputs, chips. | N |
| `--radius-md` | `0.5rem` (8px) | Retain as-is. Buttons, inputs, form fields. Slightly rounder than sharp, but not overly soft. | N |
| `--radius-lg` | `0.75rem` (12px) | Retain as-is. Cards, panels, dropdowns. | N |
| `--radius-xl` | `1rem` (16px) | Retain as-is. Modals, large panels, prominent containers. | N |

---

## Gaps

None — all 29 CSS custom properties have explicit MASTER.md coverage.

---

## Notes on Design Evolution

MASTER.md documents the **current values as retained** — this is consistent with the design system approach for an audit-first project. The v1 implementation phase (Phases 2-4) may recommend value changes based on audit findings. If changes are recommended:

1. Update `globals.css` with the new values
2. Update the "MASTER.md Recommendation" column in this file to reflect the recommended change
3. Mark the "Gap?" column as `Y (resolved)` with a note on the finding reference

---

## Token Count Reference

| Category | Count |
|----------|-------|
| Admin brand tokens | 3 |
| Portal brand tokens | 3 |
| Semantic tokens | 8 |
| Neutral tokens | 7 |
| Shadow tokens | 5 |
| Radius tokens | 4 |
| **Total** | **29** |

---

*Token Validation completed: 2026-03-18*
*MASTER.md: design-system/ims7d/MASTER.md*
*globals.css: src/app/globals.css*
