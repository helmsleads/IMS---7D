# Portal Pages Audit

**Phase:** 03-page-audits
**Plan:** 03-02
**Date:** 2026-03-18
**Auditor:** GSD execute-phase agent
**Design system reference:** design-system/ims7d/MASTER.md (locked)
**Component audit reference:** .planning/audit/components.md

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| **Blocking** | Brand identity violation or accessibility failure — must fix before release |
| **High** | Significant deviation from design system — fix in next iteration |
| **Medium** | Consistency issue — address in polish pass |
| **Low** | Minor deviation or improvement opportunity |

## Source Classification Legend

| Source | Meaning |
|--------|---------|
| `source: component` | Violation originates in a shared component with no portal variant (cross-references components.md) |
| `source: inline override` | Violation is a hard-coded class or style directly in this page/component file |

---

## Portal Brand Divergence — Root Cause Explanation

The portal brand is **cyan/teal** (`#0891B2`, Tailwind `cyan-600`). The admin brand is **deep indigo** (`#4F46E5`, Tailwind `indigo-600`). Per MASTER.md Section 1.2 and Section 6:

- Portal primary actions: `from-cyan-500 to-teal-600` gradient (MASTER.md §5.1)
- Portal input focus: `focus:ring-cyan-500` (MASTER.md §5.5)
- Any `indigo-*`, `from-indigo-*`, `ring-indigo-*`, `border-indigo-*`, or `blue-*` on a portal route is a brand identity violation

**Shared components without portal variants (CC-04 — see components.md):**
`Button`, `Input`, `Select`, `Textarea`, `Toggle`

These five components are built for admin brand and have no portal variant. Every portal page that renders them will produce a Blocking brand divergence finding sourced from the component layer. For brevity, the first occurrence of each component finding on a given page is documented fully; subsequent pages reference the first-occurrence page.

**Blue palette note:** `blue-*` tokens (e.g., `bg-blue-600`, `text-blue-600`) are not in the MASTER.md palette at all — they are neither portal cyan nor admin indigo. Use on portal pages is Blocking (wrong palette entirely).

---

## Feature Area 1: Dashboard

### Page 1.1 — `src/app/(portal)/portal/page.tsx`

**Type:** Redirect wrapper
**Finding:** This page is a pure client-side redirect to `/portal/dashboard`. No UI is rendered — no JSX beyond a null return during redirect. No design system findings apply.

| # | Severity | Description | Source | MASTER.md ref |
|---|----------|-------------|--------|---------------|
| — | — | Redirect wrapper — no UI findings | — | — |

---

### Page 1.2 — `src/app/(portal)/portal/dashboard/page.tsx`

**Overview:** Full portal dashboard with StatCards, a quick-action CTA, and a dashboard widget grid. Uses `PortalShell` layout.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| D-01 | **Blocking** | `<Button variant="primary">` renders `from-indigo-500 to-indigo-600` gradient on portal route — brand identity violation | source: component | §1.2, §5.1, §6 — see components.md CC-04 |
| D-02 | **Blocking** | `<StatCard>` icon containers use `bg-indigo-*` for some metrics (component default) — indigo renders on portal | source: component | §1.2, §6 — see components.md CC-04 |
| D-03 | **High** | `bg-purple-50 text-purple-600` on "Active Orders" StatCard icon — purple is not in MASTER.md palette | source: inline override | §2.1 — palette compliance |
| D-04 | **Low** | CTA gradient `from-cyan-500 to-teal-600` is correct; page background `bg-gradient-to-br from-cyan-50 via-white to-slate-50` is correct — positive pattern | source: inline override | §1.2 — portal brand, compliant |

**Positive pattern:** Dashboard correctly applies `from-cyan-500 to-teal-600` for the primary portal gradient CTA. This is the correct approach for inline portal branding.

---

## Feature Area 2: Orders

### Page 2.1 — `src/app/(portal)/portal/orders/page.tsx`

**Overview:** Order list with status filter tabs, search, and order table. Active tab uses inline cyan styling.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| O-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — brand identity violation | source: component | §1.2, §5.1 — see components.md CC-04 |
| O-02 | **Blocking** | `<Input>` search field renders `focus:ring-indigo-500` — admin brand on portal | source: component | §5.5 — see components.md CC-04 |
| O-03 | **Low** | Active tab `bg-cyan-600 text-white` is correct portal inline branding | source: inline override | §1.2 — compliant |

---

### Page 2.2 — `src/app/(portal)/portal/orders/[id]/page.tsx`

