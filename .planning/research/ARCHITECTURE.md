# Architecture Research

**Domain:** UI/UX Max Pro integration with existing Next.js 16 + Tailwind CSS 4 warehouse management app
**Researched:** 2026-03-18
**Confidence:** MEDIUM — UI/UX Max Pro is a real tool with verified installation mechanics; some token-mapping specifics are underdocumented and inferred from patterns

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EXISTING IMS-7D CODEBASE                       │
├─────────────────────────────────────────────────────────────────────┤
│  src/app/globals.css       src/components/ui/    tailwind.config    │
│  (CSS custom properties)   (Button, Card, etc.)  (implicit v4)      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ reads / audits
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UI/UX MAX PRO SKILL LAYER                        │
│                  .claude/skills/ui-ux-pro-max/                      │
├─────────────────────────────────────────────────────────────────────┤
│  SKILL.md           scripts/              data/                     │
│  (workflow rules)   search.py             styles.csv                │
│                     core.py   (BM25)      colors.csv   (161)        │
│                     design_system.py      typography.csv (57)       │
│                                           ux_guidelines.csv (99)    │
│                                           reasoning_rules.csv (161) │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ generates
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GENERATED DESIGN SYSTEM                          │
│                      design-system/ims7d/                           │
├─────────────────────────────────────────────────────────────────────┤
│  MASTER.md                    pages/                                │
│  (global tokens + rules)      dashboard.md                          │
│                               inbound.md                            │
│                               outbound.md  (page overrides)         │
│                               portal-[page].md                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ informs
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AUDIT OUTPUT                                │
│                  .planning/audit/ (to be created)                   │
├─────────────────────────────────────────────────────────────────────┤
│  admin-pages.md        portal-pages.md        components.md         │
│  (per-page findings)   (per-page findings)    (ui/ audit)           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ distills into
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ACTION PLAN OUTPUT                               │
│             .planning/action-plan/ (to be created)                  │
├─────────────────────────────────────────────────────────────────────┤
│  PRIORITIES.md  (P1/P2/P3 ranked changes)  IMPLEMENTATION.md        │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `.claude/skills/ui-ux-pro-max/` | Self-contained design intelligence skill; activates automatically from natural language | Installed via `uipro init --ai claude` |
| `SKILL.md` | Defines workflow Claude follows when design/UI prompts are detected | Read by Claude Code on activation |
| `scripts/search.py` | BM25 search engine over 10 design domain CSVs | Called during design system generation |
| `scripts/design_system.py` | Synthesizes multi-domain results into structured design system output | Called with `--design-system --persist` flag |
| `design-system/ims7d/MASTER.md` | Global design system source of truth for the project | Generated once, referenced throughout audits |
| `design-system/ims7d/pages/*.md` | Per-page design overrides; page rules win over MASTER when they conflict | Generated page-by-page during audit |
| `src/app/globals.css` | Existing CSS custom property token store; the primary integration target | Modified to align tokens with MASTER.md recommendations |
| `src/components/ui/` | 26 existing UI components; audit targets for consistency against MASTER.md | Read-only during this milestone |

---

## Recommended Project Structure

After UI/UX Max Pro integration, the project gains these new directories:

```
C:/Users/18cla/IMS - 7D/
├── .claude/
│   └── skills/
│       └── ui-ux-pro-max/      # installed by uipro-cli
│           ├── SKILL.md         # Claude workflow rules
│           ├── scripts/
│           │   ├── search.py
│           │   ├── core.py
│           │   └── design_system.py
│           └── data/
│               ├── styles.csv
│               ├── colors.csv
│               ├── typography.csv
│               ├── ux_guidelines.csv
│               └── reasoning_rules.csv  (+ 5 more domain CSVs)
├── design-system/
│   └── ims7d/
│       ├── MASTER.md            # global design system (generated)
│       └── pages/
│           ├── admin-dashboard.md
│           ├── admin-inbound.md
│           ├── admin-outbound.md
│           ├── admin-inventory.md
│           ├── admin-billing.md
│           └── portal-dashboard.md   (etc., one per audited page)
├── .planning/
│   ├── research/                # (this milestone's output)
│   └── audit/                   # (produced during audit phase)
│       ├── admin-pages.md
│       ├── portal-pages.md
│       └── components.md
└── src/
    ├── app/
    │   └── globals.css          # existing tokens — modified in impl milestone
    └── components/
        └── ui/                  # existing components — read-only this milestone
```

### Structure Rationale

