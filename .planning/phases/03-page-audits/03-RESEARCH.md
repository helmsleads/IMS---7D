# Phase 3: Page Audits — Research

**Researched:** 2026-03-19
**Domain:** UI/UX page audit — admin and portal pages against design system rubric
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Phase Boundary:** Audit all admin and portal pages against the locked MASTER.md design system, informed by Phase 2 component findings. Produce two separate audit documents: `.planning/audit/admin-pages.md` and `.planning/audit/portal-pages.md`. Each finding is classified as "source: component" (traces to Phase 2) or "source: inline override" (page-specific). Scanner-facing pages get the warehouse floor rubric overlay. No code changes — audit only.
- **Group by feature area** — organize pages by domain: Orders (inbound/outbound), Inventory, Billing, Reports, Settings, Clients, etc. Not alphabetical.
- **Separate documents** — `.planning/audit/admin-pages.md` and `.planning/audit/portal-pages.md`. Each document has its own overview, feature-area sections, and summary counts.
- **Audit detail level:** Actionable specifics — file path, line range, current state, recommended change, effort estimate
- **Severity system:** Blocking/High/Medium/Low (established in Phase 2, RC-01 through RC-05 root causes)
- **Finding classification:** Every finding tagged as "source: component" or "source: inline override"
- **Scanner pages:** 12 routes get warehouse floor rubric (44px+ tap targets, 16px+ text, no precision gestures)
- **Login pages included:** Both admin and portal login pages are in audit scope
- **Component cross-reference:** `.planning/audit/components.md` has 195 findings across 37 components — page findings that trace to a component root cause should reference the component finding ID rather than re-documenting
- **Portal brand divergence:** Identify pages that unintentionally use admin (indigo) elements instead of portal (cyan)

### Claude's Discretion

- Feature area grouping names (e.g., "Orders" vs "Order Management")
- How to handle pages that span multiple feature areas
- Level of cross-referencing detail to components.md (finding ID vs brief description)
- Whether to include a cross-portal comparison section

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PADM-01 | User can audit all admin pages (dashboard, inventory, orders, billing, reports, settings) against design system | Full admin page inventory documented: 62 pages across 14 feature areas. Audit rubric defined via MASTER.md Sections 1-6, 9. |
| PADM-02 | User can audit scanner/warehouse floor pages with warehouse-specific rubric (44x44px tap targets, high contrast, glove-friendly) | 12 scanner routes inventoried in SCANNER-ROUTES.md. MASTER.md Section 7 defines hard gates. Component audit (Section 2) documented 97 scanner findings as cross-reference baseline. |
| PADM-03 | User can review per-page findings with inconsistency documentation | Finding format established from Phase 2: file path, line range, severity, root cause, effort, current state, recommended change. |
| PPRT-01 | User can audit all portal pages (dashboard, orders, inventory, billing, arrivals, integrations) against design system | Full portal page inventory documented: 29 pages across 9 feature areas. Cyan brand guidelines locked in MASTER.md Sections 1.2, 5.1, 5.5. |
| PPRT-02 | User can review portal-specific findings against cyan brand guidelines | Portal brand token set documented. Key violation patterns identified: indigo bleed, missing portal variants on Button/Input/Toggle/Textarea/Select. |
| PPRT-03 | User can identify portal pages that unintentionally diverge from portal brand | Brand divergence checklist defined: any `indigo-*`, `blue-*`, or `from-indigo-*` on portal routes is a finding. Portal-specific components (PortalShell, PortalSidebar) use correct cyan — divergence likely in page-level inline styles. |

</phase_requirements>

---

## Summary

Phase 3 is a **read-only audit** of all pages in the application against the locked `design-system/ims7d/MASTER.md` rubric. It produces two markdown documents: `admin-pages.md` (62 pages, 14 feature areas) and `portal-pages.md` (29 pages, 9 feature areas). No code is modified. The primary value of this phase is classifying each page-level finding as either originating from a shared component defect (cross-reference to components.md) or from inline page-specific code.

