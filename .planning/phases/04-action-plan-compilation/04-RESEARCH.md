# Phase 4: Action Plan Compilation - Research

**Researched:** 2026-03-19
**Domain:** Audit synthesis — tiered prioritization, consolidation, and implementation roadmap creation
**Confidence:** HIGH (all findings sourced directly from completed audit files)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Priority Logic**
- Severity first — highest severity wins regardless of component vs page; a Blocking page fix beats a Medium component fix
- Per-component granularity for portal brand divergence — list each component needing a portal variant (Button, Input, Select, Textarea, Toggle) as separate Blocking items, not one consolidated CC-04 item
- Per-component granularity for scanner tap-target violations — each scanner component with violations gets its own Blocking item, not consolidated by pattern

**Quick Wins Criteria**
- Claude's discretion on what qualifies (likely High+ severity + XS-S effort)
- No cap — list all items that qualify as quick wins
- Quick wins surfaced as a distinct list within PRIORITIES.md

**Action Plan Structure**
- Claude's discretion on IMPLEMENTATION.md organization (likely by implementation wave: components → admin → portal)
- Include suggested phases — recommend how many implementation phases/PRs the next milestone should have
- Two output files:
  - `.planning/action-plan/PRIORITIES.md` — Blocking (≤20), High-value (≤40), Polish tiers
  - `.planning/action-plan/IMPLEMENTATION.md` — sequenced items with file path, change, effort estimate

**Carried from Prior Phases (locked)**
- Tier caps: Blocking ≤20, High-value ≤40 (from roadmap success criteria)
- 546 total findings across 3 source files to synthesize (195 components + 213 admin-pages + 116 portal-pages; note admin-pages header says 213 but overview table shows 235 — use 235 as audited count, 213 as verified finding count)
- Root cause taxonomy: RC-01 through RC-05, CC-01 through CC-05
- Effort estimates already present on most findings (XS/S/M/L)
- Action plan must be usable as direct input for implementation milestone (PLAN-04)

### Claude's Discretion

- Quick win threshold definition
- IMPLEMENTATION.md organization (wave-based, severity-based, or root-cause-based)
- How many implementation phases to suggest
- Whether to include a dependency graph between action items
- How to handle the consolidation from 546 findings down to ≤60 tiered items (Blocking 20 + High 40)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | User can review a severity-tiered action plan with capped tiers (Blocking ≤20, High-value ≤40) | Blocking tier: 20 consolidated items identified from 25+61=86 raw Blocking findings. High tier: 40 consolidated items from ~91+91+14=196 raw High findings. Consolidation strategy documented below. |
| PLAN-02 | User can identify quick wins (high impact, low effort changes) | Quick win candidates identified: High+ severity + XS/S effort. Approximately 15–20 items qualify. All are XS effort single-file or single-component changes with outsized impact (component fixes cascade to 40+ pages). |
| PLAN-03 | User can review a sequenced implementation roadmap with effort estimates for each change | All findings carry XS/S/M/L estimates from audit. IMPLEMENTATION.md wave structure (Wave 0: globals, Wave 1: shared components, Wave 2: scanner components, Wave 3: admin pages, Wave 4: portal pages) provides natural sequencing. |
| PLAN-04 | User can use the action plan as direct input for the next milestone's implementation phases | The 4-wave structure maps directly to 4 PRs/implementation phases for v2.0 milestone. Each wave is independently mergeable. Dependencies are documented (component fixes before page fixes). |
</phase_requirements>

---

## Summary

Phase 4 synthesizes 546 raw findings from three audit files (components.md: 195, admin-pages.md: 235, portal-pages.md: 116) into two output deliverables: PRIORITIES.md (severity-tiered, capped) and IMPLEMENTATION.md (sequenced with file paths and effort estimates). This is an intellectual synthesis task, not a code or tooling task — no new research is needed beyond reading the audit files that already exist.

