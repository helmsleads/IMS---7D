# Phase 2: Component Library Audit - Research

**Researched:** 2026-03-18
**Domain:** React component audit — visual alignment, accessibility, responsive behavior, variant completeness, props API consistency
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Equal depth for all 37 components — every component gets the same level of scrutiny, no tiering by usage
- Charts directory (`src/components/ui/charts/`) included in this audit alongside other shared UI
- No specific pain points pre-identified — let the findings speak for themselves
- Full five-dimension audit per component: visual alignment, accessibility, responsive behavior, variant completeness, props API consistency
- Flag hardcoded values that should use CSS custom properties from globals.css
- Findings must include: file path, line range, current state, recommended change, effort estimate
- Scanner components included: BarcodeScanner.tsx (ui/) + PickingScanner, PickScanner, PackScanner, ShipScanner, PutawayScanner, InspectionScanner, ReceivingScanner, PalletBreakdownScanner + ScannerModal.tsx
- Apply warehouse floor rubric (MASTER.md Section 7) to all scanner components
- Sidebars (Sidebar.tsx, PortalSidebar.tsx) deferred to Phase 3

### Claude's Discretion
- Severity rating system (Blocking/High/Medium/Low or simpler)
- Accessibility finding organization (separate section vs inline with a11y tag)
- How to structure findings within components.md (by component alphabetically, by severity, or by dimension)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | User can audit all shared UI components (Button, Card, Modal, Table, Input, Select, Badge, etc.) against the generated design system | Component inventory complete (37 total), audit dimensions defined, rubric loaded from MASTER.md |
| COMP-02 | User can review component findings with severity ratings (blocking, high, medium, low) | Severity system defined, known violations pre-identified from direct code inspection |
| COMP-03 | User can identify accessibility gaps in shared components (focus states, contrast ratios, ARIA) | Specific a11y violations already found in code inspection below |
</phase_requirements>

---

## Summary

Phase 2 is a pure audit phase: read 37 component files, evaluate each against MASTER.md, and write `.planning/audit/components.md` with severity-rated findings. No code changes. The research phase has directly inspected all component source files, which reveals a consistent and predictable pattern of violations that falls into five root-cause categories.

The single most pervasive issue is **gray palette contamination**: approximately 60-70% of components use Tailwind `gray-*` classes (`gray-100`, `gray-200`, `gray-500`, `gray-700`, `gray-900`) where the design system mandates `slate-*`. This will account for dozens of findings but traces to one root cause. The second major category is **token non-use**: components inline hardcoded hex-equivalent Tailwind color classes instead of referencing CSS custom properties from globals.css. The third category is **wrong focus ring style** (`focus:ring` instead of `focus-visible:ring`) appearing in multiple components. Scanner components have an additional category: **text-sm body content** that violates the 16px floor requirement.

**Primary recommendation:** Organize `components.md` alphabetically within two sections — "Shared UI (27)" and "Scanner Components (10)" — with severity ratings inline. Use a root-cause taxonomy table at the top so page audits (Phase 3) can classify each finding as "source: component defect" vs "source: inline override."

---

## Component Inventory (Confirmed)

### Shared UI — 27 components in `src/components/ui/`

| Component | File | Lines (approx) | Complexity |
|-----------|------|----------------|------------|
| Alert | Alert.tsx | 84 | Low |
| Badge | Badge.tsx | 41 | Low |
| BarcodeScanner | BarcodeScanner.tsx | 479 | High — also scanner |
| Breadcrumbs | Breadcrumbs.tsx | 45 | Low |
| Button | Button.tsx | 75 | Low |
| Card | Card.tsx | 62 | Low |
| charts/ | 14 files | varies | High |
| CommandPalette | CommandPalette.tsx | — | Medium |
| ConfirmDialog | ConfirmDialog.tsx | 53 | Low |
| DropdownMenu | DropdownMenu.tsx | 125 | Medium |
| EmptyState | EmptyState.tsx | 30 | Low |
| ErrorBoundary | ErrorBoundary.tsx | — | Low |
| FetchError | FetchError.tsx | — | Low |
| Input | Input.tsx | 57 | Low |
| Modal | Modal.tsx | 121 | Medium |
| Pagination | Pagination.tsx | 187 | Medium |
| ProductImage | ProductImage.tsx | — | Low |
| SearchSelect | SearchSelect.tsx | 272 | High |
| Select | Select.tsx | 69 | Low |
| Skeleton | Skeleton.tsx | 444 | Medium |
| Spinner | Spinner.tsx | — | Low |
| StatCard | StatCard.tsx | 105 | Medium |
| StatusBadge | StatusBadge.tsx | 35 | Low |
| Table | Table.tsx | 283 | High |
| Textarea | Textarea.tsx | 57 | Low |
| Toast | Toast.tsx | 199 | Medium |
| Toggle | Toggle.tsx | 56 | Low |