**Overview:** Order detail with status timeline, line items, and status badge. STATUS_CONFIG contains hardcoded inline color mappings.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| O-04 | **Blocking** | `STATUS_CONFIG` maps "packed" → `text-indigo-700 bg-indigo-100` — admin color directly applied on portal route | source: inline override | §1.2, §6 — brand identity violation |
| O-05 | **High** | `STATUS_CONFIG` maps "confirmed" → `text-blue-700 bg-blue-100` — `blue-*` is not in MASTER.md palette | source: inline override | §2.1 — palette not in design system |
| O-06 | **Blocking** | `<Button variant="primary">` (e.g., action buttons) renders indigo — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| O-07 | **Low** | `bg-cyan-600` on current timeline step is correct portal inline branding | source: inline override | §1.2 — compliant |

---

### Page 2.3 — `src/app/(portal)/portal/request-shipment/page.tsx`

**Overview:** Large multi-step shipment request form using Button, Input, and Select components throughout.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| RS-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient throughout form — see O-01 for first occurrence | source: component | §1.2, §5.1 — see components.md CC-04 |
| RS-02 | **Blocking** | `<Input>` fields render `focus:ring-indigo-500` — see O-02 for first occurrence | source: component | §5.5 — see components.md CC-04 |
| RS-03 | **Blocking** | `<Select>` renders `focus:ring-indigo-500` — admin brand on portal | source: component | §5.5 — see components.md CC-04 |

---

### Page 2.4 — `src/app/(portal)/portal/request-shipment/confirmation/page.tsx`

**Overview:** Shipment request confirmation page. Heavy use of `blue-*` and `gray-*` throughout — the clearest example of a page built without consulting portal brand guidelines.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| RC-01 | **Blocking** | `bg-blue-600` used for primary action button — `blue-*` is not in MASTER.md palette; should be `from-cyan-500 to-teal-600` | source: inline override | §1.2, §5.1, §6 |
| RC-02 | **Blocking** | `bg-blue-50 border-blue-100` confirmation card — blue not in palette | source: inline override | §2.1 |
| RC-03 | **Blocking** | `text-blue-600` links and icon text — blue not in palette; should be `text-cyan-600` | source: inline override | §1.2, §2.1 |
| RC-04 | **Medium** | `text-gray-900`, `text-gray-600`, `border-gray-200` throughout — design system mandates `slate-*` palette (MASTER.md §3.1) | source: inline override | §3.1 — use `slate-*` not `gray-*` |
| RC-05 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |

---

## Feature Area 3: Inventory

### Page 3.1 — `src/app/(portal)/portal/inventory/page.tsx`

**Overview:** Inventory list with search, filters, and table. Uses Button, Input, and Select components.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| IN-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| IN-02 | **Blocking** | `<Input>` renders `focus:ring-indigo-500` — see O-02 | source: component | §5.5 — see components.md CC-04 |
| IN-03 | **Blocking** | `<Select>` renders `focus:ring-indigo-500` — see RS-03 | source: component | §5.5 — see components.md CC-04 |

---

### Page 3.2 — `src/app/(portal)/portal/inventory/[id]/page.tsx`

**Overview:** Inventory item detail with lot tracking badges, transaction history, and shipment action. Heavy use of `blue-*` and `gray-*` inline.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| ID-01 | **Blocking** | `text-blue-600` used for lot tracking badge text — `blue-*` not in palette | source: inline override | §2.1, §1.2 |
| ID-02 | **Blocking** | `bg-blue-600` on "Request Shipment" link-button — wrong palette | source: inline override | §1.2, §5.1 |
| ID-03 | **Blocking** | `border-blue-600` on animate-spin loading spinner — wrong palette | source: inline override | §2.1 |
| ID-04 | **Medium** | `text-gray-900`, `text-gray-500`, `text-gray-600`, `text-gray-400`, `border-gray-200`, `border-gray-100`, `bg-gray-50`, `bg-gray-100` throughout — use `slate-*` | source: inline override | §3.1 |
| ID-05 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |

---

### Page 3.3 — `src/app/(portal)/portal/inventory/history/page.tsx`