- **`.claude/skills/ui-ux-pro-max/`:** Self-contained by design — the CLI duplicates all data into this directory so Claude Code has zero external dependencies during a session.
- **`design-system/ims7d/`:** Project-scoped output folder, not committed inside `.claude/`. Named by project (`ims7d`) to support multi-project Claude workspaces. MASTER.md is the source of truth; page files contain only deviations.
- **`.planning/audit/`:** Not produced by the tool itself — produced by Claude during the audit workflow, using MASTER.md as the evaluation rubric. Keeps audit artifacts with planning docs, not scattered in src/.

---

## Architectural Patterns

### Pattern 1: Master + Page Override Hierarchy

**What:** A two-tier design system where `MASTER.md` holds global rules and `pages/*.md` holds page-specific overrides. When auditing a specific page, both files are loaded and page rules take precedence.

**When to use:** Essential during the audit phase. Every page audit prompt should reference both MASTER.md and the page's own file if it exists.

**Trade-offs:** Clean separation of global vs. contextual rules; requires discipline to not duplicate global rules into page files unnecessarily.

**Example prompt pattern:**
```
Read design-system/ims7d/MASTER.md and design-system/ims7d/pages/admin-dashboard.md.
Audit src/app/(internal)/dashboard/page.tsx against these rules.
Note deviations as findings with severity: critical | moderate | minor.
```

### Pattern 2: Token-to-Custom-Property Mapping

**What:** UI/UX Max Pro generates color, typography, spacing, and shadow recommendations as named values (e.g., `#1E3A5F`, `Inter/Barlow`). These map to the project's existing CSS custom properties in `globals.css` — not to a `tailwind.config.ts` (which does not exist in this project; Tailwind 4 is config-free by default).

**When to use:** During the implementation milestone. During the audit milestone, record the gap between recommended values and current values without modifying files.

**Trade-offs:** Tailwind 4 with `@import "tailwindcss"` consumes CSS custom properties as-is, making `globals.css` the sole token location. No separate config file to maintain.

**Token mapping table (existing vs. will-be-evaluated):**

| Token in globals.css | CSS Var | What MASTER.md will evaluate |
|---------------------|---------|------------------------------|
| `#4F46E5` | `--color-primary` | Is indigo appropriate for 3PL/warehouse admin? |
| `#0891B2` | `--color-portal` | Is cyan appropriate for client portal? |
| `#F8FAFC` | `--color-bg-page` | Does background density feel right for dense data tables? |
| `0 1px 3px rgba(0,0,0,0.04)` | `--shadow-card` | Is shadow elevation consistent with data-density contexts? |
| `0.375rem – 1rem` | `--radius-*` | Are radii appropriate for industrial/warehouse context? |

### Pattern 3: Read-Only Audit Boundary

**What:** During this milestone, the skill and Claude read source files but make zero modifications. Findings are written only to `.planning/audit/` markdown files. The action plan in `.planning/action-plan/` is the only deliverable that points at specific file + line changes.

**When to use:** Enforced for the entire current milestone. Prevents accidental regressions in a 60+ page production app.

**Trade-offs:** Requires self-discipline in prompting — always append "do not modify any files, record findings only" to audit prompts.

---

## Data Flow

### Design System Generation Flow

```
Claude receives: "Generate design system for 3PL warehouse management"
    ↓
SKILL.md activates (keyword: "design system")
    ↓
scripts/design_system.py called with:
  product_type = "warehouse management / 3PL"
  stack = "next.js tailwind"
  flags = --persist -p "ims7d"
    ↓
BM25 searches across 10 domain CSVs
  reasoning_rules.csv → 3PL/logistics-specific rules
  colors.csv → 161 palettes filtered to logistics/industrial
  typography.csv → font pairs for dense data interfaces
    ↓
Synthesis: Pattern + Colors + Typography + Anti-patterns
    ↓
Writes:
  design-system/ims7d/MASTER.md  (global rules)
```

### Page Audit Flow

```
Claude receives: "Audit admin dashboard page"
    ↓
Read: design-system/ims7d/MASTER.md
Read: design-system/ims7d/pages/admin-dashboard.md (if exists)
Read: src/app/(internal)/dashboard/page.tsx
Read: src/components/internal/AppShell.tsx (if layout-specific)
    ↓
Compare page implementation against design system rules
  Check: color usage vs. MASTER palette
  Check: typography scale vs. MASTER type system
  Check: spacing/density vs. warehouse UX guidelines
  Check: component variants vs. 99 UX guidelines
  Check: accessibility (CRITICAL tier from SKILL.md)
    ↓
Write findings to: .planning/audit/admin-pages.md
  Format: [Page] [Finding] [Severity] [Current] [Recommended]
    ↓
Persist page design system if deviations are intentional:
  design-system/ims7d/pages/admin-dashboard.md
```