Phase 2 component findings are the upstream baseline. The 195 component findings (RC-01 through RC-05) explain the majority of visual inconsistencies that will appear on pages. When a page finding can be traced to a component root cause, the audit records "source: component" and references the component finding ID — this avoids re-documenting the same defect dozens of times. The genuinely new findings for Phase 3 are page-level inline overrides: hardcoded colors in JSX, layout inconsistencies not originating from shared components, 3PL-specific terminology errors, and scanner-route violations introduced at the page level rather than via scanner components.

The portal brand divergence check is the most time-sensitive sub-task. Portal pages use shared components (Button, Input, Toggle, Select, Textarea) that currently have no portal variant. Any page that uses those components on a portal route without overriding to cyan will appear with indigo brand elements inside the portal shell — a Blocking brand identity violation per MASTER.md Section 6.

**Primary recommendation:** Work feature-area-by-feature-area, auditing both admin and portal in parallel where they share analogous pages (e.g., admin orders vs. portal orders). Apply scanner rubric as a second pass after the primary visual audit for the 12 scanner routes.

---

## Standard Stack

This phase produces documentation only. No libraries are installed.

### Core Inputs (Already Available)

| Asset | Path | Purpose |
|-------|------|---------|
| Design system rubric | `design-system/ims7d/MASTER.md` | Primary evaluation rubric (568 lines, locked v1.0) |
| Component findings | `.planning/audit/components.md` | 195 findings, RC-01–RC-05 taxonomy, cross-reference target |
| Scanner route list | `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` | 12 routes with rubric |
| Dashboard constraints | `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md` | ~360px half-widget, ~178px StatCard |

### Core Outputs (To Be Created)

| Output | Path | Contents |
|--------|------|---------|
| Admin page audit | `.planning/audit/admin-pages.md` | 62 pages, grouped by feature area |
| Portal page audit | `.planning/audit/portal-pages.md` | 29 pages, grouped by feature area |

---

## Architecture Patterns

### Recommended Output Structure

Both output documents follow an identical top-level structure:

```
# [Admin / Portal] Page Audit

## Overview
- Total pages audited
- Findings by severity (Blocking / High / Medium / Low)
- Findings by source (component vs. inline override)
- Feature areas covered

## Feature Area: [Name]

### [Page Name] — `src/app/(internal or portal)/[route]/page.tsx`

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|

[Notes on accessibility, layout, 3PL terminology]

## Summary Table
[Page × severity matrix]
```

### Finding Classification Logic

Every finding gets one of two source tags:

| Tag | Meaning | How to Identify |
|-----|---------|-----------------|
| `source: component` | The defect lives in a shared component; fixing the component fixes all pages | The visual issue is produced by `<Button>`, `<Badge>`, `<Table>`, etc. — reference the components.md finding ID |
| `source: inline override` | The page applies its own classes that deviate from the design system | The page JSX contains hardcoded `gray-*`, `blue-*`, `indigo-*` (on portal), or other violations directly in `className` props or style blocks |

**Decision rule:** If the same pattern appears on 3+ pages and traces to one component, classify as "source: component". If it appears only on one page or overrides a correct component, classify as "source: inline override".

### Feature Area Groupings (Admin)

| Feature Area | Pages | Scanner Routes? |
|-------------|-------|-----------------|
| Dashboard | `/dashboard` | No |
| Inventory | `/inventory`, `/inventory/[id]`, `/inventory/pallet-breakdown`, `/inventory/transfers`, `/inventory/import` | Yes (2) |
| Inbound Orders | `/inbound`, `/inbound/[id]`, `/inbound/new` | Yes (1) |
| Outbound Orders | `/outbound`, `/outbound/[id]`, `/outbound/new` | Yes (1) |
| Products | `/products`, `/products/[id]`, `/products/categories` | No |
| Clients | `/clients`, `/clients/[id]`, `/clients/[id]/billing`, `/clients/[id]/settings`, `/clients/users` | No |
| Billing | `/billing`, `/billing/[id]` | No |
| Reports | `/reports`, `/reports/inventory-summary`, `/reports/order-history`, `/reports/low-stock`, `/reports/client-profitability`, `/reports/supply-usage`, `/reports/service-usage`, `/reports/invoice-status`, `/reports/lot-expiration`, `/reports/reorder-suggestions`, `/reports/returns-summary` | No |
| Tasks | `/tasks`, `/tasks/[id]`, `/tasks/pick`, `/tasks/putaway`, `/tasks/inspection` | Yes (4) |
| Locations | `/locations`, `/locations/[id]`, `/locations/[id]/sublocations` | Yes (1) |
| Lots | `/lots`, `/lots/[id]` | No |
| Returns | `/returns`, `/returns/[id]` | Yes (1) |
| Damage Reports | `/damage-reports`, `/damage-reports/[id]` | Yes (1) |
| Cycle Counts | `/cycle-counts`, `/cycle-counts/[id]` | Yes (1) |
| Checklists | `/checklists`, `/checklists/[id]` | No |
| Supplies | `/supplies`, `/supplies/import` | No |
| Services | `/services`, `/services/[id]/addons` | No |
| Messages | `/messages` | No |
| Settings | `/settings`, `/settings/system`, `/settings/portal`, `/settings/workflows`, `/settings/workflows/[id]` | No |
| Auth | `/login` | No |

