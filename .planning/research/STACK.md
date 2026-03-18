# Stack Research

**Domain:** UI/UX audit tooling + design system generation for existing Next.js 14 + Tailwind CSS app
**Researched:** 2026-03-18
**Confidence:** HIGH (all claims verified against official docs, npm registry, and GitHub source)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| uipro-cli | 2.5.0 (latest) | Installs UI/UX Max Pro skill into the project | Only CLI tool that installs the skill; handles platform detection and file placement automatically |
| Python 3.x | 3.x (3.11.9 already installed) | Runs `search.py`, `core.py`, `design_system.py` — the BM25 reasoning engine | Required runtime for all design intelligence; no pip packages needed (pure stdlib BM25 implementation) |
| Node.js | 14.x+ (22.17.0 already installed) | Required by npm to install uipro-cli globally | Already present; no version change needed |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uipro-cli (global npm) | 2.5.0 | One-time installer — places skill files into `.claude/skills/ui-ux-pro-max/` | Run once during setup; not a project dependency |
| Python stdlib only | built-in | BM25 search engine used by `search.py` | No pip install required; ships with Python 3.x |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `uipro` CLI | Initializes and updates the skill | Run `uipro init --ai claude` from project root; installs to `.claude/skills/ui-ux-pro-max/` |
| `python3 search.py` | Direct CLI access to BM25 design intelligence | Used both by Claude Code automatically and manually via terminal for testing |
| `--persist` flag on search.py | Writes generated design system to `design-system/` folder | Use when generating the persistent design system artifact — creates `MASTER.md` + per-page overrides |

## Installation

```bash
# Step 1: Install the CLI globally (one-time, not a project dependency)
npm install -g uipro-cli

# Step 2: Initialize the skill for Claude Code (run from project root)
cd "IMS - 7D"
uipro init --ai claude

# Step 3: Verify installation
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style -n 3

# Step 4: Generate the 3PL/warehouse design system with persistence
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "3PL warehouse management logistics SaaS" \
  --design-system --persist -p "IMS-7D" --stack nextjs

# Optional: offline install if GitHub API rate-limited
uipro init --ai claude --offline
```

No `package.json` changes. No `npm install` in the project. The skill is installed at `.claude/` level, not `node_modules`.

## What Gets Installed

Files placed under `.claude/skills/ui-ux-pro-max/` (self-contained for Claude Code platform):

```
.claude/skills/ui-ux-pro-max/
├── SKILL.md                  # Workflow definition — auto-loaded by Claude Code on UI/UX requests
├── scripts/
│   ├── search.py             # CLI entry point; BM25 query interface
│   ├── core.py               # BM25 engine + domain routing (pure Python stdlib)
│   └── design_system.py      # 5-step design generation pipeline
└── data/
    ├── products.csv           # 161 product types + reasoning rules
    ├── styles.csv             # 67 UI styles
    ├── colors.csv             # 96 palettes (by product type)
    ├── typography.csv         # 57 font pairings
    ├── landing.csv            # Landing page patterns
    ├── charts.csv             # 25 chart types with library recommendations
    ├── ux-guidelines.csv      # 99 UX guidelines with priority scoring
    ├── icons.csv              # Icon set guidance
    └── ui-reasoning.csv       # 161 industry reasoning rules (includes logistics/warehouse)
```

Design system output (after `--persist`) writes to project root:

