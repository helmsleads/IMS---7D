# IMS-7D Design System — MASTER.md

> **PURPOSE:** This is the locked evaluation rubric for all audit phases (Phase 2, 3, 4).
> Do NOT modify after initial generation. All findings reference this file.
>
> **Usage:** When auditing a specific page, first check `design-system/ims7d/pages/[page].md`.
> If that file exists, its rules **override** this Master file. Otherwise, use this file exclusively.

---

**Project:** IMS-7D — 3PL Warehouse Management Platform
**Version:** 1.0 (locked)
**Generated:** 2026-03-18
**Identity:** Premium logistics — Flexport-inspired, trust and authority tone
**Stack:** Next.js 14, Tailwind CSS 4 (config-free), CSS custom properties

---

## Section 1: Color Tokens — Dual Brand

IMS-7D has **two visually distinct brands** that must never be merged or normalized:

- **Admin brand** — Deep indigo. Used for internal staff interface (`(internal)/` routes).
- **Portal brand** — Cyan/teal. Used for external client view (`(portal)/` routes).

Any audit recommendation that erodes this distinction is a blocker.

---

### 1.1 Admin Brand (Internal Staff Interface)

| CSS Custom Property | Value | Tailwind Equivalent | Usage |
|---------------------|-------|---------------------|-------|
| `--color-primary` | `#4F46E5` | `indigo-600` | Primary buttons, active nav, focus rings, links |
| `--color-primary-hover` | `#4338CA` | `indigo-700` | Button hover, interactive hover states |
| `--color-primary-light` | `#EEF2FF` | `indigo-50` | Pill backgrounds, selected rows, subtle highlights |
| `--color-info` | `#4F46E5` | `indigo-600` | Info badges, info alerts (shares primary hue intentionally) |
| `--color-info-light` | `#EEF2FF` | `indigo-50` | Info alert backgrounds |

**Gradient pattern (admin buttons):** `from-indigo-500 to-indigo-600` with `shadow-sm`

**Active nav state:** `border-l-[3px] border-indigo-400 bg-white/5`

**Sidebar:** `bg-gradient-to-b from-slate-900 to-slate-950` — dark, authoritative, professional

---

### 1.2 Portal Brand (External Client Interface)

| CSS Custom Property | Value | Tailwind Equivalent | Usage |
|---------------------|-------|---------------------|-------|
| `--color-portal` | `#0891B2` | `cyan-600` | Portal primary buttons, active portal nav, portal links |
| `--color-portal-hover` | `#0E7490` | `cyan-700` | Portal button hover states |
| `--color-portal-light` | `#ECFEFF` | `cyan-50` | Portal pill backgrounds, portal selected rows |

**Gradient pattern (portal buttons):** `from-cyan-500 to-teal-600` with `shadow-sm`

**Active portal nav:** Pill-style — `bg-cyan-50 text-cyan-700 rounded-full px-3 py-1`

**Portal sidebar:** Dark gradient (`from-slate-900 to-slate-950`) with **cyan** active states (not indigo)

---

### 1.3 Semantic Colors (Shared — Both Brands)

| CSS Custom Property | Value | Tailwind Equivalent | Usage |
|---------------------|-------|---------------------|-------|
| `--color-success` | `#16a34a` | `green-600` | Success badges, confirmed order states, in-stock |
| `--color-success-light` | `#f0fdf4` | `green-50` | Success alert backgrounds, positive row highlights |
| `--color-warning` | `#d97706` | `amber-600` | Warning badges, low stock, pending states |
| `--color-warning-light` | `#fffbeb` | `amber-50` | Warning alert backgrounds |
| `--color-error` | `#dc2626` | `red-600` | Error badges, failed actions, out-of-stock, damage |
| `--color-error-light` | `#fef2f2` | `red-50` | Error alert backgrounds |

**Semantic usage rules for 3PL context:**
- `success` → received, confirmed, shipped, completed, in-stock
- `warning` → pending, processing, low stock, expiring soon
- `error` → failed, rejected, damaged, overdue, out-of-stock
- `info` → informational alerts, draft states, notes