The core challenge is consolidation without information loss. The 546 raw findings reduce dramatically once root causes are applied: five root causes (RC-01 through RC-05) plus five cross-cutting concerns (CC-01 through CC-05) account for the vast majority of all findings. A "fix Button portal variant" action item (one line in PRIORITIES.md) resolves 38 Blocking findings across 29 portal pages simultaneously. The planner must understand this multiplier logic to build a useful action plan.

The Blocking tier (≤20 items) must capture the genuine must-ship blockers: scanner safety violations, brand identity merge (portal rendering admin colors), and WCAG accessibility failures. The High tier (≤40 items) captures significant visual inconsistencies that create scale-level credibility problems. Everything else goes to Polish backlog, which has no cap.

**Primary recommendation:** Organize IMPLEMENTATION.md as four waves (globals.css → shared components → scanner components → pages), because later waves depend on earlier waves and each wave is independently mergeable as a PR.

---

## Findings Inventory

### Raw Findings by Source File

| File | Blocking | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| components.md | 25 | 91 | 70 | 9 | 195 |
| admin-pages.md | 47 | 91 | 62 | 13 | 213 |
| portal-pages.md | 61 | 14 | 17 | 24 | 116 |
| **Total raw** | **133** | **196** | **149** | **46** | **524** |

Note: admin-pages.md header states 235 total pages-audited but 213 findings — the 213 is the verified finding count used here. Some findings are marked "Pass" (not counted). The 546 figure from CONTEXT.md includes pass/note entries; 524 is findings-only count.

### Root Cause Distribution (components.md)

| Root Cause | ~Finding Count | Primary Fix Location |
|------------|---------------|---------------------|
| RC-01: gray→slate | ~65 | `src/components/ui/` codebase-wide |
| RC-02: hardcoded blue/token non-use | ~48 | Per-component, per-page |
| RC-03: focus:ring → focus-visible:ring | ~7 (components) + many pages | Per-component + pages |
| RC-04: scanner text below 16px | 35 (scanner) | Scanner component files |
| RC-05: props API gaps | ~12 | Per-component |
| Scanner tap targets below 44px | 22 | Scanner component files |

---

## Consolidation Strategy

### The Multiplier Principle

The most important insight for building the action plan: **component-layer fixes cascade**.

| Fix | Raw Findings Resolved | Files Changed |
|-----|----------------------|---------------|
| Button portal variant | 38 Blocking (all portal pages) | 1 file |
| Badge yellow→amber + blue→indigo | Dozens of High findings on 30+ pages | 1 file |
| Alert blue→indigo, yellow→amber | High findings on 20+ pages | 1 file |
| prefers-reduced-motion in globals.css | 17 High findings | 1 file |
| Breadcrumbs aria-label + focus ring | High findings on 10+ pages | 1 file |
| RC-01 gray→slate in Table | 16 Medium findings | 1 file |
| RC-01 gray→slate in Skeleton | 12 Medium findings | 1 file |

This means the action plan should list these as single items even though they resolve dozens of raw findings. The IMPLEMENTATION.md should note the multiplier effect explicitly.

### Blocking Tier Candidates (~20 items)

The 25 component Blocking + 47 admin Blocking + 61 portal Blocking = 133 raw Blocking findings consolidate as follows:

**Scanner safety violations (7 items):**
1. PickingScanner: audio toggle tap target + pick button size="sm" (2 Blocking in 1 file)
2. PickScanner: 4 size="sm" buttons (audio, decrement, increment, pick all) — 1 file
3. PackScanner: 2 size="sm" buttons — 1 file
4. ShipScanner: audio toggle tap target — 1 file
5. ReceivingScanner: 3 raw button tap target violations (audio, lot scan, calendar reset) — 1 file
6. PalletBreakdownScanner: 5 tap target violations (quick buttons, start over, done, error dismiss) + text-xs pallet info — 1 file
7. BarcodeScanner: instruction text text-sm/text-xs, close button p-1 — 1 file

**Portal brand identity violations (5 items — per-component per locked decision):**
8. Button: add portal variant (from-cyan-500 to-teal-600) — resolves 38 portal Blocking findings
9. Input: add portal variant (focus-visible:ring-cyan-500) — resolves Blocking on all portal form pages
10. Select: add portal variant (focus-visible:ring-cyan-500) — same
11. Textarea: add portal variant (focus-visible:ring-cyan-500) — same
12. Toggle: add portal variant (bg-cyan-600 active state) — same

