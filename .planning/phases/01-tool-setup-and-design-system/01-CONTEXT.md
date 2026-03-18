# Phase 1: Tool Setup and Design System - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Install uipro-cli, configure it for Claude Code integration, lock dual-brand constraints, compile scanner route inventory and dashboard grid dimensions, then generate a complete 3PL/warehouse-specific MASTER.md design system. This phase produces the evaluation rubric for all subsequent audit phases. No code changes to the platform.

</domain>

<decisions>
## Implementation Decisions

### Design System Prompt
- Identity: **Premium logistics** — high-end 3PL platform, professional services firm feel, clean and authoritative
- Visual reference: **Flexport** — premium brand, strong visual identity, polished logistics platform
- Visual tone: **Trust & authority** — conservative typography, structured layouts, muted colors that inspire confidence
- User personas: Three distinct user types — office staff (desktop), warehouse staff (tablets + phones on floor), external clients (desktop/mobile portal)
- Industry keywords for tool prompt: 3PL, warehouse management, logistics, supply chain, fulfillment, inventory management

### Brand Evolution
- Colors: **Open to change** — UI/UX Max Pro has full creative freedom to recommend new palette if better options exist for 3PL. Current indigo/cyan not locked.
- Typography: **Recommend Google Fonts** — tool should suggest heading + body font pairing that fits premium logistics identity
- Admin vs portal distinction: **Claude's discretion** — tool can recommend fully distinct brands or unified design with accent swap, whichever works best for the use case
- Login pages: **Include in audit** — login pages are first impression, should be audited and get redesign recommendations

### Audit Output Format
- Detail level: **Actionable specifics** — each finding includes file path, line range, current state, recommended change, and effort estimate
- Visuals: **Text descriptions only** — written findings with file paths and specific CSS/class changes, no images or mockups
- Severity system: **Claude's discretion** — can use Blocking/High/Medium/Low or simpler system as appropriate
- Accessibility findings: **Claude's discretion** — can be separate section or mixed inline with a11y tag

### Scanner Route Scope
- Scanner-facing pages (warehouse floor rubric):
  - `/tasks/pick` — picking workflow
  - `/tasks/putaway` — putaway workflow
  - `/tasks/inspection` — inspection workflow
  - `/tasks/[id]` — task detail/execution
  - `/cycle-counts/[id]` — active cycle count
  - `/inventory/pallet-breakdown` — pallet breakdown scanning
  - `/inbound/[id]` — receiving workflow
  - `/outbound/[id]` — packing/shipping workflow
  - `/returns/[id]` — returns processing
  - `/damage-reports/[id]` — damage documentation
  - `/locations/[id]/sublocations` — sublocation navigation
  - `/inventory/transfers` — stock transfers between locations
- Devices on floor: **Both tablets and phones** — audit must validate both form factors
- Warehouse floor rubric: 44px+ tap targets, high contrast, glove-friendly interactions

### Claude's Discretion
- Severity rating system (Blocking/High/Medium/Low or simpler)
- Accessibility finding organization (separate vs inline)
- Admin vs portal brand split approach (distinct vs unified with accent swap)

</decisions>

<specifics>
## Specific Ideas

- Flexport is the visual reference — premium, authoritative, logistics-native feel
- "Trust & authority" is the guiding principle — the platform should make clients feel their inventory is in professional hands
- Three user types means the design system must accommodate both data-dense office views and large-target floor views within the same design language

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `globals.css`: Already has 20+ design tokens (--color-primary, --color-portal, --shadow-*, --radius-*) — MASTER.md tokens should map to these CSS custom properties
- `src/components/ui/`: 15+ shared components (Button, Card, Modal, Table, Input, Select, Badge, etc.) — audit baseline
- `src/components/ui/BarcodeScanner.tsx`: Shared barcode scanner component — key floor interface
- 8 scanner components in `src/components/internal/`: PickingScanner, PackScanner, ShipScanner, etc.

### Established Patterns
- Tailwind CSS v4 (config-free, uses `@import "tailwindcss"` in globals.css)
- CSS custom properties in `:root` for design tokens — no tailwind.config.ts file
- Component styling via Tailwind utility classes inline, not CSS modules
- Dual-portal architecture: `(internal)/` and `(portal)/` route groups with separate layouts

### Integration Points
- `uipro-cli` installs globally, files go to `.claude/skills/ui-ux-pro-max/`
- Design system output goes to `design-system/ims7d/MASTER.md` + `design-system/ims7d/pages/*.md`
- Dashboard widget grid in `src/lib/dashboard/` — need to measure minimum cell dimensions for audit input

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-tool-setup-and-design-system*
*Context gathered: 2026-03-18*