---

### 1.4 Neutral Tokens (Shared — Both Brands)

| CSS Custom Property | Value | Usage |
|---------------------|-------|-------|
| `--color-bg-page` | `#F8FAFC` | Page background (slate-50) |
| `--color-bg-subtle` | `#F1F5F9` | Subtle section backgrounds, zebra rows (slate-100) |
| `--color-bg-card` | `#ffffff` | Card surfaces, modal backgrounds |
| `--color-text-primary` | `#0F172A` | Headings, primary labels, important data (slate-900) |
| `--color-text-secondary` | `#64748B` | Secondary labels, helper text, timestamps (slate-500) |
| `--color-border` | `#E2E8F0` | Default borders, table dividers, input borders (slate-200) |
| `--color-border-light` | `#F1F5F9` | Subtle dividers, section separators (slate-100) |

**Palette foundation:** Slate (not gray). All neutrals use the slate scale exclusively.

---

## Section 2: Typography

**Identity principle:** Conservative, functional, data-first. This is a professional logistics platform, not a consumer SaaS. Typography should project precision and competence.

### 2.1 Recommended Font Pairing

| Role | Font | Weights | Tailwind Class |
|------|------|---------|----------------|
| **Heading** | **Inter** | 600, 700 | `font-semibold`, `font-bold` |
| **Body** | **Inter** | 400, 500 | `font-normal`, `font-medium` |

**Why Inter:** Inter was designed specifically for screen readability in dense data interfaces. Used by Stripe, Linear, and Notion. Its tabular number variant renders numeric data (quantities, weights, currency) with consistent character widths — critical for data-dense warehouse tables. No heading/body split needed when the font was built for this use case.

**Alternative pairing (if heading differentiation required):**
| Role | Font | Rationale |
|------|------|-----------|
| **Heading** | **DM Sans** | Slightly geometric, authority-conveying, premium feel |
| **Body** | **Inter** | Industry-standard data interface font |

**Google Fonts import (Inter):**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

### 2.2 Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 12px | 400-500 | 1.5 | Timestamps, meta labels, badge text |
| `text-sm` | 14px | 400-500 | 1.5 | Table body, secondary content, form hints |
| `text-base` | 16px | 400-500 | 1.5 | Default body text, form labels |
| `text-lg` | 18px | 500-600 | 1.4 | Section subheadings |
| `text-xl` | 20px | 600 | 1.3 | Page subheadings, card titles |
| `text-2xl` | 24px | 600-700 | 1.2 | Page headings, stat values |
| `text-3xl` | 30px | 700 | 1.1 | Hero headings (rare in admin) |

**Scanner floor minimum:** `text-base` (16px) for all readable content on scanner-facing routes. Preferred `text-lg` (18px+).

**Anti-pattern:** `text-xs` body text in scanner routes — violates glove-friendly interaction rubric.

---

## Section 3: Spacing and Layout

### 3.1 Office / Data-Dense Layout (Admin Staff — Desktop)

These are expert users at desktop workstations 8+ hours/day. Optimize for information density while maintaining scanability.

| Context | Padding | Notes |
|---------|---------|-------|
| Page container | `px-6 py-6` | Standard content inset |
| Card body | `p-6` | Standard card padding |
| Table cells | `px-4 py-3` | Balanced density for data tables |
| Form sections | `space-y-4` | Clean vertical rhythm |
| Sidebar items | `px-3 py-2` | Compact nav items |
| Stat cards | `p-6` (fixed) | See dashboard constraint: ~178px StatCard width at lg |

**Dashboard grid constraint (hard guard rail):**
- Half widget minimum usable width: **~360px** (sidebar expanded, lg breakpoint)
- StatCard usable width: **~178px** (4-column grid, sidebar expanded, lg breakpoint)
- Any padding recommendation that reduces usable width below these thresholds must be rejected or qualified with a grid-impact note
- Reference: `DASHBOARD-CONSTRAINTS.md`