**Scanner page tap-target violations (3 items):**
13. Inventory Transfers (scanner): action buttons size="sm", text violations — 6 Blocking inline overrides
14. Task queues (Pick, Putaway, Inspection, Task Detail): all use size="sm" buttons — single pattern resolves Blocking on 4 pages
15. Location Sublocations (scanner): entire gray-*/blue-* page palette, form inputs with blue focus rings — worst scanner page

**Pagination on scanner routes (1 item):**
16. Pagination component: w-9 h-9 (36px) — Blocking on scanner routes (Pick Queue, Putaway Queue, Inspection Queue)

**Portal inline blue violations (2 items):**
17. request-shipment/confirmation: bg-blue-600, bg-blue-50, text-blue-600 (blue not in palette)
18. Billing/plan/invoice pages: text-blue-600, bg-blue-600 (blue not in palette) — 3 pages, same pattern

**Modal accessibility (1 item):**
19. Modal: missing role="dialog" + aria-modal="true" — affects all modal usage across admin and portal

**SearchSelect ARIA combobox (1 item):**
20. SearchSelect: missing role="combobox", role="listbox", role="option" — keyboard/screen-reader broken

That is exactly 20 Blocking items. The decision logic is: scanner safety first, portal brand second, modal/form ARIA third. All are genuine ship-blockers per MASTER.md hard rules.

### High-Value Tier Candidates (~40 items)

The 196 raw High findings consolidate significantly. Representative items (planner to finalize):

**Component color corrections (8 items):**
- Alert: warning yellow→amber, info blue→indigo, close button focus ring + aria-label
- Badge: warning yellow→amber, info blue→indigo, border pattern, shade corrections
- Spinner: border-t-blue-600→indigo-600, add role="status" + aria-label, prefers-reduced-motion
- StatCard: iconColor default bg-blue-50→indigo-50
- Toast: info blue→indigo, add warning variant
- Toggle: checked state bg-blue-600→indigo-600
- Textarea: focus ring blue→indigo, focus:ring→focus-visible:ring
- Pagination: active page bg-gray-900→indigo-600, no focus rings on buttons

**Shared component accessibility (5 items):**
- Breadcrumbs: home link aria-label, focus rings on all links, nav aria-label="Breadcrumb"
- Card: clickable card missing role="button" + keyboard handler
- Modal: close button aria-label + focus ring (separate from role="dialog" Blocking above)
- Chart components (13): add aria-label prop + role="img" wrapper — all 13 missing ARIA
- Recharts animation: add prefers-reduced-motion guards (isAnimationActive via useReducedMotion hook)

**Scanner component text sizes (5 items):**
- PickingScanner: text-sm → text-base on SKU, location hints, progress subtitle
- PickScanner: text-sm → text-base on product name, item count
- PackScanner: text-sm → text-base on carton count, carton items, product name
- ShipScanner: text-sm → text-base on order number, progress, carrier labels
- ReceivingScanner: text-sm → text-base on SKU, remaining qty, lot form labels

**Admin page inline color corrections (10 items):**
- Dashboard: StatCard icon color bg-blue-50→indigo-50, decorative blob removal
- Inbound/Outbound pages: status tab yellow→amber, blue→indigo, purple→neutral
- Tasks List: putaway icon bg-blue-50→indigo-50, priority badges → use Badge component
- Lots List: active tab blue→indigo, search input blue→indigo, lot links blue→indigo
- Reports Hub: report card icon blue→indigo, purple→indigo
- Location Sublocations: blue inline overrides (not scanner-safe ones — those are Blocking)
- Admin auth page: admin login page color corrections if any