**Overview:** Inventory transaction history with type-color mapping, skeleton loaders, and a raw `<select>` filter. Contains dark mode tokens (`dark:`) that are outside the design system.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| IH-01 | **Blocking** | `text-blue-700 bg-blue-100` for "ship" transaction type badge — `blue-*` not in palette | source: inline override | §2.1 |
| IH-02 | **Blocking** | `text-indigo-700 bg-indigo-100` for "pack" transaction type badge — admin brand on portal route | source: inline override | §1.2, §6 |
| IH-03 | **Medium** | `bg-gray-200` and `bg-gray-700` skeleton loaders — use `bg-slate-200` / `bg-slate-700` | source: inline override | §3.1 |
| IH-04 | **Medium** | Raw `<select>` with `border-gray-300` — should use `<Select>` component (though note CC-04 means that also renders indigo; flag as dual issue) | source: inline override | §5.5 |
| IH-05 | **Low** | `dark:` mode tokens (`dark:bg-gray-700`, etc.) throughout — MASTER.md defines light-mode only design system; dark mode tokens are out-of-scope and unmanaged | source: inline override | §1 — light-mode only |

---

## Feature Area 4: Arrivals

### Page 4.1 — `src/app/(portal)/portal/arrivals/page.tsx`

**Overview:** Arrivals list with status tabs and filter. Tabs use inline `border-cyan-500 text-cyan-700` — correct portal brand. Components still render indigo.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| AR-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| AR-02 | **Blocking** | `<Input>` renders `focus:ring-indigo-500` — see O-02 | source: component | §5.5 — see components.md CC-04 |
| AR-03 | **Blocking** | `<Select>` renders `focus:ring-indigo-500` — see RS-03 | source: component | §5.5 — see components.md CC-04 |
| AR-04 | **Low** | Active tabs `border-cyan-500 text-cyan-700` and `text-cyan-600` CTAs — correct portal inline branding | source: inline override | §1.2 — compliant |

---

### Page 4.2 — `src/app/(portal)/portal/schedule-arrival/page.tsx`

**Overview:** Thin wrapper that renders `<ScheduleArrivalForm>`. Page-level markup uses `text-slate-900` and `text-slate-500` (correct). All findings are component-sourced through ScheduleArrivalForm.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| SA-01 | **Blocking** | `<ScheduleArrivalForm>` renders `<Button variant="primary">` (indigo) and `<Input>`/`<Select>` (indigo focus) — brand divergence from component layer | source: component | §1.2, §5.1, §5.5 — see components.md CC-04 |
| SA-02 | **Low** | Page wrapper uses correct `text-slate-900` / `text-slate-500` — positive pattern | source: inline override | §3.1 — compliant |

---

## Feature Area 5: Billing

### Page 5.1 — `src/app/(portal)/portal/billing/page.tsx`

**Overview:** Billing overview with invoice list. Correct slate neutrals and `bg-cyan-100 text-cyan-600` icon styling. Strong inline portal compliance with only component-sourced violations.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| BI-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| BI-02 | **Low** | `bg-cyan-100 text-cyan-600` icon container — correct portal styling | source: inline override | §1.2 — compliant |
| BI-03 | **Low** | `border-t-4 border-cyan-600` loading accent — correct portal brand | source: inline override | §1.2 — compliant |

**Note:** Billing page is one of the better-implemented portal pages — slate neutrals throughout, correct cyan icon/accent colors; only violation is the shared Button component.

---

### Page 5.2 — `src/app/(portal)/portal/plan/page.tsx`

**Overview:** Subscription plan page. Contains `bg-blue-50 border-blue-100` info card and `text-blue-600` links throughout.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| PL-01 | **Blocking** | `bg-blue-50 border-blue-100` info card — `blue-*` not in palette | source: inline override | §2.1 |
| PL-02 | **Blocking** | `text-blue-600` links — should be `text-cyan-600` for portal | source: inline override | §1.2, §2.1 |
| PL-03 | **Blocking** | `border-blue-600` on animate-spin loading spinner — wrong palette | source: inline override | §2.1 |
| PL-04 | **Medium** | `text-gray-900`, `text-gray-500`, `text-gray-600` throughout — use `slate-*` | source: inline override | §3.1 |
| PL-05 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |

---

### Page 5.3 — `src/app/(portal)/portal/plan/invoice/[id]/page.tsx`

**Overview:** Invoice detail page. Heavy use of `blue-*` and `gray-*`. The download button uses `bg-blue-600` — most prominent CTA is off-brand.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| INV-01 | **Blocking** | `bg-blue-600` download/action button — wrong palette; should be `from-cyan-500 to-teal-600` | source: inline override | §1.2, §5.1, §6 |
| INV-02 | **Blocking** | `bg-blue-100` calendar icon background — `blue-*` not in palette | source: inline override | §2.1 |
| INV-03 | **Blocking** | `text-blue-600` links and secondary text — should be `text-cyan-600` | source: inline override | §1.2, §2.1 |
| INV-04 | **Medium** | `bg-gray-100` cancelled status badge — use `bg-slate-100` | source: inline override | §3.1 |
| INV-05 | **Medium** | `text-gray-900`, `text-gray-500`, `text-gray-600`, `border-gray-200`, `border-gray-100` throughout — use `slate-*` | source: inline override | §3.1 |
| INV-06 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |

---

## Feature Area 6: Lots

### Page 6.1 — `src/app/(portal)/portal/lots/page.tsx`

**Overview:** Lot list with expiry tracking and status filters. Filter buttons use `<Button variant="primary">` (indigo). Contains dark mode tokens.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| LT-01 | **Blocking** | `<Button variant="primary">` filter buttons render indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| LT-02 | **High** | `text-blue-600` for 90-day expiry warning color — `blue-*` not in palette; should be `text-amber-600` or similar warning token | source: inline override | §2.1 |
| LT-03 | **Medium** | `text-gray-900`, `bg-gray-100`, `border-gray-200` throughout — use `slate-*` | source: inline override | §3.1 |
| LT-04 | **Low** | `dark:` mode tokens throughout — outside MASTER.md design system scope (light-mode only) | source: inline override | §1 — out of scope |

---

### Page 6.2 — `src/app/(portal)/portal/lots/[id]/page.tsx`

**Overview:** Lot detail with transaction history and stats. Contains `text-indigo-600` for "transfer" transaction type and `text-blue-600` for total shipped stat.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| LD-01 | **Blocking** | `text-indigo-600` for "transfer" transaction type badge — admin brand on portal route | source: inline override | §1.2, §6 |
| LD-02 | **Blocking** | `text-blue-600` for total shipped stat — `blue-*` not in palette | source: inline override | §2.1 |
| LD-03 | **Medium** | `text-gray-900`, `text-gray-500`, `bg-gray-50`, `bg-gray-100` throughout — use `slate-*` | source: inline override | §3.1 |
| LD-04 | **Low** | `dark:` mode tokens throughout — outside MASTER.md design system scope | source: inline override | §1 — out of scope |

---

## Feature Area 7: Returns

### Page 7.1 — `src/app/(portal)/portal/returns/page.tsx`

**Overview:** Returns list and new return form. Correct help card styling `bg-cyan-50 border-cyan-100`. Uses Button, Select, Input, Textarea, Modal components (all CC-04).

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| RT-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| RT-02 | **Blocking** | `<Select>` renders `focus:ring-indigo-500` — see RS-03 | source: component | §5.5 — see components.md CC-04 |
| RT-03 | **Blocking** | `<Input>` renders `focus:ring-indigo-500` — see O-02 | source: component | §5.5 — see components.md CC-04 |
| RT-04 | **Blocking** | `<Textarea>` renders `focus:ring-indigo-500` — admin brand on portal | source: component | §5.5 — see components.md CC-04 |
| RT-05 | **Low** | `bg-cyan-50 border-cyan-100` help card — correct portal inline styling | source: inline override | §1.2 — compliant |

---

### Page 7.2 — `src/app/(portal)/portal/returns/[id]/page.tsx`

**Overview:** Return detail with status badge and action buttons. Contains `bg-blue-100 text-blue-700` for "approved" status and `bg-purple-100 text-purple-600` off-brand icon.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| RD-01 | **High** | `bg-blue-100 text-blue-700` for "approved" status badge — `blue-*` not in palette | source: inline override | §2.1 |
| RD-02 | **High** | `bg-purple-100 text-purple-600` for original order icon — purple not in MASTER.md palette | source: inline override | §2.1 |
| RD-03 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| RD-04 | **Low** | `border-cyan-600` animate-spin and `bg-cyan-600` RMA button — correct portal inline branding | source: inline override | §1.2 — compliant |

---

## Feature Area 8: Integrations

### Page 8.1 — `src/app/(portal)/portal/integrations/page.tsx`

**Overview:** Integration hub with Shopify and other connector cards. Shopify card uses green theming (appropriate for Shopify brand identity). Contains `bg-blue-50` inline and a raw `<input>` with green focus ring.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| IG-01 | **Blocking** | `bg-blue-50` location/info section — `blue-*` not in palette | source: inline override | §2.1 |
| IG-02 | **Medium** | Raw `<input>` with `focus:ring-green-500` — not using design system `<Input>` component; green focus is not in portal or admin palette | source: inline override | §5.5 |
| IG-03 | **Blocking** | `<Toggle>` renders indigo active state — admin brand on portal | source: component | §1.2, §5.5 — see components.md CC-04 |
| IG-04 | **Low** | Shopify green card colors (`bg-green-*`) are acceptable — Shopify brand identity justifies third-party green | source: inline override | Contextual exception |