### 3.2 Scanner / Warehouse Floor Layout (Warehouse Staff — Tablets + Phones)

These are workers in physical motion, often wearing gloves, in variable lighting. Optimize for target acquisition and error prevention.

| Criterion | Minimum | Preferred |
|-----------|---------|-----------|
| Tap target height | 44px | 56px+ |
| Tap target width | 44px | Full-width buttons |
| Body text | 16px | 18px+ |
| Primary actions per screen | — | Max 3 |
| Contrast ratio | WCAG AA (4.5:1) | WCAG AAA (7:1) |

**Layout principles for scanner routes:**
- Full-width CTA buttons — maximize tap target across viewport width
- Generous vertical spacing between interactive elements — `space-y-4` minimum
- Scannable header area with product/location identity in `text-2xl font-bold`
- Status feedback (success/error/warning) in full-width banner, not inline toast
- No precision gestures (no swipe-to-reveal, no drag-and-drop, no two-finger gestures)
- No hover-only affordances (touch devices have no hover state)

**Rejection rule:** Any audit recommendation that reduces scanner-route tap targets below 44px, decreases contrast ratio, increases interaction precision, or introduces hover-only affordances is a **blocker**.

---

## Section 4: Effects — Shadows, Radii, Transitions

### 4.1 Shadow System

| CSS Custom Property | Value | Usage |
|---------------------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.03)` | Subtle depth on flat elements |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` | Default card elevation |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)` | Card hover state |
| `--shadow-elevated` | `0 8px 25px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)` | Popovers, dropdowns |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.05)` | Modal dialogs |

**Shadow philosophy:** Subtle and professional. Shadows convey elevation hierarchy, not visual drama. The layered RGBA approach (two shadow layers) is intentional — it produces more realistic shadows than single-value shadows.

### 4.2 Border Radius System

| CSS Custom Property | Value | Usage |
|---------------------|-------|-------|
| `--radius-sm` | `0.375rem` (6px) | Badges, pills, small inputs, chips |
| `--radius-md` | `0.5rem` (8px) | Buttons, inputs, form fields |
| `--radius-lg` | `0.75rem` (12px) | Cards, panels, dropdowns |
| `--radius-xl` | `1rem` (16px) | Modals, large panels, prominent containers |

**Anti-pattern for 3PL:** Avoid `rounded-full` on data-heavy elements. Full pill radius is appropriate for badges/status chips, not for cards or data panels — maintains the professional, structured feel over the bubbly consumer look.

### 4.3 Transitions

| Use Case | Duration | Easing |
|----------|----------|--------|
| Color/background changes | `150ms` | `ease-out` |
| Button hover, link hover | `200ms` | `ease` |
| Card hover (shadow + border) | `200ms` | `ease` |
| Modal open/close | `200ms` | `ease-out` / `150ms ease-in` |
| Sidebar expand/collapse | `200ms` | `ease-in-out` |
| Toast notifications | `300ms` | `ease-out` |

**Performance rule:** Always use `transition-colors`, `transition-shadow`, or `transition-transform`. Never transition `width`, `height`, or `padding` — these trigger layout recalculation and hurt performance.

---

## Section 5: Component Patterns

### 5.1 Buttons

**Admin primary button:**
```html
<button class="bg-gradient-to-b from-indigo-500 to-indigo-600 text-white
               px-4 py-2 rounded-md font-medium shadow-sm
               hover:from-indigo-600 hover:to-indigo-700
               focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
               transition-all duration-200 cursor-pointer">
  Action
</button>
```

**Portal primary button:**
```html
<button class="bg-gradient-to-b from-cyan-500 to-teal-600 text-white
               px-4 py-2 rounded-md font-medium shadow-sm
               hover:from-cyan-600 hover:to-teal-700
               focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2
               transition-all duration-200 cursor-pointer">
  Action
</button>
```

**Secondary button (both brands):**
```html
<button class="bg-white border border-slate-300 text-slate-700
               px-4 py-2 rounded-md font-medium
               hover:bg-slate-50 hover:border-slate-400
               focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
               transition-all duration-200 cursor-pointer">
  Action
</button>
```