### Feature Area Groupings (Portal)

| Feature Area | Pages |
|-------------|-------|
| Dashboard | `/portal/dashboard`, `/portal` (root redirect) |
| Orders | `/portal/orders`, `/portal/orders/[id]`, `/portal/request-shipment`, `/portal/request-shipment/confirmation` |
| Inventory | `/portal/inventory`, `/portal/inventory/[id]`, `/portal/inventory/history` |
| Arrivals | `/portal/arrivals`, `/portal/schedule-arrival` |
| Billing | `/portal/billing`, `/portal/plan`, `/portal/plan/invoice/[id]` |
| Lots | `/portal/lots`, `/portal/lots/[id]` |
| Returns | `/portal/returns`, `/portal/returns/[id]` |
| Integrations | `/portal/integrations`, `/portal/integrations/shopify/products`, `/portal/integrations/shopify/location` |
| Reports | `/portal/profitability` |
| Templates | `/portal/templates` |
| Services | `/portal/services` |
| Messages | `/portal/messages` |
| Settings | `/portal/settings` |
| Auth | `/client-login`, `/forgot-password`, `/reset-password` |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity scoring | Custom severity calculator | MASTER.md Section 7 hard gates + Phase 2 rating guide | Already established and locked |
| Root cause taxonomy | New classification scheme | RC-01 through RC-05 from components.md | Consistent with Phase 2 — Phase 4 action plan depends on this taxonomy |
| Scanner rubric | Re-derive tap target minimums | SCANNER-ROUTES.md + MASTER.md Section 7 | Already compiled in Phase 1 |
| Brand divergence detection | Heuristic color matching | Explicit checklist: any `indigo-*` / `from-indigo-*` on portal routes = Blocking | Simpler and less error-prone |

**Key insight:** This phase is 80% cross-referencing, 20% new discovery. The component audit already identified the root causes. Page audit work is connecting those root causes to the pages that consume the affected components, then finding the additional inline overrides that components.md could not see.

---

## Common Pitfalls

### Pitfall 1: Re-documenting Component Defects as Page Findings

**What goes wrong:** The auditor flags `<Badge>` warning color as yellow-instead-of-amber on every page that uses badges, producing hundreds of duplicate findings.
**Why it happens:** Component defects manifest visually on every consuming page.
**How to avoid:** When a finding traces to a component, write "source: component — see Badge finding #2 (yellow→amber)" once per first occurrence. Subsequent occurrences of the same component defect on other pages should be listed in a summary table with a reference ID, not re-documented in full.
**Warning signs:** Finding count growing beyond ~50 per feature area; same current/recommended pair appearing more than 3 times.

### Pitfall 2: Missing Portal Brand Divergence on Shared Pages

**What goes wrong:** Portal pages that import admin-context shared components (Button, Input, Toggle, etc.) get audited for other issues but the brand-color bleed is missed.
**Why it happens:** Portal pages look correct in their shell/nav (PortalSidebar uses cyan correctly) but the interactive elements inside use indigo because those components have no portal variant yet.
**How to avoid:** For every portal page, run an explicit "brand divergence check" — scan JSX for `indigo`, `from-indigo`, `ring-indigo`, `border-indigo` that is NOT inside a component already flagged in components.md. These are inline portal divergences.
**Warning signs:** Portal page uses `<Button variant="primary">` without explicit cyan override — will render indigo per Button component's current state.