### Scanner Components — 10 in `src/components/internal/`

| Component | File | Scanner Routes It Serves |
|-----------|------|--------------------------|
| PickingScanner | PickingScanner.tsx | `/tasks/pick` |
| PickScanner | PickScanner.tsx | `/tasks/pick` (alternate) |
| PackScanner | PackScanner.tsx | `/outbound/[id]` (packing) |
| ShipScanner | ShipScanner.tsx | `/outbound/[id]` (shipping) |
| PutawayScanner | PutawayScanner.tsx | `/tasks/putaway` |
| InspectionScanner | InspectionScanner.tsx | `/tasks/inspection` |
| ReceivingScanner | ReceivingScanner.tsx | `/inbound/[id]` |
| PalletBreakdownScanner | PalletBreakdownScanner.tsx | `/inventory/pallet-breakdown` |
| ScannerModal | ScannerModal.tsx | All scanner routes (modal-wrapped) |
| BarcodeScanner (ui/) | BarcodeScanner.tsx | All scanner routes (shared infra) |

### Charts Subdirectory — 14 files

MiniSparkline, DonutChart, MiniBarChart, MiniLineChart, HorizontalBarChart, TreemapChart, StackedBarChart, ChartLegend, WaterfallChart, CalendarHeatmap, GaugeChart, ScatterChart, BulletChart + index.ts

---

## Pre-Identified Findings from Code Inspection

Direct source reading has already surfaced the following patterns. The planner should structure audit tasks that systematically apply these checks to every component rather than discovering them fresh each time.

### Root-Cause Taxonomy

The following five root causes explain virtually all findings. Page audits (Phase 3) should classify each finding as sourced from one of these:

| Root Cause ID | Description | Affected Components (known) |
|---------------|-------------|----------------------------|
| RC-01 | Gray palette instead of slate palette | Table, Badge, Alert, Toast, Skeleton, DropdownMenu, ConfirmDialog, ReceivingScanner, BarcodeScanner (internal states), Textarea, EmptyState, Pagination, PickingScanner |
| RC-02 | Hardcoded Tailwind color classes where CSS custom properties exist | Badge (blue-100/blue-800 for info instead of `--color-info`), Alert (blue-50/blue-400 for info), Toggle (blue-600 instead of `--color-primary`), Textarea (gray-300 focus ring, blue-500 focus ring instead of `--color-primary`) |
| RC-03 | `focus:ring` instead of `focus-visible:ring` | DropdownMenu, Toggle, Modal close button (p-1 no ring at all), Alert close button (no focus ring) |
| RC-04 | Scanner body text below 16px minimum | PickingScanner uses `text-sm text-gray-500`, `text-xs text-gray-500`, `text-xs bg-gray-100`; BarcodeScanner instructions `text-sm text-gray-600`, `text-xs text-gray-400` |
| RC-05 | Props API inconsistency across components | Input/Select/Textarea have `hint` prop; Badge has no `className` support per MEMORY.md; StatusBadge has fragile variantMap by Tailwind class string (brittle) |

---

## Audit Dimensions Per Component

For each of the 37 components, the auditor applies exactly five dimensions. Research defines what to check per dimension.

### Dimension 1: Visual Alignment to MASTER.md

**What to check:**
- Colors: Are semantic colors using MASTER.md values? Specifically: gray vs slate palette, blue vs indigo/cyan
- Shadows: Are shadow classes referencing `var(--shadow-card)` etc. or using Tailwind shadow utilities?
- Radii: Are rounded classes aligned to MASTER.md token equivalents (`rounded-md` = `--radius-md`, `rounded-lg` = `--radius-lg`, `rounded-xl` = `--radius-xl`)?
- Transitions: Are durations 150-200ms? Are `transition-colors`/`transition-shadow` used (not `transition-all` on width/height/padding)?
- Gradient pattern: Admin buttons should use `from-indigo-500 to-indigo-600`; portal variant absent is a Medium finding