**Scanner floor CTA button (large, glove-friendly):**
```html
<button class="w-full bg-indigo-600 text-white
               py-4 rounded-lg font-semibold text-lg
               min-h-[56px]
               hover:bg-indigo-700 active:bg-indigo-800
               focus-visible:ring-2 focus-visible:ring-indigo-500
               transition-colors duration-150 cursor-pointer">
  Confirm Pick
</button>
```

**Key rule:** Use `focus-visible:ring` (not `focus:ring`) to avoid ring on mouse click.

### 5.2 Cards

**Standard data card:**
```html
<div class="bg-white rounded-lg border border-slate-200/80 p-6
            shadow-[var(--shadow-card)]
            hover:shadow-[var(--shadow-card-hover)] hover:border-slate-300
            transition-shadow duration-200">
  <!-- content -->
</div>
```

**Clickable card (adds cursor and active state):**
```html
<div class="... cursor-pointer
            active:scale-[0.99] transition-transform duration-100">
```

### 5.3 Tables (Data-Dense Admin Pattern)

```html
<table class="w-full text-sm">
  <thead>
    <tr class="border-b border-slate-200 bg-slate-50">
      <th class="px-4 py-3 text-left font-medium text-slate-500 uppercase tracking-wide text-xs">
        Column
      </th>
    </tr>
  </thead>
  <tbody class="divide-y divide-slate-100">
    <tr class="hover:bg-slate-50 transition-colors duration-150">
      <td class="px-4 py-3 text-slate-900">Value</td>
    </tr>
  </tbody>
</table>
```

**Table patterns for 3PL:**
- Sticky header on long tables (inventory, order lists)
- Numeric data right-aligned with tabular-nums font variant
- Status columns use `<Badge>` component with semantic color
- Row hover uses `hover:bg-slate-50` (not indigo/cyan tints — those imply selection)

### 5.4 Modals

**Frosted glass backdrop:**
```html
<div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50
            flex items-center justify-center p-4">
  <div class="bg-white rounded-xl shadow-[var(--shadow-modal)]
              w-full max-w-lg max-h-[90vh] overflow-y-auto">
    <!-- header, body, footer -->
  </div>
</div>
```

**Modal structure:** Header (title + close button) / Body (scrollable) / Footer (actions, right-aligned: secondary then primary)

### 5.5 Inputs and Form Fields

```html
<input class="w-full px-3 py-2 rounded-md
              border border-slate-300 bg-white
              text-slate-900 placeholder-slate-400
              text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              transition-colors duration-200" />
```

**Portal inputs:** Replace `focus:ring-indigo-500` with `focus:ring-cyan-500`.

**Scanner route inputs:** Minimum `py-3` for comfortable touch entry.

### 5.6 Badges and Status Chips

```html
<!-- Success (shipped, confirmed, in-stock) -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-green-50 text-green-700 border border-green-100">
  Shipped
</span>

<!-- Warning (pending, low stock) -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-amber-50 text-amber-700 border border-amber-100">
  Pending
</span>

<!-- Error (failed, damaged, out-of-stock) -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
             bg-red-50 text-red-700 border border-red-100">
  Damaged
</span>
```

---

## Section 6: Anti-Patterns for 3PL/Warehouse Context

These patterns are forbidden in IMS-7D and will be flagged as findings in audits.

### Visual Identity Anti-Patterns

| Anti-Pattern | Reason | Correct Pattern |
|-------------|--------|-----------------|
| Merging admin (indigo) and portal (cyan) into one palette | Destroys brand distinction — clients cannot tell if they are in admin or portal | Keep separate token sets; never use indigo on portal pages or cyan on admin pages |
| AI purple/pink gradients (`from-purple-500 to-pink-500`) | Consumer SaaS aesthetic, not professional logistics | Use brand gradients only (`from-indigo-500 to-indigo-600` admin, `from-cyan-500 to-teal-600` portal) |
| Colorful hero sections with gradients spanning full viewport | Landing page aesthetic, inappropriate for a staff tool | Subtle gradient headers at most; white card surfaces on slate-50 page background |
| Glassmorphism (`backdrop-blur` on content cards) | Reduces readability for dense data; appropriate only for modals | Use solid card backgrounds (`bg-white`) with subtle border and shadow |
| Decorative illustrations or icon blobs in data interfaces | Adds visual noise to task-focused screens | Plain, structured layouts; no decorative elements in admin tables or forms |