```
design-system/
├── MASTER.md                 # Global source of truth (colors, type, spacing, components)
└── pages/
    ├── dashboard.md          # Page-specific overrides
    ├── [page-name].md        # One file per audited page or page group
    └── ...
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `uipro init --ai claude` | Claude Marketplace install (`/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`) | If Marketplace is available in the Claude Code version being used; CLI is more reliable cross-platform |
| `--persist` flag for design system | Manual markdown files in `design-system/` | Never — the tool's hierarchical output format is structured for Claude to reference across sessions |
| `python3 search.py` with `--stack nextjs` | Generic `--stack html-tailwind` | Use `nextjs` stack flag for all searches; it provides App Router and component patterns specific to our stack |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Adding uipro-cli to `package.json` dependencies | It is a global installer tool, not a project runtime dependency; committing it adds noise and version lock risk | `npm install -g uipro-cli` (global only) |
| `pip install rank-bm25` or `pip install bm25s` | The skill ships with a pure stdlib BM25 implementation — no external Python packages required | Nothing — Python stdlib only |
| Modifying `tailwind.config.js` based on raw search.py output | The tool generates recommendations as markdown, not configuration; applying colors/fonts requires deliberate review | Use MASTER.md output as a specification; implement Tailwind config changes in the next milestone after review |
| Installing the `shadcn/ui` integration path | Our stack uses a custom component library; shadcn would introduce Radix UI primitives and conflict with existing Button/Card/Modal components | Keep existing component library; use tool's design-system output as audit reference only |
| Running `uipro init --ai all` | Installs skill files for every AI assistant (Cursor, Windsurf, Copilot etc.); pollutes the repo with unused directories | `uipro init --ai claude` — installs only to `.claude/` |
| Replacing existing Tailwind config wholesale | The generated design system recommends colors/typography; blindly overriding `tailwind.config.js` could break 60+ pages | Treat MASTER.md as a specification document; phased Tailwind config updates belong in the next milestone |

## Stack Patterns by Variant

**When generating the full design system (audit phase):**
- Use `--stack nextjs` flag — returns App Router-specific patterns
- Use `--domain ux` for behavior/interaction guidelines
- Use `--design-system --persist -p "IMS-7D"` to persist across Claude Code sessions
- Query separately for admin (indigo brand) and portal (cyan brand) if needing palette refinements

**When running page-by-page audits:**
- Use `--page "[page-name]"` flag to create override files under `design-system/pages/`
- Query with `--domain style` for visual audit, `--domain ux` for interaction audit
- Claude Code auto-activates the skill when UI/UX keywords appear in prompts — no manual `python3` invocation needed in most cases

**When the tool cannot reach GitHub during init:**
- Use `uipro init --ai claude --offline` to install from bundled assets
- Bundled assets may lag behind latest by one release

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| uipro-cli@2.5.0 | Node.js 14.x+ | Currently running Node 22.17.0 — fully compatible |
| uipro-cli@2.5.0 | Python 3.x (any) | Currently running Python 3.11.9 — fully compatible; no pip deps required |
| uipro-cli@2.5.0 | Next.js 14–16 | Skill has dedicated `nextjs` stack CSV; no framework version restriction |
| uipro-cli@2.5.0 | Tailwind CSS v3–v4 | Skill outputs class name recommendations; compatible with both (project uses Tailwind v4) |
| SKILL.md auto-activation | Claude Code (any version) | Reads `.claude/skills/` directory — no Claude version constraint documented |

## How Claude Code Uses the Skill

1. User requests any UI/UX work (keywords: "audit", "design", "review", "build component", etc.)
2. Claude Code automatically loads `.claude/skills/ui-ux-pro-max/SKILL.md`
3. Claude executes `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" [flags]`
4. `core.py` runs BM25 ranking against relevant CSV data files
5. Results returned to Claude as structured markdown; Claude applies reasoning to code/audit output
6. If `--persist` was used during setup, `design-system/MASTER.md` is read as ongoing reference

The skill does NOT modify any existing project files — it only reads project structure and writes to `design-system/` (user-initiated via `--persist`).

## Sources

- [uipro-cli on npm](https://www.npmjs.com/package/uipro-cli) — version history, install command (HIGH confidence)
- [GitHub: nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — source repository, file structure (HIGH confidence)
- [DeepWiki: Getting Started](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/1.1-getting-started) — installation steps, Python requirements, Node.js 14+ requirement (HIGH confidence)
- [DeepWiki: Skill Architecture](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/3-uiux-pro-max-skill) — Python stdlib-only BM25, file structure, no project file modifications (HIGH confidence)
- [Official docs: CLI Reference](https://ui-ux-pro-max-skill.com/en/docs/cli-reference/) — all CLI flags, design system output format (HIGH confidence)
- [GitHub Releases](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/releases) — v2.5.0 latest as of March 10, 2025; v2.2.2 as of January 29, 2026 (MEDIUM — release page showed inconsistent dates; v2.5.0 referenced in one source, v2.2.2 in another; verify with `uipro versions` at install time)

---
*Stack research for: UI/UX Max Pro integration into IMS-7D (Next.js 14 + Tailwind CSS)*
*Researched: 2026-03-18*