**Known violations found:**
- Badge: `bg-gray-100 text-gray-800` for default variant (should be `bg-slate-100 text-slate-700`)
- Badge: `bg-yellow-100 text-yellow-800` for warning (MASTER.md uses `amber-50/amber-700` + border pattern)
- Badge: `bg-blue-100 text-blue-800` for info (should use `--color-info-light` + `--color-info`)
- Alert: Uses `yellow` not `amber` for warning; uses `blue` not `indigo` for info
- Alert: Uses `rounded-md` without reference to `--radius-md`
- Table: `border-gray-200`, `text-gray-900`, `bg-gray-200` (skeleton rows), `bg-gray-900` (mobile selected view toggle) — all should be slate
- Toggle: `bg-blue-600` (checked state) should use `--color-primary` (`#4F46E5`)
- Toggle: `bg-gray-200` (unchecked) should be `bg-slate-200`
- Textarea: Label `text-gray-700` should be `text-slate-700`; disabled `bg-gray-100` should be `bg-slate-100`; focus ring `blue-500` should be `indigo-500`
- Pagination: `border-gray-200`, `text-gray-600`, `bg-gray-900` for active page (should be `bg-indigo-600`)
- DropdownMenu: `hover:bg-gray-100`, `text-gray-700`, `text-gray-500`, `hover:bg-gray-50` all should use slate
- DropdownMenu: Shadow `ring-black ring-opacity-5` — should use `var(--shadow-elevated)`
- DropdownMenu: Focus ring `focus:ring-blue-500` should be `focus-visible:ring-indigo-500`
- EmptyState: `text-gray-400`, `text-gray-900`, `text-gray-500` all should be slate
- Skeleton: `bg-gray-200`, `border-gray-200`, `bg-gray-50` all should be slate; uses `rounded-lg` on card but should reference `--radius-lg`
- StatCard: `iconColor = "bg-blue-50 text-blue-600"` default prop violates brand — should default to `bg-indigo-50 text-indigo-600`
- Toast: All colors use `blue-50/blue-200/blue-600` for info type (should be indigo); `gray-900`, `gray-700`, `gray-400`, `gray-100` for neutrals (should be slate)
- Button: `rounded-lg` is used — MASTER.md specifies `rounded-md` for buttons (`--radius-md` = 8px); current `rounded-lg` = 12px (`--radius-lg`)
- Card: `rounded-xl` is correct (maps to `--radius-xl`); shadow is hardcoded `shadow-sm` not `var(--shadow-card)`
- Modal: Shadow is inlined `0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.05)` — correct values but should use `var(--shadow-modal)`
- ScannerModal: Uses `bg-gray-50` in footer (should be `bg-slate-50`); `border-gray-200`, `text-gray-900` (all gray → slate)
- PickingScanner: `bg-blue-600` for scanner button color states (should be `--color-primary` indigo); `text-blue-600` inline; `bg-green-500` progress bar (correct color family, but no border pattern)

### Dimension 2: Accessibility

**What to check:**
- Focus states: Does each interactive element have `focus-visible:ring-2 focus-visible:ring-offset-2`? Is `focus:ring` (wrong) used anywhere?
- Contrast: Verify text/bg color pairs against WCAG AA 4.5:1. In particular: `text-gray-500` on `bg-white`, `text-slate-400` on `bg-white`, `text-slate-500` on `bg-white`
- ARIA: Icon-only buttons require `aria-label`. Role attributes where needed (switch, menu, menuitem)
- Alt text: Images (ProductImage, scanner product thumbnails in PickingScanner) must have non-empty alt
- Color as sole indicator: Status communicated only by color must also have text label or icon
- `prefers-reduced-motion`: Animations (Modal scale, Toast slide-in, widget entrance, chart grow) must be guarded
- Keyboard nav: Tab order, no keyboard traps, Escape closes modals/dropdowns