### Typography Anti-Patterns

| Anti-Pattern | Reason | Correct Pattern |
|-------------|--------|-----------------|
| `font-black` (weight 900) or `tracking-tighter` on headings | Editorial/fashion aesthetic, not logistics | Use `font-semibold` or `font-bold` with normal tracking |
| `text-xs` body text in scanner routes | Unreadable on small devices, gloves prevent precision | `text-base` minimum in scanner routes |
| Centered text in data tables | Reduces scanability of tabular data | Left-align text, right-align numerics |
| Text-only status communication | Accessibility failure; also slower to scan | Use `<Badge>` with color + text label for status |

### Interaction Anti-Patterns

| Anti-Pattern | Reason | Correct Pattern |
|-------------|--------|-----------------|
| `focus:ring` (non-visible variant) | Shows ring on mouse click, annoying | Use `focus-visible:ring` only |
| Hover-only affordances on scanner routes | Touch devices have no hover state | All interactions must work via click/tap |
| `transform: scale()` on card hover | Causes layout shift on dense tables | Use shadow + border color change only |
| Drag-and-drop on warehouse floor routes | Unusable with gloves | Button-based workflows for all scanner routes |
| Swipe-to-reveal actions | Precision gesture, unusable with gloves | Explicit action buttons visible at all times |

### 3PL-Specific Anti-Patterns

| Anti-Pattern | Reason |
|-------------|--------|
| Generic "item" or "product" labels where "SKU", "case", or "pallet" applies | Domain-inappropriate language erodes professional credibility |
| Displaying weight without unit | Ambiguous in logistics context (lbs vs kg) |
| Truncating order numbers or LPN numbers | These are primary identifiers — must always show fully |
| Hiding quantity-on-hand behind a click | Core metric — should be visible in tables without expansion |
| Using relative dates ("2 days ago") for shipping deadlines | Absolute dates/times required for deadline accountability |

---

## Section 7: Scanner / Warehouse Floor Rubric

**Applies to all 12 scanner-facing routes.** This rubric is a hard gate — audit findings that violate these criteria are categorized as **BLOCKING** regardless of other severity assessments.

### 7.1 The 12 Scanner-Facing Routes

| Route | Description |
|-------|-------------|
| `/tasks/pick` | Picking workflow |
| `/tasks/putaway` | Putaway workflow |
| `/tasks/inspection` | Inspection workflow |
| `/tasks/[id]` | Task detail/execution |
| `/cycle-counts/[id]` | Active cycle count |
| `/inventory/pallet-breakdown` | Pallet breakdown scanning |
| `/inbound/[id]` | Receiving workflow |
| `/outbound/[id]` | Packing/shipping workflow |
| `/returns/[id]` | Returns processing |
| `/damage-reports/[id]` | Damage documentation |
| `/locations/[id]/sublocations` | Sublocation navigation |
| `/inventory/transfers` | Stock transfers |

### 7.2 Audit Criteria (All Must Pass)

| Criterion | Minimum Requirement | BLOCKING if fails? |
|-----------|--------------------|--------------------|
| Tap target height | 44px | Yes |
| Tap target width | 44px (full-width preferred) | Yes |
| Body text size | 16px (`text-base`) | Yes |
| Contrast ratio | WCAG AA 4.5:1 | Yes |
| Primary actions per screen | Max 3 visible | No (High) |
| Hover-only interactions | None allowed | Yes |
| Precision gesture requirements | None allowed (no swipe, pinch) | Yes |
| Lighting adaptability | No pure-white text on near-white bg | Yes |

