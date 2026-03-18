# Dashboard Widget Grid Constraints

**Document type:** Pre-audit constraint reference
**Created:** 2026-03-18
**Phase:** 01-tool-setup-and-design-system

---

## Grid Implementation

The dashboard uses a **CSS columns layout**, not a fixed-pixel grid system.

| Detail | Value |
|--------|-------|
| Implementation file | `src/lib/dashboard/DynamicWidgetGrid.tsx` |
| CSS approach | `lg:columns-2 gap-6` (CSS multi-column layout) |
| Grid type | Content-driven columns — widget dimensions are NOT fixed-px |
| Breakpoint switch | Single column below `lg` (1024px), two columns at `lg`+ |

**Critical implication:** Widget widths are approximate — they depend on viewport width, sidebar state, and browser rendering of the CSS columns layout. There is no fixed grid cell size. Audit recommendations must account for this variability.

---

## Widget Size Variants

| Widget Size | CSS Behavior | Effective Width |
|-------------|-------------|----------------|
| `"half"` | Normal column flow — occupies one of two columns | ~50% of content area width minus 1.5rem gap |
| `"full"` | `column-span: all` — spans both columns | ~100% of content area width |

---

## Minimum Width Constraints (Approximate)

Effective widget widths vary by sidebar state and viewport size:

| Viewport State | Content Area Width | Half-Widget Width |
|---------------|-------------------|-------------------|
| `lg` (1024px), sidebar expanded (264px) | ~736px | ~368px |
| `lg` (1024px), sidebar collapsed (72px) | ~928px | ~464px |
| Mobile (below `lg`) | ~full viewport | full width (single column) |

**Sidebar collapsed key:** `portal-sidebar-collapsed`
**Sidebar expanded width:** 264px
**Sidebar collapsed width:** 72px
**Column gap:** 1.5rem (24px, from `gap-6`)

---

## StatCard Constraints

The static stat cards above the widget area have tighter constraints:

| Property | Value |
|----------|-------|
| Grid layout | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` (fixed 4-column at lg+) |
| Icon size | `w-6 h-6` (fixed) |
| Padding | `p-6` |
| Value typography | `text-2xl` |
| Label typography | `text-sm` |

**StatCard width at lg with sidebar expanded:**
- Content area ~736px ÷ 4 columns = ~184px per card minus gaps = **~178px per StatCard**
- This is extremely constrained. Long labels will truncate or wrap.

---

## Audit Rejection Rule

> Any typography, padding, or spacing recommendation that makes a **half widget unreadable at ~360px wide** must be **rejected** or **qualified** with a grid-impact note.

The ~360px threshold is derived from:
- Minimum half-widget width at lg with sidebar expanded: ~368px
- Minus inner padding on both sides: ~360px usable content area

**StatCard corollary:** Any recommendation that makes a StatCard value or label unreadable at ~178px width must be rejected or qualified.

---

## Common Failure Patterns

These are likely audit findings that would violate the constraints above and must be handled carefully:

1. **Large padding recommendations on half widgets** — reduces usable width below 360px
2. **Multi-line labels on StatCards** — ~178px is too narrow for more than ~15 characters at `text-sm`
3. **Min-width declarations on widgets** — breaks CSS columns layout by forcing overflow
4. **Font size increases without width consideration** — `text-base` on a ~178px StatCard is readable; `text-lg` may not be

---

## Audit Usage

When auditing dashboard-related pages:

1. Check which widget size variant is being audited (`half` vs `full`)
2. Apply the ~360px minimum usable width for half widgets
3. Apply the ~178px StatCard constraint for stat area recommendations
4. Flag any recommendation that would cause overflow or unreadable text at these minimum widths
5. Include a `grid-impact note` on any flagged recommendation explaining the constraint