**Portal page inline color corrections (7 items — inline-only, post-component-fix):**
- orders/[id]: packed status indigo inline override → cyan
- inventory/history: pack transaction indigo/blue → cyan
- lots/[id]: transfer transaction indigo → cyan
- forgotpassword + reset-password: bg-slate-50 → dark gradient (match client-login)
- Portal auth flow: raw input elements → use Input component (forgot-password, reset-password)
- Templates page: bg-blue-600 CTAs → cyan gradient
- Integrations/shopify/location: blue selected state → cyan

**Cross-cutting (5 items):**
- globals.css: add @media prefers-reduced-motion block for all keyframes (CC-01)
- StatCard useAnimatedNumber: add prefers-reduced-motion guard (CC-01 companion)
- RC-01 systematic gray→slate: shared components (Button, Table, Skeleton, Pagination, etc.)
- Dark mode classes removal: PickScanner, PackScanner, ShipScanner, ReceivingScanner (RC-05)
- StatusBadge refactor: direct variant mapping instead of Tailwind class string key (RC-05)

That gives approximately 40 High-value items. Items not fitting within 40 migrate to Polish backlog.

### Quick Wins Definition

Quick wins = High or Blocking severity + XS or S effort + disproportionate impact.

**Criteria this project uses (Claude's discretion):**
- Severity: Blocking or High
- Effort: XS or S
- Impact multiplier: resolves 5+ raw findings, or fixes a component used on 10+ pages

**Confirmed quick win candidates:**
1. Alert: warning+info colors + close button aria-label (XS each, used on ~40 pages)
2. Badge: warning+info colors + border pattern (XS, used on ~50 pages)
3. Spinner: blue→indigo + role="status" (XS, used on ~30 pages)
4. Toggle: blue→indigo checked state (XS, used on ~15 pages)
5. StatCard: iconColor default blue→indigo (XS, used on every dashboard)
6. globals.css: prefers-reduced-motion block (S, fixes 17 animated components at once)
7. Breadcrumbs: aria-label + focus rings (XS, used on ~20 detail pages)
8. Inventory Transfers scanner: gray→slate + remove size="sm" (XS each, 6 Blocking inline fixes)
9. Task queue action buttons: remove size="sm" on Pick/Putaway/Inspection queues (XS, resolves Blocking on 3 pages)
10. Portal: Button portal variant (M effort but Blocking severity resolving 38 findings — M is acceptable for a quick win given multiplier)
11. RC-01 gray→slate in Skeleton (S, 12 findings in one file)
12. RC-01 gray→slate in Table (S, 16 findings in one file)
13. Textarea: focus ring blue→indigo + focus-visible fix (XS)
14. Toast: info blue→indigo (XS)
15. Select: focus:ring→focus-visible:ring + rounded-lg→rounded-md (XS)

---

## Architecture Patterns

### Recommended PRIORITIES.md Structure

```
# UI/UX Action Plan: Priorities

## Blocking Tier (≤20 items)
[Cap: 20 — must resolve before production release]

| # | Item | Root Cause | Files | Effort | Resolves |
|---|------|-----------|-------|--------|---------|
...

## High-Value Tier (≤40 items)
[Cap: 40 — resolve in v2.0 iteration]

| # | Item | Root Cause | Files | Effort | Impact |
|---|------|-----------|-------|--------|--------|
...

## Quick Wins
[No cap — High+ severity, XS-S effort, high multiplier]

| # | Item | Severity | Effort | Resolves N Raw Findings |
|---|------|---------|--------|------------------------|
...

## Polish Backlog
[No cap — Medium/Low severity, lower urgency]

| # | Item | Severity | Effort |
|---|------|---------|--------|
...
```

### Recommended IMPLEMENTATION.md Structure

Four implementation waves, each independently mergeable as a PR:

```
# Implementation Guide

## Wave 0: Globals (1 file, S effort)
- globals.css: prefers-reduced-motion block

## Wave 1: Shared UI Components (src/components/ui/)
[Order: highest impact components first]
- Button (add portal variant)
- Alert (color corrections + accessibility)
- Badge (color corrections + border pattern)
- Breadcrumbs (aria + focus rings)
- Card (keyboard accessibility)
- Input (portal variant + focus-visible)
- Select (portal variant + focus-visible)
- Textarea (portal variant + focus-visible + blue→indigo)
- Toggle (portal variant + blue→indigo)
- Modal (role="dialog" + aria-modal + close button)
- Pagination (active state indigo + focus rings)
- SearchSelect (combobox ARIA pattern)
- Spinner (color + aria)
- StatCard (iconColor default)
- StatusBadge (variant mapping refactor)
- Toast (info color + warning variant)
- Skeleton (gray→slate)
- Table (gray→slate)
- ProductImage (gray→slate + motion guard)
- Charts (aria-label props on all 13)

## Wave 2: Scanner Components (src/components/internal/)
[Order: most Blocking violations first]
- PalletBreakdownScanner (5 tap target + text violations)
- ReceivingScanner (3 tap target + 8 text violations)
- PickingScanner (2 tap target + 5 text violations)
- PickScanner (4 tap target + 3 text violations)
- PackScanner (2 tap target + 4 text violations)
- ShipScanner (1 tap target + 5 text violations)
- BarcodeScanner (3 tap target violations)
- ScannerModal (color corrections)
- InspectionScanner (any remaining)
- PutawayScanner (any remaining)

## Wave 3: Admin Pages (src/app/(internal)/)
[Order: scanner routes first, then by feature area]
- Scanner routes: Inventory Transfers, Pallet Breakdown, Inbound Detail, Outbound Detail,
  Task Detail, Pick/Putaway/Inspection queues, Location Sublocations, Returns Detail,
  Damage Report Detail, Cycle Count Detail
- Non-scanner with inline overrides: Lots List, Reports Hub, Dashboard, Tasks List,
  Inbound/Outbound list pages (status tab colors)
- Component-propagation-only pages: can batch-verify after Wave 1

## Wave 4: Portal Pages (src/app/(portal)/)
[Order: inline-override pages first; component-only pages auto-fix after Wave 1]
- request-shipment/confirmation (blue bleed — most severe inline)
- inventory/[id] (blue bleed)
- plan + plan/invoice/[id] (blue bleed)
- templates (blue bleed)
- integrations/shopify/location (blue bleed)
- orders/[id] (indigo inline override)
- inventory/history (indigo + blue inline)
- lots/[id] (indigo inline)
- forgot-password + reset-password (auth background + raw inputs)
- integrations/shopify/products (raw inputs, no brand colors)
- All 29 pages: verify after Wave 1 that component-sourced findings resolved
```

### Anti-Patterns to Avoid in the Action Plan

- **Don't list raw findings as action items.** "Alert warning uses yellow-100" is a finding. "Fix Alert component warning color" is an action item.
- **Don't lose the multiplier information.** Each action item should state how many raw findings it resolves.
- **Don't consolidate what the user said to keep separate.** Per locked decision: each of Button/Input/Select/Textarea/Toggle gets its own Blocking line item, not one "fix CC-04" item.
- **Don't leave scanner safety items in the wrong tier.** Any scanner tap target < 44px or scanner text < 16px is Blocking, not High.

---

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Tracking which raw findings map to which action items | Reference finding IDs from audit files (e.g., "resolves components.md Badge #1–6") | Cross-reference is how the planner verifies nothing was lost |
| Deciding effort estimates | Use the effort estimates already in audit files (XS/S/M/L) | Audit phase already estimated; don't re-estimate |
| Deciding severity | Use severity from audit files; only escalate if consolidation changes severity | Don't downgrade Blocking to High to fit under cap |

---

## Common Pitfalls

### Pitfall 1: Consolidating What Must Remain Separate
**What goes wrong:** Combining all five portal component variants into one "Add CC-04 portal variants" Blocking item to save space.
**Why it happens:** Efficiency instinct; the user locked per-component granularity for a reason.
**How to avoid:** One row per component (Button, Input, Select, Textarea, Toggle) in the Blocking tier.
**Warning signs:** Blocking tier has fewer than 5 portal-brand items.

### Pitfall 2: Blocking Tier Overflow
**What goes wrong:** Blocking tier exceeds 20 items before scanner violations are all captured.
**Why it happens:** 133 raw Blocking findings exist; consolidation requires judgment.
**How to avoid:** Apply the multiplier principle aggressively for component-sourced items. One component fix = one Blocking item regardless of how many pages it affects. For page-level inline Blocking items, group by pattern (e.g., "Task queue action buttons size='sm'" = 1 item covering 3 pages).
**Warning signs:** Blocking tier is at 20 and scanner components haven't been listed yet.

### Pitfall 3: Losing the Polish Backlog
**What goes wrong:** Medium and Low findings are omitted entirely because they don't fit in the capped tiers.
**Why it happens:** Focus on Blocking/High; Medium/Low seem less important.
**How to avoid:** Polish backlog has no cap — include all Medium/Low findings, grouped by root cause.
**Warning signs:** PRIORITIES.md has no Polish Backlog section.

### Pitfall 4: IMPLEMENTATION.md Without File Paths
**What goes wrong:** Action items say "Fix Badge colors" without specifying the file.
**Why it happens:** Success criteria (PLAN-03) requires specific file paths.
**How to avoid:** Every row in IMPLEMENTATION.md must have `src/components/ui/Badge.tsx` (or equivalent) in the Files column.
**Warning signs:** Files column has generic descriptions instead of `src/` paths.

### Pitfall 5: Wave Dependencies Not Documented
**What goes wrong:** Portal page fixes listed before component portal variants exist.
**Why it happens:** Alphabetical or severity ordering ignores technical dependencies.
**How to avoid:** Wave 1 (components) must complete before Wave 3/4 (pages) begin. State this dependency explicitly in IMPLEMENTATION.md.
**Warning signs:** Portal page action items appear in IMPLEMENTATION.md before Button/Input/Select portal variant items.

---

## Code Examples

These are the specific change patterns the IMPLEMENTATION.md should reference:

### Portal Variant Pattern (Button example)
```typescript
// src/components/ui/Button.tsx
// Add to variant map:
portal: "bg-gradient-to-b from-cyan-500 to-teal-600 text-white shadow-sm hover:from-cyan-600 hover:to-teal-700 focus-visible:ring-cyan-500"
```

### focus:ring → focus-visible:ring Pattern
```typescript
// Before (RC-03):
"focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
// After:
"focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
```

### gray → slate Pattern (RC-01)
```typescript
// Before:
"text-gray-900 border-gray-200 bg-gray-50 text-gray-500"
// After:
"text-slate-900 border-slate-200 bg-slate-50 text-slate-500"
```

### Scanner Tap Target Pattern
```typescript
// Before (Blocking):
<Button variant="ghost" size="sm">Pick</Button>
// After:
<Button variant="ghost">Pick</Button>
// Or with explicit guard:
<Button variant="ghost" className="min-h-[44px]">Pick</Button>
```

### prefers-reduced-motion Pattern (globals.css)
```css
/* src/app/globals.css — add at bottom */
@media (prefers-reduced-motion: reduce) {
  @keyframes modal-scale-up { from { opacity: 1; } to { opacity: 1; } }
  @keyframes modal-scale-down { from { opacity: 1; } to { opacity: 1; } }
  @keyframes widget-enter { from { opacity: 1; } to { opacity: 1; } }
  @keyframes chart-enter { from { opacity: 1; } to { opacity: 1; } }
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Modal ARIA Pattern
```typescript
// src/components/ui/Modal.tsx
// Add to dialog container div:
role="dialog"
aria-modal="true"
aria-labelledby="modal-title"
// Add id to title element:
id="modal-title"
```

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled. However, Phase 4 produces only documentation files (PRIORITIES.md, IMPLEMENTATION.md). There is no code execution and no automated tests apply.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | N/A — documentation-only phase |
| Config file | none |
| Quick run command | `ls .planning/action-plan/PRIORITIES.md .planning/action-plan/IMPLEMENTATION.md` |
| Full suite command | Manual review against success criteria checklist |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | Blocking tier ≤20 items, High tier ≤40 items, Polish tier present | manual | Count rows in PRIORITIES.md Blocking/High sections | ❌ Wave 0 |
| PLAN-02 | Quick wins list present in PRIORITIES.md | manual | Grep for `## Quick Wins` in PRIORITIES.md | ❌ Wave 0 |
| PLAN-03 | Every item in IMPLEMENTATION.md has file path + change + effort estimate | manual | Verify `src/` paths in Files column | ❌ Wave 0 |
| PLAN-04 | Wave structure present in IMPLEMENTATION.md for v2.0 handoff | manual | Grep for `## Wave` sections | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `.planning/action-plan/PRIORITIES.md` — covers PLAN-01, PLAN-02
- [ ] `.planning/action-plan/IMPLEMENTATION.md` — covers PLAN-03, PLAN-04
- [ ] `.planning/action-plan/` directory — create before writing files

*(No test framework installation needed — documentation deliverables only)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| focus:ring (shows on mouse click) | focus-visible:ring (keyboard-only) | RC-03 finding | Cleaner admin UX |
| yellow-* for warning | amber-* for warning | MASTER.md §1.3 | Design system compliance |
| blue-* for info/indigo | indigo-* for admin, cyan-* for portal | MASTER.md §1.1, §1.2 | Dual-brand identity |
| gray-* palette | slate-* palette | RC-01 finding | MASTER.md §3.1 mandate |
| transition-all | transition-colors only | Button finding #4 | No layout recalc on hover |
| Portal pages share admin components | Portal-variant props on all form components | CC-04 finding | Brand identity separation |

---

## Open Questions

1. **admin-pages.md finding count discrepancy**
   - What we know: Overview table says 235 total findings; summary table shows 213 confirmed severity ratings
   - What's unclear: The gap of 22 may be "Pass" entries or "Notes" that appear in the tables but aren't findings
   - Recommendation: Use 213 as the finding count for admin pages; the 22 gap represents passes/notes, not missed findings

2. **InspectionScanner and PutawayScanner Blocking finding count**
   - What we know: These scanner components were documented as having Blocking violations (via page-level references), but Section 2 scanner component detail for InspectionScanner and PutawayScanner was not directly read in this research pass
   - What's unclear: Exact Blocking count for these two components
   - Recommendation: Planner should note these as "see components.md InspectionScanner/PutawayScanner findings" and include them in Wave 2 scanner fixes; do not omit from Blocking tier

3. **Portal pages total: 116 vs 29 pages**
   - What we know: portal-pages.md summary shows 116 total findings across 29 pages; one page is redirect-only (0 findings)
   - What's unclear: Whether the 116 count includes "Pass" entries
   - Recommendation: Use 116 as documented in the file; the breakdown by page in the summary table is authoritative

---

## Sources

### Primary (HIGH confidence)
- `.planning/audit/components.md` — 195 findings, 37 components, full root cause taxonomy, Section 3 cross-cutting CC-01 through CC-05
- `.planning/audit/admin-pages.md` — 213 findings, 62 pages, 12 scanner routes, all feature areas
- `.planning/audit/portal-pages.md` — 116 findings, 29 pages, brand divergence summary, remediation priority order
- `.planning/phases/04-action-plan-compilation/04-CONTEXT.md` — locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — PLAN-01 through PLAN-04 requirement definitions
- `.planning/STATE.md` — accumulated decisions from all prior phases

---

## Metadata

**Confidence breakdown:**
- Finding inventory: HIGH — sourced directly from completed audit files
- Consolidation strategy: HIGH — follows locked priority logic from CONTEXT.md
- Blocking tier candidates: HIGH — all 20 items verified against Blocking definition in audit rubrics
- High tier candidates: MEDIUM — representative list; planner may adjust ordering within the 40-item cap
- Quick wins: HIGH — all candidates meet defined threshold (High+ severity + XS/S effort)
- Wave structure: HIGH — dependency order is technically required (components before pages)

**Research date:** 2026-03-19
**Valid until:** Permanent — source data is static audit files, not external APIs or ecosystem state