### 7.3 Shared Scanner Component Impact

Changes to these components affect ALL 12 scanner routes simultaneously:

| Component | File | Cross-cutting impact |
|-----------|------|---------------------|
| `BarcodeScanner` | `src/components/ui/BarcodeScanner.tsx` | All scanner routes |
| `ScannerModal` | `src/components/internal/ScannerModal.tsx` | Modal-wrapped scanning flows |

**Rule:** Any recommendation touching these files must be validated against all 12 routes before acceptance.

### 7.4 Target Devices

Both form factors must pass all criteria:
- **Tablets:** 10-12" displays (primary floor device)
- **Phones:** 5-6" displays (secondary, common during receiving/shipping)

---

## Section 8: Dashboard Constraints

Reference document: `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md`

### 8.1 Grid Layout Summary

| Detail | Value |
|--------|-------|
| Implementation | `src/lib/dashboard/DynamicWidgetGrid.tsx` |
| CSS approach | `lg:columns-2 gap-6` (CSS multi-column layout) |
| Grid type | Content-driven — NOT fixed-px |
| Breakpoint | Single column below `lg` (1024px), two columns at `lg`+ |

### 8.2 Minimum Width Guard Rails

| Widget Variant | Minimum Usable Width |
|----------------|---------------------|
| `"half"` widget | ~360px |
| `"full"` widget | ~full content area |
| StatCard (4-col grid) | ~178px |

**Audit rejection rule:** Any typography, padding, or spacing recommendation that makes a half widget unreadable at ~360px must be rejected or qualified with a grid-impact note.

**StatCard corollary:** Any recommendation that makes a StatCard value or label unreadable at ~178px must be rejected or qualified.

---

## Section 9: Accessibility Standards

All pages must meet **WCAG AA** minimum. Scanner-facing routes should target **WCAG AAA** where feasible.

| Criterion | Standard | Notes |
|-----------|----------|-------|
| Text contrast (normal) | 4.5:1 minimum | WCAG AA |
| Text contrast (large, 18px+) | 3:1 minimum | WCAG AA |
| Focus states | Visible `focus-visible:ring` | All interactive elements |
| Alt text | Required on all meaningful images | Decorative: `alt=""` |
| Aria labels | Required on icon-only buttons | `aria-label="Close"` |
| Keyboard navigation | Tab order matches visual order | No keyboard traps |
| Form labels | `<label>` with `for` attribute | No placeholder-only labels |
| `prefers-reduced-motion` | Respected for all animations | Use `@media (prefers-reduced-motion: reduce)` |
| Color as sole indicator | Forbidden | Must pair color with text/icon/shape |

---

## Appendix: CSS Custom Properties Reference

All CSS custom properties defined in `src/app/globals.css`:

```css
/* Admin brand */
--color-primary: #4F46E5;
--color-primary-hover: #4338CA;
--color-primary-light: #EEF2FF;

/* Portal brand */
--color-portal: #0891B2;
--color-portal-hover: #0E7490;
--color-portal-light: #ECFEFF;

/* Semantic */
--color-success: #16a34a;
--color-success-light: #f0fdf4;
--color-warning: #d97706;
--color-warning-light: #fffbeb;
--color-error: #dc2626;
--color-error-light: #fef2f2;
--color-info: #4F46E5;
--color-info-light: #EEF2FF;

/* Neutrals (slate) */
--color-bg-page: #F8FAFC;
--color-bg-subtle: #F1F5F9;
--color-bg-card: #ffffff;
--color-text-primary: #0F172A;
--color-text-secondary: #64748B;
--color-border: #E2E8F0;
--color-border-light: #F1F5F9;

/* Shadows */
--shadow-xs: 0 1px 2px rgba(0,0,0,0.03);
--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04);
--shadow-elevated: 0 8px 25px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
--shadow-modal: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.05);

/* Radii */
--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
```

---

*IMS-7D Design System — Phase 1 locked rubric*
*Do not modify after initial generation.*