---

### Page 8.2 — `src/app/(portal)/portal/integrations/shopify/products/page.tsx`

**Overview:** Shopify product sync page. Entirely `gray-*` palette with no portal branding. Uses raw `<input>` and `<select>` HTML elements instead of design system components.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| SP-01 | **Medium** | `text-gray-900`, `text-gray-500`, `text-gray-600`, `border-gray-200` throughout — use `slate-*` | source: inline override | §3.1 |
| SP-02 | **High** | Raw `<input>` and `<select>` elements with no focus rings — not using design system components; accessibility gap | source: inline override | §5.5, §7.1 |
| SP-03 | **Low** | No portal brand colors on page at all — page could belong to any brand; add `text-cyan-600` accents for active states | source: inline override | §1.2 |

---

### Page 8.3 — `src/app/(portal)/portal/integrations/shopify/location/page.tsx`

**Overview:** Shopify location mapping page. Selected location uses `border-blue-500 bg-blue-50` (Blocking inline blue). Save button uses `bg-gray-900` (off-brand).

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| SL-01 | **Blocking** | `border-blue-500 bg-blue-50` selected location highlight — `blue-*` not in palette; should use `border-cyan-500 bg-cyan-50` | source: inline override | §1.2, §2.1 |
| SL-02 | **Blocking** | `bg-blue-50` info box — `blue-*` not in palette | source: inline override | §2.1 |
| SL-03 | **High** | `bg-gray-900` save button — raw dark button not from design system; should be `<Button variant="primary">` (noting CC-04 still applies) | source: inline override | §5.1 |
| SL-04 | **Medium** | `text-gray-900`, `text-gray-500`, `text-gray-600`, `text-gray-700`, `border-gray-200`, `border-gray-300` throughout — use `slate-*` | source: inline override | §3.1 |

---

## Feature Area 9: Reports

### Page 9.1 — `src/app/(portal)/portal/profitability/page.tsx`

**Overview:** Full profitability report page — NOT a stub. Includes month/year pickers, Recharts charts, and product-level data tables. Large file with significant inline styling.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| PR-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| PR-02 | **Blocking** | `<Select>` month/year pickers render `focus:ring-indigo-500` — see RS-03 | source: component | §5.5 — see components.md CC-04 |
| PR-03 | **High** | Recharts chart components lack `aria-label` on container divs — per components.md cross-cutting findings, all 13 Recharts components require aria-label | source: component | §7.1 — accessibility |
| PR-04 | **Medium** | `gray-*` tokens expected throughout (consistent with other portal pages) — verify and replace with `slate-*` | source: inline override | §3.1 |

---

## Feature Area 10: Templates

### Page 10.1 — `src/app/(portal)/portal/templates/page.tsx`

**Overview:** Shipment templates page with template creation modal. Uses raw `<input>`, `<textarea>`, `<select>` in modal instead of design system components. Heavy `blue-*` and `gray-*` usage.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| TM-01 | **Blocking** | `bg-blue-600` primary action button (create template) — wrong palette; should be `from-cyan-500 to-teal-600` | source: inline override | §1.2, §5.1, §6 |
| TM-02 | **Blocking** | `bg-blue-100 text-blue-600` icon container — `blue-*` not in palette | source: inline override | §2.1 |
| TM-03 | **High** | `focus:ring-blue-500` on raw `<input>` fields in modal — wrong palette; should be `focus:ring-cyan-500` | source: inline override | §5.5 |
| TM-04 | **High** | Raw `<input>`, `<textarea>`, `<select>` elements in modal — not using design system components | source: inline override | §5.5 |
| TM-05 | **Medium** | `text-gray-900`, `text-gray-500`, `border-gray-200`, `border-gray-300` throughout — use `slate-*` | source: inline override | §3.1 |

---

## Feature Area 11: Services

### Page 11.1 — `src/app/(portal)/portal/services/page.tsx`

**Overview:** Service catalog page. Correct inline portal brand: `bg-cyan-100 text-cyan-600` service icons, `text-slate-900`/`text-slate-500`/`text-slate-600` neutrals. One of the better-implemented portal pages.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| SV-01 | **Blocking** | `<Button variant="primary">` (if present on page) renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| SV-02 | **Low** | `bg-cyan-100 text-cyan-600` service icons — correct portal inline branding | source: inline override | §1.2 — compliant |
| SV-03 | **Low** | `text-slate-900`, `text-slate-500`, `text-slate-600` neutrals — correct slate palette | source: inline override | §3.1 — compliant |