### Pitfall 3: Scanner Rubric Applied Too Late

**What goes wrong:** Scanner pages are audited for visual design first, then the scanner rubric check is added at the end and some Blocking findings are under-severity-rated.
**Why it happens:** The scanner rubric elevates issues to Blocking that would be High/Medium in admin context.
**How to avoid:** Apply the scanner rubric as the FIRST filter for scanner-facing routes. Before noting any visual finding, check tap targets, text sizes, and precision gesture requirements. Any violation = Blocking, period.
**Warning signs:** Scanner page has `size="sm"` buttons rated as High instead of Blocking.

### Pitfall 4: Dashboard Widget Width Constraint Missed

**What goes wrong:** Dashboard audit flags padding or font size issues that are technically correct at full viewport but would break at the ~360px half-widget minimum.
**Why it happens:** Dashboard is usually reviewed at full screen width.
**How to avoid:** For any dashboard widget finding, add a grid-impact note if the recommendation involves padding, margin, or font size. Reference DASHBOARD-CONSTRAINTS.md explicitly.
**Warning signs:** Recommending `p-8` on a half widget without noting the ~360px constraint.

### Pitfall 5: 3PL Terminology Anti-Patterns Missed

**What goes wrong:** Visual audit completes but MASTER.md Section 6 terminology anti-patterns are not checked.
**Why it happens:** Terminology issues are easy to overlook when focused on color/spacing/contrast.
**How to avoid:** After visual audit of each page, do a second pass checking: truncated order/LPN numbers, relative dates on shipping deadlines, missing units on weight fields, "item/product" where "SKU/case/pallet" applies.
**Warning signs:** Outbound order page showing "3 days ago" for a ship-by date.

### Pitfall 6: Overcounting Portal Pages

**What goes wrong:** Treating every sub-route variation (e.g., `/portal/integrations/shopify/products` and `/portal/integrations/shopify/location`) as distinct full audits rather than grouping under one parent audit entry.
**Why it happens:** File count (29) versus meaningful audit groups (14 feature areas).
**How to avoid:** Group related sub-routes under their feature area. Audit the parent page fully; note sub-page differences only when they diverge meaningfully.

---

## Code Examples

No code is written in this phase. The "code examples" are the audit finding row formats.

### Admin Page Finding Row Format

```markdown
| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Info alert uses `blue` not `indigo` | 47 | High | component | RC-02 (Alert) | XS | `<Alert variant="info">` renders `bg-blue-50 border-blue-400` | Fix at Alert component level — see components.md Alert finding #2 |
| 2 | Order number truncated in mobile table | 83 | High | inline override | RC-anti-pattern | S | `truncate max-w-[80px]` on order number cell | Remove truncation — order numbers are primary identifiers per MASTER.md Section 6 |
```

### Portal Brand Divergence Finding Format

```markdown
| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Submit button renders indigo on portal page | 112 | Blocking | component | RC-02 (Button — no portal variant) | XS | `<Button variant="primary">` → `from-indigo-500 to-indigo-600` | Add `variant="portal"` to Button — see components.md Button finding #2 |
| 2 | Filter input focus ring is indigo on portal page | 78 | Blocking | component | RC-02 (Input — no portal variant) | XS | `<Input>` → `focus:ring-indigo-500` | Add portal variant to Input — see components.md Input findings |
```

### Scanner Route Finding Format (Blocking gate first)