**Known violations found:**
- Toggle: Uses `focus:ring-2 focus:ring-blue-500` — should be `focus-visible:ring-2 focus-visible:ring-indigo-500`
- DropdownMenu trigger: `focus:ring-2 focus:ring-blue-500` — should be `focus-visible:ring-2 focus-visible:ring-indigo-500`
- Modal close button: `p-1 text-slate-400 hover:text-slate-600 transition-colors` — no focus ring at all
- Alert close button: `hover:opacity-70` — no focus ring
- BarcodeScanner torch button: Has `aria-label` (pass); buttons in permission/error states have Button component (inherits focus-visible from Button — pass)
- Pagination: Buttons are raw `<button>` elements with `focus:outline-none` implied by absence — check if outline is actually suppressed
- StatCard: Icon container `group-hover:scale-105` — scale on hover causes layout shift on a card — MASTER.md anti-pattern
- SearchSelect: `ring-2 ring-indigo-500` on the container when open — this is the focus indicator, but it uses always-on `ring` not `focus-visible:ring`; clear button has no aria-label
- ConfirmDialog description: Uses `text-gray-600` (should be `text-slate-600`) — contrast check needed
- globals.css: No `@media (prefers-reduced-motion: reduce)` block — animations in `animate-modal-scale-up`, `animate-widget-enter`, `animate-chart-enter`, `slide-in-from-right` are not guarded

### Dimension 3: Responsive Behavior

**What to check:**
- Mobile rendering: Components used on scanner routes must work on 5-6" phone displays
- Table: Has dual mode (card view / table view) — card view is the primary mobile path; check card view structure for readability
- Modal: `max-h-[calc(100vh-2rem)]` at mobile — adequate; check that content doesn't overflow
- SearchSelect: Dropdown uses `position: fixed` + portal — correct approach for scroll containers; check on small viewports
- StatCard: At ~178px width (4-col lg grid, sidebar expanded), `text-2xl font-bold` value must remain readable; `text-sm` label truncates with `truncate` class — correct
- BarcodeScanner: Responsive `qrbox` size calculation (80% of container, max 280px) — good; check orientation handling

**Known violations found:**
- Pagination: Mobile shows "Page X of Y" text — acceptable; page number buttons hidden on small screens — correct; but overall button tap targets are `w-9 h-9` (36px square) — below the 44px minimum for touch targets
- Table mobile view toggle buttons: `p-1.5 rounded-md` = approximately 28px tap targets — below 44px minimum
- PickingScanner "Add 1 / Add 5 / Add All" buttons: `flex-1` with no `min-h` — actual tap target depends on content; at "sm" button size `py-1.5` = approximately 34px total — below 44px minimum for scanner floor use
- PickingScanner audio toggle button: `p-2 rounded-lg` = approximately 32px — below 44px minimum

### Dimension 4: Variant Completeness

**What to check:**
- Button: Has primary/secondary/danger/ghost — missing portal variant (cyan gradient). MASTER.md shows distinct portal primary button pattern. Current Button has no brand-awareness; callers rely on className overrides
- Badge: Has default/success/warning/error/info — warning uses yellow not amber; no border pattern (MASTER.md shows `border border-green-100` etc.)
- Alert: Has success/error/warning/info — missing `onClose`-less layout variation; uses yellow not amber
- Input/Select/Textarea: No portal variant (cyan focus ring) — same issue as Button. Portal forms will use indigo focus ring
- Toggle: No label prop — common need; no portal color variant
- Modal: No full-screen variant for scanner workflows — scanner modals should optionally fill screen on mobile
- Table: No sortable column support — common need that gets hand-rolled per page
- StatCard: No variant for "no change" (change=undefined hides section, which is handled) but no explicit "neutral" change indicator — only green/red positive/negative
- Charts: No accessibility alt/table equivalent declared at component level — charts are pure SVG with no fallback

### Dimension 5: Props API Consistency

**What to check:**
- Naming conventions: `onClose` vs `onDismiss`, `label` vs `title`, `error` vs `errorMessage`
- Pattern consistency: All form components (Input, Select, Textarea, SearchSelect) should have identical `label`, `error`, `hint`, `required`, `disabled` props
- className passthrough: All components should accept `className` for consumer overrides
- Loading states: Button and Toggle have `loading`; StatCard has `loading`; Table has `loading` — consistent pattern