### Action Plan Compilation Flow

```
All audit files complete (.planning/audit/*.md)
    ↓
Read all findings across admin-pages.md, portal-pages.md, components.md
    ↓
Cluster by: type (color / typography / spacing / component / accessibility)
Score by: impact × frequency × severity
    ↓
Produce .planning/action-plan/PRIORITIES.md
  P1: Systemic issues (affects 10+ pages, Critical severity)
  P2: Moderate issues (affects 3-9 pages, or 1 page Critically)
  P3: Polish items (Minor, isolated)
    ↓
Produce .planning/action-plan/IMPLEMENTATION.md
  Per-priority: file path, specific change, effort estimate
```

---

## Build Order

The dependency chain requires strict sequencing:

```
1. INSTALL
   npm install -g uipro-cli
   uipro init --ai claude
   → Produces: .claude/skills/ui-ux-pro-max/

2. GENERATE DESIGN SYSTEM
   Prompt: "Generate 3PL warehouse design system for IMS-7D"
   (references: package.json, globals.css, PROJECT.md for context)
   → Produces: design-system/ims7d/MASTER.md

3. AUDIT SHARED COMPONENTS
   Audit src/components/ui/* against MASTER.md
   (components are used across all 60+ pages — shared findings apply everywhere)
   → Produces: .planning/audit/components.md

4. AUDIT ADMIN PAGES (~20 pages)
   Page-by-page, grouped by section (dashboard, inbound, outbound, etc.)
   → Produces: .planning/audit/admin-pages.md
              design-system/ims7d/pages/admin-*.md

5. AUDIT PORTAL PAGES (~8 pages)
   (portal uses different brand; compare against MASTER.md + portal variance)
   → Produces: .planning/audit/portal-pages.md
              design-system/ims7d/pages/portal-*.md

6. COMPILE ACTION PLAN
   Synthesize all audit findings into prioritized, implementation-ready plan
   → Produces: .planning/action-plan/PRIORITIES.md
              .planning/action-plan/IMPLEMENTATION.md
```

**Why this order matters:**
- Step 2 must precede all audits — without MASTER.md there is no evaluation rubric.
- Step 3 (components) precedes page audits because component-level findings inform what is systemic vs. page-specific.
- Admin pages before portal pages because admin has more pages and establishes baseline findings; portal audit can reference those baselines.
- Action plan is last because it requires complete audit coverage to produce accurate impact scores.

---

## Integration Points

### Skill-to-Codebase Touchpoints

| Integration | Direction | Mechanism | Notes |
|-------------|-----------|-----------|-------|
| `.claude/skills/ui-ux-pro-max/SKILL.md` → Claude | Read | Automatic on skill detection | No explicit invocation needed; keyword activation |
| `scripts/design_system.py` → `design-system/ims7d/MASTER.md` | Write | `--persist -p "ims7d"` flag | Creates file; subsequent runs can overwrite — run once and preserve |
| MASTER.md → `src/app/globals.css` | Compare (read-only this milestone) | Claude reads both and identifies gaps | Gap list goes to audit output, not the source file |
| MASTER.md → `src/components/ui/*.tsx` | Compare (read-only this milestone) | Claude reads component props/classes and compares to recommended specs | Component audit produces per-component findings |
| MASTER.md → `src/app/(internal)/**/*.tsx` | Compare (read-only this milestone) | Page-by-page audit | 20+ admin pages |
| MASTER.md → `src/app/(portal)/**/*.tsx` | Compare (read-only this milestone) | Page-by-page audit | 8+ portal pages |

### Dual-Brand Constraint

| Brand | Token Root | Primary Color | Skill Configuration |
|-------|-----------|---------------|---------------------|
| Admin (internal) | `--color-primary` | `#4F46E5` (indigo-600) | Tell MASTER.md generation: "admin brand = deep indigo, must remain" |
| Portal (client) | `--color-portal` | `#0891B2` (cyan-600) | Tell MASTER.md generation: "portal brand = cyan/teal, must remain" |

The dual-brand constraint must be stated explicitly when invoking design system generation. The tool will then scope recommendations to work within the existing brand anchors rather than replacing them.

### New Files vs. Modified Files