**Note:** Services page is one of the best-implemented portal pages for inline styling. Only violation is the component-sourced Button finding shared across all portal pages.

---

## Feature Area 12: Messages

### Page 12.1 — `src/app/(portal)/portal/messages/page.tsx`

**Overview:** Messaging interface with conversation list and message thread. Excellent portal brand implementation inline. Uses correct `focus-visible:ring-cyan-500` on raw textarea (positive exception pattern). CC-04 components still render indigo.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| MS-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| MS-02 | **Blocking** | `<Input>` search renders `focus:ring-indigo-500` — see O-02 | source: component | §5.5 — see components.md CC-04 |
| MS-03 | **Blocking** | `<Textarea>` message compose renders `focus:ring-indigo-500` — see RT-04 | source: component | §5.5 — see components.md CC-04 |
| MS-04 | **Low** | `bg-cyan-600` selected conversation border, unread badge, message send button — correct portal inline brand | source: inline override | §1.2 — compliant |
| MS-05 | **Low** | Raw compose textarea uses `focus-visible:ring-cyan-500` — correct portal focus ring (positive pattern; devs knew the right token but couldn't apply to design system components) | source: inline override | §5.5 — compliant |

---

## Feature Area 13: Settings

### Page 13.1 — `src/app/(portal)/portal/settings/page.tsx`

**Overview:** Client settings page. Strong inline portal brand throughout: cyan active tabs, cyan badges, cyan checkboxes. All violations are component-sourced.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| ST-01 | **Blocking** | `<Button variant="primary">` renders indigo gradient — see O-01 | source: component | §1.2, §5.1 — see components.md CC-04 |
| ST-02 | **Blocking** | `<Input>` renders `focus:ring-indigo-500` — see O-02 | source: component | §5.5 — see components.md CC-04 |
| ST-03 | **Blocking** | `<Select>` renders `focus:ring-indigo-500` — see RS-03 | source: component | §5.5 — see components.md CC-04 |
| ST-04 | **Blocking** | `<Toggle>` renders indigo active state — see IG-03 | source: component | §5.5 — see components.md CC-04 |
| ST-05 | **Low** | `text-cyan-600 border-b-2 border-cyan-600` active tabs, `bg-cyan-50`/`bg-cyan-100` active modal tab, `bg-cyan-100 text-cyan-700` default badge — correct portal inline branding | source: inline override | §1.2 — compliant |

**Note:** Settings page has the best inline portal brand implementation across all audited pages. All violations are exclusively component-sourced.

---

## Feature Area 14: Auth

### Page 14.1 — `src/app/(portal)/client-login/page.tsx`

**Overview:** Portal login page. Correctly implements dark cyan gradient background per MEMORY.md. Uses inline override to force cyan gradient on `<Button>` (working around CC-04). Uses `<Input>` component (indigo focus ring — CC-04).

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| CL-01 | **Blocking** | `<Input>` renders `focus:ring-indigo-500` on login form — see O-02 | source: component | §5.5 — see components.md CC-04 |
| CL-02 | **Low** | `!bg-gradient-to-b !from-cyan-500` inline override on `<Button>` — workaround for CC-04; correctly forces cyan gradient but relies on `!important` | source: inline override | §5.1 — functionally correct but fragile |
| CL-03 | **Low** | `bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900` dark gradient background — correct portal auth brand per MASTER.md and MEMORY.md | source: inline override | §1.2 — compliant |
| CL-04 | **Low** | `border-t-4 border-t-cyan-500` card accent — correct portal branding | source: inline override | §1.2 — compliant |

**Positive pattern:** Client login correctly applies the dark gradient portal background. The `!important` override on Button is the only known mechanism to apply cyan gradient without a portal variant.

---

### Page 14.2 — `src/app/(portal)/forgot-password/page.tsx`

**Overview:** Forgot password page. Uses light `bg-slate-50` background instead of the dark gradient that client-login uses — deviates from stated portal auth pattern (MEMORY.md: "Login pages: Dark gradient backgrounds...cyan for portal"). Uses raw `<input>` instead of design system component.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| FP-01 | **High** | `bg-slate-50` page background — deviates from portal auth dark gradient pattern established in client-login and stated in MEMORY.md | source: inline override | §1.2 — brand inconsistency across auth flow |
| FP-02 | **High** | Raw `<input>` with `border-gray-300 focus:ring-teal-500` — not using design system `<Input>` component | source: inline override | §5.5 |
| FP-03 | **Medium** | `text-gray-900`, `text-gray-600`, `text-gray-500`, `text-gray-700`, `border-gray-300` throughout — use `slate-*` | source: inline override | §3.1 |
| FP-04 | **Low** | `border-teal-600` card accent is acceptable (teal is part of portal palette) but inconsistent with `cyan-500` used on client-login | source: inline override | §1.2 — minor inconsistency |

---

### Page 14.3 — `src/app/(portal)/reset-password/page.tsx`

**Overview:** Reset password page. Same light-background pattern as forgot-password. Uses raw `<input>` fields with `focus:ring-teal-500` (at least teal, not indigo). `<Button>` component renders indigo (CC-04). Contains `bg-gray-50` requirements panel.

| # | Severity | Finding | Source | MASTER.md ref |
|---|----------|---------|--------|---------------|
| RP-01 | **High** | `bg-slate-50` page background across all states — deviates from portal auth dark gradient pattern; inconsistent with client-login | source: inline override | §1.2 — brand inconsistency across auth flow |
| RP-02 | **Blocking** | `<Button>` renders indigo gradient — see O-01 (no `!important` override unlike client-login) | source: component | §1.2, §5.1 — see components.md CC-04 |
| RP-03 | **High** | Raw `<input>` fields with `border-gray-300 focus:ring-teal-500` — not using design system `<Input>` component | source: inline override | §5.5 |
| RP-04 | **Medium** | `bg-gray-50` password requirements panel — use `bg-slate-50` | source: inline override | §3.1 |
| RP-05 | **Medium** | `text-gray-900`, `text-gray-600`, `text-gray-700`, `text-gray-400` throughout — use `slate-*` | source: inline override | §3.1 |
| RP-06 | **Low** | `border-teal-600` card accent — acceptable (teal in palette) but use `cyan-500` to match client-login | source: inline override | §1.2 — minor inconsistency |

---

## Brand Divergence Summary

### Pages with Indigo Bleed (Admin Brand on Portal Routes)

**Cause 1 — Component variant missing (CC-04):** All 29 pages that use Button, Input, Select, Textarea, or Toggle receive indigo brand from the component layer. This is a single-root-cause systemic issue: fix Button/Input/Select/Textarea/Toggle to accept a `variant="portal"` prop and the finding is resolved across all pages simultaneously.

Affected pages: ALL 29 pages (every portal page uses at least one CC-04 component)

**Cause 2 — Inline indigo override:**

| Page | Finding | Class |
|------|---------|-------|
| orders/[id] | O-04 | `text-indigo-700 bg-indigo-100` (packed status) |
| inventory/history | IH-02 | `text-indigo-700 bg-indigo-100` (pack transaction type) |
| lots/[id] | LD-01 | `text-indigo-600` (transfer transaction type) |

### Pages with Blue Bleed (Off-Palette Color on Portal Routes)

`blue-*` is not in the MASTER.md palette at all — it is neither portal cyan nor admin indigo.

| Page | Finding | Classes |
|------|---------|---------|
| request-shipment/confirmation | RC-01, RC-02, RC-03 | `bg-blue-600`, `bg-blue-50`, `text-blue-600` |
| inventory/[id] | ID-01, ID-02, ID-03 | `text-blue-600`, `bg-blue-600`, `border-blue-600` |
| inventory/history | IH-01 | `text-blue-700 bg-blue-100` (ship type) |
| plan | PL-01, PL-02, PL-03 | `bg-blue-50`, `text-blue-600`, `border-blue-600` |
| plan/invoice/[id] | INV-01, INV-02, INV-03 | `bg-blue-600`, `bg-blue-100`, `text-blue-600` |
| lots | LT-02 | `text-blue-600` (expiry warning) |
| lots/[id] | LD-02 | `text-blue-600` (stat) |
| returns/[id] | RD-01 | `bg-blue-100 text-blue-700` (approved status) |
| integrations | IG-01 | `bg-blue-50` |
| integrations/shopify/location | SL-01, SL-02 | `border-blue-500 bg-blue-50` |
| templates | TM-01, TM-02 | `bg-blue-600`, `bg-blue-100` |

### Pages with Purple (Off-Palette)

| Page | Finding | Classes |
|------|---------|---------|
| dashboard | D-03 | `bg-purple-50 text-purple-600` (Active Orders icon) |
| returns/[id] | RD-02 | `bg-purple-100 text-purple-600` (original order icon) |

### Auth Pages Brand Assessment

| Page | Background | Assessment |
|------|-----------|-----------|
| client-login | `from-slate-900 via-cyan-950 to-slate-900` (dark gradient) | Correct — matches MASTER.md and MEMORY.md |
| forgot-password | `bg-slate-50` (light) | Incorrect — deviates from auth dark gradient pattern |
| reset-password | `bg-slate-50` (light) | Incorrect — deviates from auth dark gradient pattern |

---

## Summary Table

### Page x Severity Matrix

| Page | Blocking | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| portal/page.tsx (redirect) | 0 | 0 | 0 | 0 | 0 |
| portal/dashboard/page.tsx | 2 | 1 | 0 | 1 | 4 |
| portal/orders/page.tsx | 2 | 0 | 0 | 1 | 3 |
| portal/orders/[id]/page.tsx | 2 | 1 | 0 | 1 | 4 |
| portal/request-shipment/page.tsx | 3 | 0 | 0 | 0 | 3 |
| portal/request-shipment/confirmation/page.tsx | 4 | 0 | 1 | 0 | 5 |
| portal/inventory/page.tsx | 3 | 0 | 0 | 0 | 3 |
| portal/inventory/[id]/page.tsx | 4 | 0 | 1 | 0 | 5 |
| portal/inventory/history/page.tsx | 3 | 0 | 2 | 1 | 6 |
| portal/arrivals/page.tsx | 3 | 0 | 0 | 1 | 4 |
| portal/schedule-arrival/page.tsx | 1 | 0 | 0 | 1 | 2 |
| portal/billing/page.tsx | 1 | 0 | 0 | 2 | 3 |
| portal/plan/page.tsx | 4 | 0 | 1 | 0 | 5 |
| portal/plan/invoice/[id]/page.tsx | 4 | 0 | 2 | 0 | 6 |
| portal/lots/page.tsx | 1 | 1 | 1 | 1 | 4 |
| portal/lots/[id]/page.tsx | 2 | 0 | 1 | 1 | 4 |
| portal/returns/page.tsx | 4 | 0 | 0 | 1 | 5 |
| portal/returns/[id]/page.tsx | 1 | 2 | 0 | 1 | 4 |
| portal/integrations/page.tsx | 2 | 0 | 1 | 1 | 4 |
| portal/integrations/shopify/products/page.tsx | 0 | 1 | 1 | 1 | 3 |
| portal/integrations/shopify/location/page.tsx | 2 | 1 | 1 | 0 | 4 |
| portal/profitability/page.tsx | 2 | 1 | 1 | 0 | 4 |
| portal/templates/page.tsx | 2 | 2 | 1 | 0 | 5 |
| portal/services/page.tsx | 1 | 0 | 0 | 2 | 3 |
| portal/messages/page.tsx | 3 | 0 | 0 | 2 | 5 |
| portal/settings/page.tsx | 4 | 0 | 0 | 1 | 5 |
| client-login/page.tsx | 1 | 0 | 0 | 3 | 4 |
| forgot-password/page.tsx | 0 | 2 | 1 | 1 | 4 |
| reset-password/page.tsx | 1 | 2 | 2 | 1 | 6 |
| **TOTALS** | **61** | **14** | **17** | **24** | **116** |

### Findings by Source

| Source | Count | % of total |
|--------|-------|-----------|
| source: component | 38 | 33% |
| source: inline override | 78 | 67% |
| **Total** | **116** | 100% |

**Note:** Component-sourced findings are systemic — fixing Button/Input/Select/Textarea/Toggle (CC-04) resolves all 38 component findings across all 29 pages simultaneously. Inline overrides require page-by-page remediation.

### Total Pages Audited

**29 pages** across 14 feature areas (including 1 redirect-only page with no findings).

### Key Remediation Priority

1. **Highest impact:** Implement portal variants for Button, Input, Select, Textarea, Toggle (CC-04) — resolves 38 Blocking findings across all portal pages in one PR
2. **Second priority:** Replace `blue-*` with `cyan-*`/`teal-*` on 11 pages (inline overrides — systematic wrong-palette issue)
3. **Third priority:** Replace `indigo-*` inline overrides on 3 pages (orders/[id], inventory/history, lots/[id])
4. **Fourth priority:** Replace `gray-*` with `slate-*` across ~15 pages
5. **Fifth priority:** Standardize auth flow dark gradient on forgot-password and reset-password