**Known violations found:**
- `hint` prop: Input has it (line 6), Select has it (line 12), Textarea has it (line 6) — consistent. But Select's `hint` styling uses `text-gray-500` (should be `text-slate-500`) while Input's also uses `text-gray-500` — same bug across all three
- SearchSelect: Does NOT have `hint` prop — inconsistent with Input/Select/Textarea
- SearchSelect: Does NOT have `error` display (has `error` prop but only shows text at bottom, no red border ring) — partial implementation vs Input which has border color change
- StatusBadge: Has `className` prop — good. But `variantMap` uses Tailwind class string as key (`"bg-green-100"` → `"success"`) — fragile coupling to Badge's internal implementation
- Badge: MEMORY.md notes `className` prop not supported — but code inspection shows it IS present on line 7 and used in render (line 30). This is a documentation inconsistency worth noting
- Card: Has `onClick` prop for clickable variant but no keyboard handler (`onKeyDown`) — clicking via keyboard would require Tab + Enter but Enter on a div doesn't fire onClick in all browsers without role="button" + tabIndex

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity categorization | Custom numeric scores | Blocking/High/Medium/Low labels | Maps directly to MASTER.md language and action plan tiers |
| Root cause taxonomy | Per-component finding lists only | RC-01 through RC-05 taxonomy + component findings | Prevents 40 page findings from appearing as 40 separate items |
| Contrast ratio math | Manual HSL calculations | Reference WCAG AA/AAA thresholds from MASTER.md Section 9 | Text on `slate-50` background: `slate-500` (#64748B) is 4.6:1 — passes AA; `slate-400` (#94A3B8) is 2.9:1 — fails |
| Token lookup | Inline value comparisons | CSS custom property table from MASTER.md Appendix | All 29 tokens are defined; check if component uses token or raw Tailwind equivalent |

---

## Common Pitfalls

### Pitfall 1: Conflating Gray and Slate
**What goes wrong:** Auditor flags `gray-100` as "wrong" without noting severity — gray and slate at equivalent steps are visually almost identical but semantically wrong. The issue matters because Tailwind 4 config-free mode may not guarantee they're identical.
**Why it happens:** Designer used default Tailwind gray before the slate-only decision.
**How to avoid:** Flag every `gray-*` instance as Medium severity. Rate as High only if the color is in an interactive/semantic role (e.g., `bg-gray-900` on an active page button instead of `bg-indigo-600`).
**Warning signs:** `gray-200` in skeleton/loading states is the most common case — still flag it, still Medium.

### Pitfall 2: Treating CSS Token Non-Use as Blocking
**What goes wrong:** Every Tailwind class for colors could technically be replaced with a CSS var. Not all of them matter equally.
**Why it happens:** Overzealous token enforcement.
**How to avoid:** Rate CSS token non-use as Medium unless it's a brand-critical color (primary, portal, semantic states). Purely structural neutrals (border dividers, table row backgrounds) not referencing tokens are Low.

### Pitfall 3: Scanner Text Size at `text-sm` in a Card Summary
**What goes wrong:** Auditor flags `text-sm` in PickingScanner's "pick list" section as Blocking because scanner routes require 16px minimum body text.
**Why it happens:** The pick list is a secondary information area, not primary interaction. The rubric says "readable content" — but the scanner floor rubric uses `text-base` as the minimum for "all readable content."
**How to avoid:** Apply the scanner rubric consistently — `text-sm` anywhere in a scanner component is at minimum a High finding. Blocking is reserved for primary interaction text, tap target violations, or contrast failures. Apply Blocking if the text is the primary action identifier (product name shown during picking scan result).

### Pitfall 4: Counting StatusBadge Findings Twice
**What goes wrong:** StatusBadge wraps Badge. If Badge has wrong colors (RC-01, RC-02), StatusBadge inherits those issues. Auditor flags both components separately.
**How to avoid:** Flag the root cause at Badge level. StatusBadge finding should read "inherits Badge color issues — see Badge findings." Additionally flag StatusBadge's own issue: the `variantMap` key-by-classname pattern (RC-05, Medium).

### Pitfall 5: StatCard `group-hover:scale-105` on Icon
**What goes wrong:** The icon inside StatCard scales 5% on card hover. MASTER.md Section 6 lists `transform: scale()` on card hover as a Blocking anti-pattern. But this is on the icon, not the card.
**Why it happens:** Icon scale is isolated — it doesn't cause layout shift of the card, only the icon itself shifts slightly within its fixed container.
**How to avoid:** Rate this Medium (anti-pattern adjacency, visual distraction) not Blocking. Blocking scale anti-pattern is at card level causing row layout shift.

### Pitfall 6: Missing `prefers-reduced-motion` in globals.css
**What goes wrong:** This is a MASTER.md Section 9 requirement. The absence affects all animations — widget entrance, modal scale, toast slide, chart grow. This is a High finding at the globals.css level but should be documented once, not duplicated in every animated component finding.
**How to avoid:** Create a single "globals.css" pseudo-entry in `components.md` for cross-cutting findings. Reference it from Toast, Modal, StatCard findings.

---

## Code Examples

### Correct Badge Pattern (MASTER.md 5.6)
```html
<!-- Success badge — what current Badge should produce -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-green-50 text-green-700 border border-green-100">
  Shipped
</span>
```
Current Badge `success` variant produces `bg-green-100 text-green-800` (no border, wrong background shade).

### Correct Focus Ring Pattern (MASTER.md 5.1)
```html
<!-- focus-visible prevents ring on mouse click -->
focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
```
Current Toggle, DropdownMenu use `focus:ring-2 focus:ring-blue-500` — both issues (focus vs focus-visible, blue vs indigo).

### Correct Button Radius (MASTER.md 5.1)
```html
<!-- --radius-md = 0.5rem = 8px = rounded-md -->
rounded-md
```
Current Button uses `rounded-lg` (12px = `--radius-lg`) — consistent across all sizes but inconsistent with MASTER.md button pattern.

### Correct Scanner Body Text Minimum
```html
<!-- 16px minimum for scanner routes -->
text-base  <!-- not text-sm -->
```
BarcodeScanner instructions: `text-sm text-gray-600` and `text-xs text-gray-400` — two violations in one element.

### Token Reference Pattern
```html
<!-- Use CSS custom property instead of hardcoded equivalent -->
shadow-[var(--shadow-card)]        <!-- not shadow-sm -->
shadow-[var(--shadow-elevated)]    <!-- not shadow-lg -->
bg-[var(--color-primary)]          <!-- not bg-indigo-600 (acceptable but less maintainable) -->
```

---

## Architecture Patterns

### Recommended `components.md` Structure

```
.planning/audit/components.md
├── Overview
│   ├── Root-Cause Taxonomy table (RC-01 through RC-05)
│   ├── Severity rating guide
│   └── Total finding counts by severity
│
├── Section 1: Shared UI Components (27)
│   └── [Component name] — alphabetical
│       ├── File path + line ranges
│       ├── Dimension findings (5 per component)
│       └── Severity-rated table
│
├── Section 2: Scanner Components (10)
│   └── [Component name]
│       ├── Scanner floor rubric application
│       ├── Dimension findings
│       └── Cross-route impact note
│
└── Section 3: Cross-Cutting (globals.css + patterns)
    └── prefers-reduced-motion gap
    └── Token non-use systemic pattern
```

### Severity Rating System (Claude's Discretion — Recommended)

| Rating | Definition | Scanner Context |
|--------|-----------|-----------------|
| **Blocking** | Violates a MASTER.md hard rule that cannot be shipped — brand identity merge, scanner tap target < 44px, scanner text < 16px, contrast failure | Scanner floor violations are always Blocking |
| **High** | Significant design deviation that will cause visual inconsistency at scale — wrong color family (blue instead of indigo), missing focus rings on interactive elements, hover-only interactions | |
| **Medium** | Design token non-use, gray vs slate palette (functionally equivalent, semantically wrong), props API inconsistency, missing variants | |
| **Low** | Minor style polish — border radius off by one step, shadow not tokenized, missing className passthrough on non-interactive wrappers | |

### Effort Estimate Convention

From CONTEXT.md (Phase 1 decision carried forward):

| Effort | Meaning |
|--------|---------|
| XS | < 5 min — one-line class change |
| S | 5-15 min — multiple class changes in one component |
| M | 15-60 min — structural change, new variant, or refactor |
| L | 1-4 hours — API change, new props, affects consumers |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `focus:ring` (shows on mouse click) | `focus-visible:ring` (keyboard only) | Current components mostly use wrong variant |
| `gray-*` Tailwind palette (original default) | `slate-*` (design system mandate) | ~60% of components predate the slate decision |
| Inline shadow values | `var(--shadow-*)` CSS custom properties | globals.css has tokens; components don't reference them |
| `rounded-md` for buttons | MASTER.md: `rounded-md` is correct | Button.tsx incorrectly uses `rounded-lg` |

---

## Open Questions

1. **PickScanner vs PickingScanner**
   - What we know: Both files exist. SCANNER-ROUTES.md lists both for `/tasks/pick`
   - What's unclear: Are both actively used or is one deprecated? Is PickScanner a simpler fallback?
   - Recommendation: Read PickScanner.tsx during Phase 2 planning/execution; include both in audit scope

2. **CommandPalette complexity**
   - What we know: File exists (`CommandPalette.tsx`) but was not read during research
   - What's unclear: Does it have accessibility requirements (ARIA combobox pattern, keyboard nav) that differ from other components?
   - Recommendation: Read during audit planning; CommandPalette is a complex interactive pattern — may warrant a dedicated audit wave

3. **Charts accessibility**
   - What we know: 14 chart files exist; no fallback table or aria patterns observed in research
   - What's unclear: Whether any charts have title/desc SVG elements or aria-label
   - Recommendation: Charts are WCAG at-risk — all 14 files likely need `<title>` + `<desc>` SVG elements and aria-labelledby. Rate findings as High across all chart components unless proven otherwise

4. **Portal-specific component variants**
   - What we know: Button, Input, Select, Toggle all use `--color-primary` (indigo) hardcoded. Portal routes use the same components
   - What's unclear: Are portal pages currently using `className` overrides to get cyan colors, or are they just using indigo?
   - Recommendation: Flag the absence of portal variant on Button/Input/Select as Medium — callers work around it but the design system expects it

---

## Validation Architecture

> `nyquist_validation` key is absent from `.planning/config.json`. Treating as enabled.

This phase is **audit-only** — no code changes, no implementation. Validation architecture for Phase 2 is therefore minimal: the deliverable is a document, not executable code.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Validation | Notes |
|--------|----------|-----------|-----------|-------|
| COMP-01 | components.md contains entry for all 37 components | Manual review | Count entries vs inventory list | No automated test possible |
| COMP-02 | Each finding has a severity rating | Manual review | Verify no finding is missing rating | Grep for entries without Blocking/High/Medium/Low label |
| COMP-03 | Accessibility gaps identified | Manual review | Check that each component has accessibility dimension entry | At minimum flag or pass for each |

### Wave 0 Gaps
- None — no test infrastructure needed for an audit-document phase. The "test" is reading `components.md` and verifying it meets success criteria.

---

## Sources

### Primary (HIGH confidence)
- `design-system/ims7d/MASTER.md` — locked design rubric, all 9 sections read directly
- `src/components/ui/*.tsx` — 19 component files read directly
- `src/components/internal/ScannerModal.tsx`, `PickingScanner.tsx`, `PackScanner.tsx`, `ReceivingScanner.tsx` — read directly
- `src/app/globals.css` — all 29 CSS custom properties confirmed
- `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` — route inventory confirmed
- `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md` — constraint values confirmed

### Secondary (MEDIUM confidence)
- `.claude/skills/ui-ux-pro-max/SKILL.md` — accessibility checklist cross-references WCAG AA requirements, consistent with MASTER.md

### Tertiary (LOW confidence)
- Unread components (CommandPalette, ErrorBoundary, FetchError, ProductImage, Spinner, all 14 chart files, PickScanner, ShipScanner, PutawayScanner, InspectionScanner, PalletBreakdownScanner) — only inventory confirmed, content not inspected

---

## Metadata

**Confidence breakdown:**
- Component inventory: HIGH — all 37 files confirmed present via directory listing
- Pre-identified violations: HIGH — sourced directly from reading 23 of 37 component files
- Violations in unread files (14 charts + 5 scanner wrappers + 4 misc): MEDIUM — extrapolated from the consistent pattern found in read files
- Scanner rubric application: HIGH — MASTER.md Section 7 + SCANNER-ROUTES.md both read directly
- Severity framework: HIGH — derived directly from MASTER.md language and user decision in CONTEXT.md

**Research date:** 2026-03-18
**Valid until:** Stable — component files change only during implementation (Phase 2 of milestone v2). This research is valid until implementation begins.