| File | Status | When |
|------|--------|------|
| `.claude/skills/ui-ux-pro-max/**` | New (all) | Step 1: Install |
| `design-system/ims7d/MASTER.md` | New | Step 2: Generate |
| `design-system/ims7d/pages/*.md` | New | Steps 4-5: Audit |
| `.planning/audit/components.md` | New | Step 3 |
| `.planning/audit/admin-pages.md` | New | Step 4 |
| `.planning/audit/portal-pages.md` | New | Step 5 |
| `.planning/action-plan/PRIORITIES.md` | New | Step 6 |
| `.planning/action-plan/IMPLEMENTATION.md` | New | Step 6 |
| `src/app/globals.css` | **Not modified** (this milestone) | Deferred to implementation milestone |
| `src/components/ui/**` | **Not modified** (this milestone) | Deferred to implementation milestone |

---

## Anti-Patterns

### Anti-Pattern 1: Regenerating MASTER.md Mid-Audit

**What people do:** Re-run design system generation after auditing 10 pages because they want to refine the design system.

**Why it's wrong:** Page-specific design-system files (`pages/*.md`) are written relative to the MASTER.md that existed when they were generated. If MASTER.md changes, page files become inconsistent — some reference old recommendations, some reference new ones. The action plan will contain contradictions.

**Do this instead:** Generate MASTER.md once with all project constraints stated upfront (dual-brand, warehouse/3PL industry, Next.js/Tailwind 4 stack). Lock it before starting any page audits. If adjustments are needed, note them in a `MASTER-NOTES.md` sidecar rather than regenerating.

### Anti-Pattern 2: Auditing Without the Skill Loaded

**What people do:** Prompt Claude to "audit the dashboard against good design practices" without referencing MASTER.md or having the skill active.

**Why it's wrong:** Without the skill's 161 reasoning rules and 99 UX guidelines, Claude falls back to generic design opinions. Findings will be inconsistent across pages, miss 3PL/warehouse-specific patterns, and won't produce a coherent action plan.

**Do this instead:** Every audit prompt must explicitly reference: (1) `design-system/ims7d/MASTER.md`, (2) the relevant page file if it exists, and (3) the specific page file being audited. Always confirm the skill is installed before starting.

### Anti-Pattern 3: Modifying Source Files During the Audit Milestone

**What people do:** Find an obvious issue while auditing (e.g., a wrong color on one button) and fix it immediately rather than logging it.

**Why it's wrong:** Breaks the audit's completeness guarantee. The action plan will miss that issue. If a pattern is found on one page and fixed, it will appear "fixed" on that page but the 15 other pages with the same issue won't get flagged.

**Do this instead:** Log every finding to `.planning/audit/` regardless of how trivial it seems. Save all fixes for the implementation milestone where they can be applied systematically with full pattern awareness.

### Anti-Pattern 4: Treating MASTER.md Tokens as Direct Tailwind Config

**What people do:** Copy color hex values from MASTER.md into a `tailwind.config.ts` file.

**Why it's wrong:** This project uses Tailwind CSS 4, which is config-free. There is no `tailwind.config.ts` in this codebase. Tailwind 4 consumes CSS custom properties defined via `@theme` blocks or standard `:root` variables. The correct integration target is `src/app/globals.css` — the `--color-*`, `--shadow-*`, and `--radius-*` custom properties are already there and already consumed by Tailwind utilities.

**Do this instead:** Map MASTER.md token recommendations to the existing custom property names in `globals.css`. The update is a value swap, not a new config file.

---

## Scaling Considerations

This milestone is audit-only with no user-facing scale concerns. The architecture considerations below apply to the implementation milestone.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current: 60+ pages | Component-level changes propagate everywhere — fix `Button.tsx` and all 60 pages benefit automatically |
| Token changes | Update 10-15 CSS custom properties in `globals.css`; Tailwind regenerates all utilities on next build |
| New pages (future) | Once MASTER.md exists, new pages can be built against it from day one — no audit needed |

---

## Sources

- [GitHub: nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — Official repository, architecture overview, CLAUDE.md
- [DeepWiki: Claude Code Integration](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/6.1-claude-code-integration) — .claude/skills/ directory structure, self-contained install model (MEDIUM confidence — third-party wiki, verified against GitHub structure)
- [DeepWiki: Getting Started](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/1.1-getting-started) — uipro-cli install commands, --persist flag, design-system/ output structure (MEDIUM confidence)
- [Releases: nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/releases) — Feature capabilities per version, design system generator introduced in v2.0 (HIGH confidence — official source)
- [Tailwind CSS 4 @theme tokens](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06) — How Tailwind 4 consumes CSS custom properties as design tokens (MEDIUM confidence)
- Codebase inspection: `src/app/globals.css`, `package.json`, `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx` — Existing token names and values (HIGH confidence — direct source read)

---
*Architecture research for: UI/UX Max Pro integration with IMS-7D Next.js + Tailwind 4 codebase*
*Researched: 2026-03-18*