```markdown
### `/tasks/pick` — `src/app/(internal)/tasks/pick/page.tsx`

> **Scanner rubric applied.** Violations below are BLOCKING per MASTER.md Section 7.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Confirm button `py-2` = ~36px height | 94 | Blocking | inline override | Scanner tap target < 44px | XS | `<Button size="sm">` on confirm action | Use `py-3` minimum or `min-h-[44px]` — scanner requires 44px; 56px preferred |
| 2 | Location label `text-sm` | 67 | Blocking | inline override | RC-04 (scanner text < 16px) | XS | `<span className="text-sm">Bin location</span>` | `text-base` minimum per MASTER.md Section 7.2 |
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Re-document every instance of a component defect | Cross-reference to components.md finding ID | Established in Phase 2 — prevents audit bloat |
| Single severity axis | Dual severity: visual severity + scanner-elevation | Scanner floor rubric elevates findings to Blocking regardless of visual severity |
| Gray vs. Tailwind-gray confusion | Explicit slate palette mandate | RC-01 root cause: all gray-* must be slate-* |

---

## Open Questions

1. **Pages Under Active Development (outbound editing)**
   - What we know: MEMORY.md notes outbound line item editing is in-progress (`project_outbound_editing.md`). Recent commits (1261dee, 549e5f5) modified `/outbound/[id]/page.tsx`.
   - What's unclear: Whether the current page state reflects completed work or is mid-change.
   - Recommendation: Audit the file as-found; note in the finding if the page appears to be mid-development. Phase 4 action plan can defer those findings.

2. **Portal Route `/portal` root page**
   - What we know: `src/app/(portal)/portal/page.tsx` exists but may be a redirect wrapper with minimal UI.
   - What's unclear: Whether it renders meaningful content worth auditing or just redirects to `/portal/dashboard`.
   - Recommendation: Read the file during audit; if it's a redirect-only file, note "redirect wrapper — no UI findings" and move on.

3. **`/portal/profitability` and `/portal/templates` — scope**
   - What we know: Both files exist in the portal route tree.
   - What's unclear: Whether they are fully implemented pages or stubs.
   - Recommendation: Audit what is present; stub pages get a single finding "Page stub — no meaningful UI to audit" and are counted in the summary as Low/N/A.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

This phase produces only markdown documents (no runnable code). There is no automated test suite to run against audit documents. The "validation" for this phase is a structural completeness check.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PADM-01 | admin-pages.md covers all 62 admin pages | manual checklist | `grep -c "page.tsx" .planning/audit/admin-pages.md` | Count should be >= 62 |
| PADM-02 | All 12 scanner routes present in admin-pages.md with Blocking-eligible findings | manual checklist | `grep -c "Blocking" .planning/audit/admin-pages.md` | Count >= 1 per scanner route |
| PADM-03 | Each finding has source tag | manual checklist | `grep -c "source: component\|source: inline" .planning/audit/admin-pages.md` | Count >= total findings |
| PPRT-01 | portal-pages.md covers all 29 portal pages | manual checklist | `grep -c "page.tsx" .planning/audit/portal-pages.md` | Count should be >= 29 |
| PPRT-02 | Portal findings reference cyan brand guidelines | manual checklist | `grep -c "cyan\|portal brand" .planning/audit/portal-pages.md` | Count >= 1 |
| PPRT-03 | Brand divergence section present | manual checklist | `grep "brand divergence\|Portal Brand Divergence" .planning/audit/portal-pages.md` | Must exist |

### Wave 0 Gaps

None — existing markdown workflow infrastructure covers all phase requirements. No framework installation needed.

---

## Sources

### Primary (HIGH confidence)

- `design-system/ims7d/MASTER.md` — Full 568-line locked rubric read directly. Color tokens, typography, spacing, scanner rubric, anti-patterns all verified from source.
- `.planning/audit/components.md` — Phase 2 output read directly. 195 findings, RC-01–RC-05 taxonomy, severity guide, and component-by-component findings confirmed.
- `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` — 12 scanner routes with rubric confirmed.
- `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md` — ~360px half-widget and ~178px StatCard constraints confirmed.
- `.planning/phases/03-page-audits/03-CONTEXT.md` — User decisions confirmed.
- File system — `find` commands confirmed 62 admin pages and 29 portal pages exactly.

### Secondary (MEDIUM confidence)

- MEMORY.md project notes — Brand patterns and portal layout confirmed. In-progress work (outbound editing) noted from git commits.

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Page inventory: HIGH — confirmed by direct filesystem enumeration (62 admin, 29 portal)
- Rubric accuracy: HIGH — MASTER.md read in full; all sections verified
- Component cross-reference baseline: HIGH — components.md read, 195 findings confirmed
- Finding format: HIGH — established and proven in Phase 2
- Portal brand divergence detection strategy: HIGH — explicit token checklist from MASTER.md Section 1.2

**Research date:** 2026-03-19
**Valid until:** Stable — rubric is locked, file inventory only changes if new pages are added

---

*Phase: 03-page-audits*
*Research complete: 2026-03-19*
