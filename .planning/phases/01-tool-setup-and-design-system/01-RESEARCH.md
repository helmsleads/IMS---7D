# Phase 1: Tool Setup and Design System - Research

**Researched:** 2026-03-18
**Domain:** UI/UX audit tooling installation + 3PL/warehouse-specific design system generation
**Confidence:** HIGH (all critical claims verified from npm registry, GitHub source, official docs, and direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Identity**: Premium logistics — high-end 3PL platform, professional services firm feel, clean and authoritative
- **Visual reference**: Flexport — premium brand, strong visual identity, polished logistics platform
- **Visual tone**: Trust & authority — conservative typography, structured layouts, muted colors that inspire confidence
- **User personas**: Three distinct user types — office staff (desktop), warehouse staff (tablets + phones on floor), external clients (desktop/mobile portal)
- **Industry keywords for tool prompt**: 3PL, warehouse management, logistics, supply chain, fulfillment, inventory management
- **Audit output format**: Actionable specifics — each finding includes file path, line range, current state, recommended change, and effort estimate
- **Visuals**: Text descriptions only — written findings with file paths and specific CSS/class changes, no images or mockups
- **Scanner-facing pages (warehouse floor rubric)**:
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
- **Devices on floor**: Both tablets and phones — audit must validate both form factors
- **Warehouse floor rubric**: 44px+ tap targets, high contrast, glove-friendly interactions

### Claude's Discretion

- Colors: Open to change — UI/UX Max Pro has full creative freedom to recommend new palette if better options exist for 3PL. Current indigo/cyan not locked.
- Typography: Recommend Google Fonts — tool should suggest heading + body font pairing that fits premium logistics identity
- Admin vs portal distinction: Claude's discretion — tool can recommend fully distinct brands or unified design with accent swap, whichever works best for the use case
- Severity rating system (Blocking/High/Medium/Low or simpler)
- Accessibility finding organization (separate vs inline)
- Login pages: Include in audit — login pages are first impression, should be audited and get redesign recommendations

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETUP-01 | User can install uipro-cli globally and initialize it for Claude Code integration | Installation commands verified from npm registry and GitHub; installs to `.claude/skills/ui-ux-pro-max/` |
| SETUP-02 | User can configure dual-brand constraints (admin indigo, portal cyan) as hard rules before audit | Dual-brand constraint must be injected explicitly in tool prompt before generation — no auto-detect; pattern documented in ARCHITECTURE.md |
| SETUP-03 | User can verify Python 3.x availability and test uipro-cli connection | Python 3.13.5 already installed and confirmed; test via `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style -n 3` |
| SETUP-04 | User can compile scanner-facing route inventory and dashboard grid cell dimensions as audit inputs | 12 scanner routes explicitly listed in CONTEXT.md; dashboard uses CSS columns layout (not fixed grid px); half/full size distinction captured |
| DSYS-01 | User can generate a 3PL/warehouse-specific MASTER.md design system with colors, typography, layouts, effects, and anti-patterns | Full generation command with `--design-system --persist -p "ims7d" --stack nextjs` documented; dual-brand prompt strategy defined |
| DSYS-02 | User can review design system recommendations for both admin (indigo) and portal (cyan) brand variants | Requires explicit dual-brand constraint injection in prompt; generate with both brand anchors stated |
| DSYS-03 | User can validate generated design tokens against existing globals.css custom properties | globals.css has 20 named custom properties mapped — full token list documented in this research |
</phase_requirements>

---

## Summary

Phase 1 is a pure setup and generation phase — no source code is modified. It installs the UI/UX Max Pro skill (`uipro-cli`), verifies Python availability, compiles the pre-audit constraint inputs (scanner routes + dashboard grid dimensions), and generates `design-system/ims7d/MASTER.md` as the locked evaluation rubric for all subsequent audit phases.

The most critical execution risk is constraint injection order: the design system must be generated with dual-brand anchors, warehouse operator persona, and scanner-floor rubric stated upfront. If MASTER.md is generated without these constraints, it will produce a single unified palette (collapsing admin/portal distinction) and apply consumer SaaS density standards to industrial interfaces. These errors are expensive to discover mid-audit and require full regeneration.

The second risk specific to this phase is the uipro-cli version discrepancy — npm shows multiple version references (v2.5.0 and v2.2.2). Run `uipro versions` immediately after install to confirm the active version and verify that `--design-system --persist` flags exist before generating.

**Primary recommendation:** Install uipro-cli, verify Python, run the smoke test, then generate MASTER.md in a single well-constructed prompt that states all constraints upfront — never iterate on a partially-constrained output.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| uipro-cli | 2.5.0 (verify at install — see version flag) | Global installer that places the UI/UX Max Pro skill into `.claude/skills/ui-ux-pro-max/` | Only mechanism to install the Claude Code skill; handles platform detection and file placement automatically |
| Python 3.x | 3.13.5 (already installed) | Runtime for BM25 design intelligence engine (`search.py`, `core.py`, `design_system.py`) | Required by the skill; uses pure stdlib — zero pip dependencies needed |
| Node.js | 22.17.0 (already installed) | Required to run `npm install -g uipro-cli` | Already present; no version change needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python stdlib only | built-in | BM25 search engine powering all design queries | Always — no external Python packages required or allowed |

### What NOT to install

| Avoid | Why |
|-------|-----|
| `pip install rank-bm25` | The skill ships its own pure stdlib BM25 — external pip packages are not needed and create version conflict risk |
| uipro-cli as a `package.json` dependency | It is a global installer tool, not a project runtime dependency |
| `uipro init --ai all` | Pollutes repo with skill files for Cursor, Windsurf, Copilot — install only for Claude (`--ai claude`) |

**Installation:**
```bash
# Step 1: Install the CLI globally (one-time, not in package.json)
npm install -g uipro-cli

# Step 2: Initialize the skill for Claude Code (run from project root)
uipro init --ai claude

# Step 3: Verify Python availability and skill smoke test
python3 --version
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style -n 3

# Step 4: If GitHub API is rate-limited during init
uipro init --ai claude --offline
```

---

## Architecture Patterns

### Recommended Project Structure

After Phase 1, the project gains these new paths:

```
C:/Users/18cla/IMS - 7D/
├── .claude/
│   └── skills/
│       └── ui-ux-pro-max/          # installed by uipro-cli
│           ├── SKILL.md             # Claude workflow rules — auto-loaded on UI/UX keywords
│           ├── scripts/
│           │   ├── search.py        # BM25 CLI entry point
│           │   ├── core.py          # BM25 engine + domain routing
│           │   └── design_system.py # 5-step design generation pipeline
│           └── data/
│               ├── products.csv     # 161 product types + reasoning rules
│               ├── styles.csv       # 67 UI styles
│               ├── colors.csv       # 96 palettes
│               ├── typography.csv   # 57 font pairings
│               ├── ux-guidelines.csv # 99 UX guidelines
│               ├── ui-reasoning.csv # 161 industry reasoning rules (includes logistics)
│               └── charts.csv       # + 4 more domain CSVs
├── design-system/
│   └── ims7d/
│       ├── MASTER.md                # GENERATED — locked evaluation rubric
│       └── pages/                   # (populated in Phases 2-3)
└── .planning/
    └── phases/01-tool-setup-and-design-system/
        └── SCANNER-ROUTES.md        # pre-audit constraint doc (created in this phase)
```

### Pattern 1: Skill Auto-Activation

**What:** Claude Code reads `.claude/skills/ui-ux-pro-max/SKILL.md` automatically when UI/UX keywords appear in prompts. No explicit invocation needed for routine use.

**When to use:** Any prompt containing "audit", "design", "review", "component", etc. triggers the skill automatically.

**Manual invocation (for design system generation):**
```bash
# Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "3PL warehouse management logistics SaaS" \
  --design-system --persist -p "ims7d" --stack nextjs
```

### Pattern 2: Dual-Brand Constraint Injection

**What:** The tool has no awareness of intentional multi-brand architecture. The dual-brand constraint must be stated explicitly in every design system generation prompt.

**When to use:** At design system generation time. State once in MASTER.md generation; the constraint then propagates to all audit phases via the generated document.

**Required prompt pattern for MASTER.md generation:**
```
Generate a design system for IMS-7D, a 3PL warehouse management platform.

HARD CONSTRAINTS — do not merge or normalize these:
- Admin portal brand: deep indigo (#4F46E5). This is the internal staff interface.
- Client portal brand: cyan/teal (#0891B2). This is the external client view.
- These must remain visually distinct. Generate separate token sets for each.

VISUAL REFERENCE: Flexport — premium, authoritative, logistics-native identity.
VISUAL TONE: Trust and authority. Conservative typography, structured layouts.

USER PERSONAS:
- Office staff (admin): desktop, data-dense tables, 8+ hours/day, expert users
- Warehouse workers (admin scanner pages): tablets + phones, gloved hands, 44px+ touch targets, high contrast
- External clients (portal): desktop/mobile, occasional use, reporting focus

INDUSTRY CONTEXT: 3PL, warehouse management, logistics, supply chain, fulfillment, inventory management
STACK: Next.js 14, Tailwind CSS 4 (config-free), CSS custom properties in globals.css
```

### Pattern 3: Token-to-Custom-Property Mapping

**What:** This project uses Tailwind CSS 4 (config-free). There is no `tailwind.config.ts`. All tokens live in `src/app/globals.css` as CSS custom properties. MASTER.md recommendations must map to these existing variable names.

**When to use:** During DSYS-03 validation — compare MASTER.md recommended values against existing CSS custom property values.

**Existing token inventory from `src/app/globals.css`:**

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
--shadow-xs, --shadow-card, --shadow-card-hover, --shadow-elevated, --shadow-modal

/* Radii */
--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
```

MASTER.md token validation must reference these exact property names. Token migration (changing values) is deferred to the implementation milestone — this phase only validates that MASTER.md output covers all 20 properties.

### Anti-Patterns to Avoid

- **Regenerating MASTER.md mid-audit**: Page-specific design files (`pages/*.md`) are relative to the MASTER.md at generation time. Regenerating MASTER.md invalidates all page files. Generate once with all constraints stated upfront, then lock it.
- **Auditing before the skill is installed**: Without `.claude/skills/ui-ux-pro-max/SKILL.md`, Claude falls back to generic design opinions. Findings will be inconsistent and miss 3PL-specific patterns.
- **Generating MASTER.md without both brand anchors**: Omitting one brand collapses the dual-brand architecture. The tool will normalize to a single palette.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Design system reasoning | Custom markdown spec written manually | `uipro-cli` + `--design-system --persist` | The tool ships 161 industry rules including logistics/warehouse; manual spec misses domain coverage |
| 3PL color palette selection | Choose colors from Tailwind palette manually | Let MASTER.md generation suggest palette anchored to existing brand | Color theory for dense operational interfaces requires specialized knowledge — the tool has it |
| Font pairing decision | Pick Google Fonts by feel | Use `typography.csv` (57 pairings, filtered to logistics context) via the skill | Typography for data-dense WMS requires specific readability properties at small sizes |
| Scanner route documentation | Skip it and rely on memory | Write `SCANNER-ROUTES.md` explicitly before any audit runs | Pre-classification is the only defense against consumer UX standards being applied to industrial interfaces |
| Token validation | Visually compare MASTER.md and globals.css | Structured mapping table in DSYS-03 task | Token names must match exactly for the implementation milestone to execute correctly |

**Key insight:** The skill exists precisely because design system decisions for operational software are domain-specific and error-prone when made without industry data. Don't bypass it.

---

## Common Pitfalls

### Pitfall 1: Version Discrepancy at Install Time

**What goes wrong:** npm references show both v2.5.0 and v2.2.2 for uipro-cli. Installing without checking the actual version means `--design-system --persist` flags may not exist (introduced in v2.0; verify availability).

**Why it happens:** The npm registry shows the latest tag; other sources may reference an earlier tested version.

**How to avoid:** Immediately after install, run `uipro versions` to confirm the active version. If neither `--design-system` nor `--persist` appear in `uipro --help`, the version is too old.

**Warning signs:** `search.py: error: unrecognized arguments: --design-system` during generation.

### Pitfall 2: Dual-Brand Collapse

**What goes wrong:** MASTER.md is generated with a single product identity, producing one color palette. Admin indigo and portal cyan get normalized into a unified accent color. Visual context distinction between portals is lost.

**Why it happens:** The tool optimizes for consistency across the codebase by default. Multi-brand architecture is a constraint it cannot infer.

**How to avoid:** State both brand anchors explicitly in the generation prompt. Verify MASTER.md contains two separate token sections (admin + portal) before accepting the output.

**Warning signs:** MASTER.md has only one `primary` color with no mention of portal/cyan variant.

### Pitfall 3: Consumer UX Applied to Operational Interfaces

**What goes wrong:** MASTER.md recommends marketing-site density standards (larger spacing, softer colors, illustration-based empty states). Applied to a WMS used for 50+ transactions/day, this slows expert users.

**Why it happens:** Most audit tool training data skews toward consumer web and SaaS marketing. Without persona context, it optimizes for first-impression aesthetics.

**How to avoid:** Embed user persona in the generation prompt (see Pattern 2 above). For scanner pages specifically, the `SCANNER-ROUTES.md` document created in SETUP-04 must be referenced in every audit prompt touching those routes.

**Warning signs:** MASTER.md recommends reducing information density on list pages, or adding onboarding animations.

### Pitfall 4: Dashboard Grid Dimensions Not Captured Before Audit

**What goes wrong:** Audit recommends typography/padding increases for StatCard and widget Card. These changes break saved user dashboard layouts because widgets overflow their allocated column space.

**Why it happens:** The dashboard uses CSS columns layout (`lg:columns-2`) with `half` and `full` size variants — widget dimensions are content-driven, not fixed-px constrained. Without documenting actual rendered widths at each breakpoint, the planner has no constraints to give the auditor.

**How to avoid:** SETUP-04 must include a step to read `DynamicWidgetGrid.tsx` and document the actual column behavior: `lg:columns-2 gap-6`, break-inside-avoid, `[column-span:all]` for full-size. No explicit minimum pixel dimensions exist — the constraint is "must be readable at ~50% viewport width on desktop." This should be recorded in `SCANNER-ROUTES.md` or a companion `DASHBOARD-CONSTRAINTS.md` file.

**Warning signs:** Audit recommends +8px padding inside StatCard without flagging grid impact.

### Pitfall 5: Offline Install Silently Uses Stale Bundled Assets

**What goes wrong:** `uipro init --ai claude --offline` succeeds but installs from bundled assets that may be one release behind. The installed `ui-reasoning.csv` may lack the most recent logistics/warehouse rules.

**Why it happens:** The offline flag is a fallback for rate-limited environments, not a recommended default.

**How to avoid:** Prefer online install. Only use `--offline` if the GitHub API is actively rate-limiting. If offline is used, note the version difference and verify logistics-related rules still appear in `data/ui-reasoning.csv`.

---

## Code Examples

### Verify Skill Installation

```bash
# Source: https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/1.1-getting-started
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style -n 3
```

Expected output: 3 style results with match scores. If this fails, the skill is not installed correctly.

### Generate MASTER.md with Full Constraint Set

```bash
# Source: https://ui-ux-pro-max-skill.com/en/docs/cli-reference/
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "3PL warehouse management logistics" \
  --design-system --persist -p "ims7d" --stack nextjs
```

This writes `design-system/ims7d/MASTER.md`. The Claude-driven generation (natural language prompt) is preferred over CLI-direct for the dual-brand constraint injection. Use the CLI as a smoke test; use Claude with the structured prompt (Pattern 2 above) for actual generation.

### DSYS-03 Token Validation Pattern

```markdown
# DSYS-03: Token Validation Checklist

For each CSS custom property in globals.css, verify MASTER.md covers it:

| CSS Custom Property | Current Value | MASTER.md Recommendation | Gap? |
|--------------------|---------------|--------------------------|------|
| --color-primary    | #4F46E5       | [from MASTER.md]         | Y/N  |
| --color-portal     | #0891B2       | [from MASTER.md]         | Y/N  |
| --color-success    | #16a34a       | [from MASTER.md]         | Y/N  |
| --shadow-card      | 0 1px 3px ... | [from MASTER.md]         | Y/N  |
| --radius-md        | 0.5rem        | [from MASTER.md]         | Y/N  |
[... all 20 properties]
```

Validation is read-only. No changes to globals.css in this phase.

---

## Pre-Audit Constraint Documents (SETUP-04 Deliverables)

Phase 1 must produce two constraint documents before Phase 2 begins:

### 1. Scanner Route Inventory

Create `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` containing:

```markdown
# Scanner-Facing Routes

Routes applying the warehouse floor rubric (not standard SaaS audit rules).

**Rubric:** 44px+ tap targets (prefer 56px), 16px+ body text, max 3 primary actions/screen,
high contrast (WCAG AA minimum, AAA preferred), glove-friendly (no precision gestures),
readable in variable warehouse lighting (high lux and dark environments).

**Devices:** Tablets (10-12") and phones (5-6") — both must pass.

## Routes

| Route Pattern | Description | Scanner Component |
|--------------|-------------|-------------------|
| /tasks/pick | Picking workflow | PickingScanner.tsx, PickScanner.tsx |
| /tasks/putaway | Putaway workflow | PutawayScanner.tsx |
| /tasks/inspection | Inspection workflow | InspectionScanner.tsx |
| /tasks/[id] | Task detail/execution | (task page) |
| /cycle-counts/[id] | Active cycle count | (cycle count page) |
| /inventory/pallet-breakdown | Pallet breakdown scanning | PalletBreakdownScanner.tsx |
| /inbound/[id] | Receiving workflow | ReceivingScanner.tsx |
| /outbound/[id] | Packing/shipping workflow | PackScanner.tsx, ShipScanner.tsx |
| /returns/[id] | Returns processing | (returns page) |
| /damage-reports/[id] | Damage documentation | (damage page) |
| /locations/[id]/sublocations | Sublocation navigation | (locations page) |
| /inventory/transfers | Stock transfers | (transfers page) |

## Shared Scanner Component
- `src/components/ui/BarcodeScanner.tsx` — shared across all routes above
- `src/components/internal/ScannerModal.tsx` — modal wrapper for scanner
```

### 2. Dashboard Grid Constraints

Record in the same file or a companion doc:

```markdown
# Dashboard Widget Grid Constraints

**Grid implementation:** CSS columns layout (`lg:columns-2 gap-6`) in DynamicWidgetGrid.tsx
**NOT a fixed-px grid** — widget dimensions are content-driven.

## Size Variants

| Widget Size | CSS Behavior | Effective Width |
|-------------|-------------|----------------|
| "half" | Normal column flow (one of two columns) | ~50% viewport - 1.5rem gap - sidebar width |
| "full" | `[column-span: all]` — spans both columns | ~100% content area width |

## Minimum Width Constraint (approximate)
- At lg breakpoint (1024px): sidebar 264px, two columns = ~(1024 - 264 - 24px gap) / 2 = ~368px per half widget
- At sidebar-collapsed (72px): ~(1024 - 72 - 24) / 2 = ~464px per half widget
- Mobile (below lg): single column, full width

## Rule for Audit
Any typography/padding recommendation that makes a "half" widget unreadable at ~360px wide
must be rejected or qualified with a grid-impact note.

## StatCard dimensions
- Uses fixed icon (w-6 h-6), p-6 padding, text-2xl value, text-sm label
- Appears in a static 4-column grid above the widget area: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- At lg with sidebar: each StatCard is ~(1024 - 264 - 48) / 4 = ~178px wide (very constrained)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.ts` for design tokens | CSS custom properties in `globals.css` + `@import "tailwindcss"` | Tailwind CSS v4 (2024) | No config file exists in this project — all token work targets globals.css only |
| Manual design system creation | AI-assisted via `uipro-cli` + domain CSVs | v2.0+ of UI/UX Max Pro | Tool provides 161 industry rules; eliminates manual research for domain-specific standards |
| Generic UX audit tools | Industry-specific BM25 reasoning (logistics/warehouse rules) | UI/UX Max Pro launch | Logistics/warehouse patterns are explicitly covered in `ui-reasoning.csv` |

**Deprecated/outdated:**
- `tailwind.config.js/ts`: Does not exist in this project. References to it in documentation are wrong for this codebase. All token integration targets `src/app/globals.css`.

---

## Open Questions

1. **uipro-cli version at install time**
   - What we know: npm registry references both v2.5.0 and v2.2.2; both versions are above v2.0 (when `--design-system --persist` was introduced)
   - What's unclear: Which is the actual latest stable version today
   - Recommendation: Run `uipro versions` immediately after `npm install -g uipro-cli` and record the version before proceeding

2. **MASTER.md dual-brand output format**
   - What we know: The generation prompt can specify dual-brand constraints; the tool will honor them if stated explicitly
   - What's unclear: Whether the tool's `--design-system` flag natively structures output into two brand sections, or whether Claude must request that structure via natural language
   - Recommendation: Use the natural language generation path (not bare CLI) with explicit "generate separate token tables for admin and portal" in the prompt. Verify MASTER.md contains two distinct token sections before locking it.

3. **Exact rendered pixel widths for dashboard grid**
   - What we know: CSS columns layout with `lg:columns-2 gap-6`; sidebar 264px collapsed to 72px; StatCard in separate `lg:grid-cols-4`
   - What's unclear: Actual rendered widths vary with sidebar state and viewport — no hardcoded pixel constraints exist in the implementation
   - Recommendation: Record the approximate ranges (calculated above) in DASHBOARD-CONSTRAINTS.md; use "readable at ~360px minimum width" as the working constraint

---

## Validation Architecture

> `workflow.nyquist_validation` not set to false in `.planning/config.json` — validation section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — this phase produces only markdown artifacts and a skill installation; no code is written |
| Config file | N/A |
| Quick run command | `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "warehouse management" --domain ux -n 3` |
| Full suite command | Verify all 5 deliverables exist (see Phase Gate below) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SETUP-01 | Skill installed and Claude can activate it | smoke | `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style -n 3` | Pass = exit 0 with results |
| SETUP-02 | Dual-brand constraints documented before audit | manual | Inspect MASTER.md for separate admin and portal token sections | ✅ observable in file content |
| SETUP-03 | Python availability and skill connection | smoke | `python3 --version && python3 .claude/skills/ui-ux-pro-max/scripts/search.py "logistics" -n 1` | Pass = both commands succeed |
| SETUP-04 | Scanner routes + dashboard constraints documented | manual | `ls .planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` | ❌ Wave 0 — file created in this phase |
| DSYS-01 | MASTER.md exists with 3PL-specific content | manual | `ls design-system/ims7d/MASTER.md` and inspect for warehouse/logistics sections | ❌ Wave 0 — generated in this phase |
| DSYS-02 | MASTER.md has separate admin + portal sections | manual | Inspect MASTER.md for dual-brand token tables | ❌ Wave 0 — depends on DSYS-01 |
| DSYS-03 | All 20 globals.css properties covered in MASTER.md | manual | Token validation checklist (see Code Examples) | ❌ Wave 0 — depends on DSYS-01 |

### Sampling Rate

- **Per task commit:** `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "3PL warehouse" --domain ux -n 3` (confirms skill is live)
- **Per wave merge:** Verify all deliverables exist and are non-empty
- **Phase gate:** All 5 deliverables present before `/gsd:verify-work`:
  1. `.claude/skills/ui-ux-pro-max/SKILL.md` exists
  2. `design-system/ims7d/MASTER.md` exists with dual-brand sections
  3. SCANNER-ROUTES.md exists with all 12 routes tagged
  4. Dashboard constraints recorded
  5. Token validation table in DSYS-03 output shows 0 uncovered gaps

### Wave 0 Gaps

- [ ] `design-system/ims7d/MASTER.md` — generated in DSYS-01 task
- [ ] `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md` — created in SETUP-04 task
- [ ] `.claude/skills/ui-ux-pro-max/` directory — installed in SETUP-01 task

---

## Sources

### Primary (HIGH confidence)

- [uipro-cli on npm](https://www.npmjs.com/package/uipro-cli) — version history, install command
- [GitHub: nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — source structure, feature capabilities, file layout
- [GitHub Releases: ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/releases) — design system generator availability per version (v2.0+)
- Codebase direct inspection: `src/app/globals.css` — 20 existing CSS custom property names and values
- Codebase direct inspection: `src/components/dashboard/DynamicWidgetGrid.tsx` — grid implementation (`lg:columns-2 gap-6`, `[column-span:all]`)
- Codebase direct inspection: `src/lib/dashboard/types.ts`, `admin-widgets.ts` — widget size variants (`half`/`full`)
- `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md` — project-level research from same date

### Secondary (MEDIUM confidence)

- [DeepWiki: Getting Started](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/1.1-getting-started) — installation steps, Python requirements
- [DeepWiki: Skill Architecture](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/3-uiux-pro-max-skill) — Python stdlib-only BM25 confirmation
- [Official CLI Reference](https://ui-ux-pro-max-skill.com/en/docs/cli-reference/) — all CLI flags, `--design-system --persist -p` flag documentation

### Tertiary (LOW confidence)

- Version discrepancy (v2.5.0 vs v2.2.2) — requires runtime verification with `uipro versions`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all claims verified against npm registry, GitHub source, and direct Python/Node version checks
- Architecture: HIGH — file layout verified from GitHub; CSS custom property mapping from direct globals.css read; grid layout from direct DynamicWidgetGrid.tsx read
- Pitfalls: HIGH — carried forward from project-level PITFALLS.md (researched same day, multiple sources)
- Scanner route inventory: HIGH — explicit list provided in CONTEXT.md by user

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable tool, 30-day window; re-verify uipro-cli version at install time regardless)
