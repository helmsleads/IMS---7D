# Phase 8: Admin Pages - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix inline color overrides on admin pages — replace blue with indigo, yellow with amber, purple with slate. Also fix 3 scanner-route admin pages (Inventory Transfers, Task Queues, Location Sublocations) for palette compliance and tap targets. Covers PRIORITIES.md items B-19 through B-28 (High) and Blocking #13-15.

</domain>

<decisions>
## Implementation Decisions

### Color Replacement Rules
- **blue→indigo** everywhere on admin pages (tabs, badges, icons, links, focus rings)
- **yellow→amber** for warning/quarantine states
- **purple→slate** (NOT indigo) — all purple elements become slate-neutral. No accent color confusion.
- **Portal source badge on Outbound page → slate** (NOT cyan) — no cyan on admin pages at all. Both "portal" and "internal" source badges use slate.

### Dashboard Decorative Elements
- **Replace blob circles with subtle pattern** — don't just remove, add a subtle gradient or visual interest element that doesn't clutter. Claude has discretion on the specific pattern.

### Scanner Page Fixes (SCAN-09, SCAN-10, SCAN-11)
- Inventory Transfers: gray→slate palette, remove any remaining size="sm" action buttons, text-base date cells
- Task Queues (Pick/Putaway/Inspection): remove any remaining size="sm" action buttons
- Location Sublocations: full slate/indigo palette replacement, correct focus rings on all form inputs

### Already Completed (Prior Phases)
- Phase 6: Shared components already use correct colors (Alert amber, Badge amber/indigo, StatCard indigo, etc.)
- Phase 6: gray→slate migration done on shared UI components
- Phase 7: Scanner tap targets and text sizes fixed on scanner components (but scanner page-level fixes still needed here)

### Claude's Discretion
- The specific subtle pattern/gradient to replace dashboard blobs
- Order of page fixes (can be parallelized by page grouping)
- Whether to use Badge component for inline status badges that are currently raw spans

</decisions>

<specifics>
## Specific Ideas

- Keep admin pages feeling clean and professional — no accent colors outside the indigo/amber/slate palette
- The "no cyan on admin" rule is deliberate: admin = indigo world, portal = cyan world, no mixing

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Badge component now has correct amber/indigo variants (Phase 6) — pages using inline styled spans for badges could switch to Badge component
- StatCard default iconColor already fixed to indigo (Phase 6)
- Button component has correct admin indigo styling
- Input/Select components have correct indigo focus rings

### Established Patterns
- Admin pages use `(internal)` route group
- Status tabs often use inline color classes (bg-blue-50, text-blue-600) that need → indigo
- Status maps are often objects like `STATUS_CONFIG = { "pending": "bg-yellow-100 text-yellow-800" }` that need bulk correction

### Integration Points
- ~15 admin pages need inline color fixes
- 3 scanner-route admin pages need palette + tap target fixes
- Dashboard hero section has decorative blob elements to replace

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-admin-pages*
*Context gathered: 2026-03-20*
