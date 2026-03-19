# Phase 3: Page Audits - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit all admin and portal pages against the locked MASTER.md design system, informed by Phase 2 component findings. Produce two separate audit documents: `.planning/audit/admin-pages.md` and `.planning/audit/portal-pages.md`. Each finding is classified as "source: component" (traces to Phase 2) or "source: inline override" (page-specific). Scanner-facing pages get the warehouse floor rubric overlay. No code changes — audit only.

</domain>

<decisions>
## Implementation Decisions

### Page Grouping Strategy
- **Group by feature area** — organize pages by domain: Orders (inbound/outbound), Inventory, Billing, Reports, Settings, Clients, etc.
- Not alphabetical — feature grouping keeps related pages together for coherent findings

### Admin vs Portal Split
- **Separate documents** — `.planning/audit/admin-pages.md` and `.planning/audit/portal-pages.md`
- Matches roadmap success criteria which expects two separate files
- Each document has its own overview, feature-area sections, and summary counts

### Carried from Prior Phases (locked)
- **Audit detail level:** Actionable specifics — file path, line range, current state, recommended change, effort estimate (Phase 1)
- **Severity system:** Blocking/High/Medium/Low (established in Phase 2, RC-01 through RC-05 root causes)
- **Finding classification:** Every finding tagged as "source: component" or "source: inline override" (from roadmap)
- **Scanner pages:** 12 routes get warehouse floor rubric (44px+ tap targets, 16px+ text, no precision gestures) (Phase 1)
- **Login pages included:** Both admin and portal login pages are in audit scope (Phase 1)
- **Component cross-reference:** `.planning/audit/components.md` has 195 findings across 37 components — page findings that trace to a component root cause should reference the component finding ID rather than re-documenting
- **Portal brand divergence:** Identify pages that unintentionally use admin (indigo) elements instead of portal (cyan) (from roadmap)

### Claude's Discretion
- Feature area grouping names (e.g., "Orders" vs "Order Management")
- How to handle pages that span multiple feature areas
- Level of cross-referencing detail to components.md (finding ID vs brief description)
- Whether to include a cross-portal comparison section

</decisions>

<specifics>
## Specific Ideas

- The "source: component" vs "source: inline override" classification is the key value-add of this phase — it tells the implementation milestone WHERE to fix each issue
- Scanner pages should be flagged prominently since they have the most Blocking findings from the component audit
- Portal pages need special attention for brand divergence — any page accidentally using indigo instead of cyan is a finding

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design-system/ims7d/MASTER.md`: 568-line locked rubric
- `.planning/audit/components.md`: 195 findings across 37 components — cross-reference target
- `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md`: 12 scanner routes
- `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md`: ~360px/~178px constraints

### Page Inventory
**Admin pages (~62 in src/app/(internal)/):**
- Dashboard, Inventory (list, detail, transfers, pallet-breakdown, import), Products (list, detail, categories)
- Inbound (list, detail, new), Outbound (list, detail, new)
- Clients (list, detail, users, settings, billing), Billing (list, detail)
- Reports (8+: inventory-summary, order-history, low-stock, client-profitability, supply-usage, service-usage, invoice-status, lot-expiration, reorder-suggestions, returns-summary)
- Settings (main, system, portal, workflows), Tasks (list, detail, pick, putaway, inspection)
- Locations (list, detail, sublocations), Lots (list, detail), Returns (list, detail)
- Damage Reports (list, detail), Cycle Counts (list, detail), Checklists (list, detail)
- Supplies (list, import), Services (list, addons), Messages, Login

**Portal pages (~15+ in src/app/(portal)/):**
- Dashboard, Orders, Inventory, Billing, Arrivals, Integrations (Shopify products), Login, Password reset

### Established Patterns
- Admin pages use AppShell (Sidebar.tsx) with indigo brand
- Portal pages use PortalShell (PortalSidebar.tsx) with cyan brand
- Most pages follow list→detail pattern with Table + Modal components

### Integration Points
- Audit output goes to `.planning/audit/admin-pages.md` and `.planning/audit/portal-pages.md`
- Phase 4 action plan will consume all three audit files (components.md, admin-pages.md, portal-pages.md)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-page-audits*
*Context gathered: 2026-03-19*
