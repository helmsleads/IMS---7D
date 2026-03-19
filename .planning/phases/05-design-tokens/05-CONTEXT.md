# Phase 5: Design Tokens - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply CSS foundation for the dual-brand design system: add `prefers-reduced-motion` media query block covering all custom keyframe animations in globals.css, and ensure shadow custom properties are defined and available site-wide. This is the prerequisite for all component and page work in Phases 6-9.

</domain>

<decisions>
## Implementation Decisions

### Motion Reduction Strategy
- **Fade only, no transforms** — keep opacity transitions but remove all spatial motion (scale, translate, slide) under `prefers-reduced-motion: reduce`
- Keep stagger delays (50ms-400ms on dashboard widgets) — the sequential timing is not motion, only remove the translateY transform from widget-enter
- Chart animations (chart-grow with scaleY) get reduced to fade-in only (~200ms) — no instant appear, keep visual continuity
- Modal scale-up/down reduced to fade-in/out only — remove the scale(0.95) and translateY(8px) transforms
- Slide-in-from-right (toast) reduced to fade-in only — remove translateX(100%)
- Fade-in-up (page transitions) reduced to fade-in only — remove translateY(8px)

### Shadow Tokens
- Current values are correct and approved — no changes needed to the shadow scale
- Tokens already defined: `--shadow-xs`, `--shadow-card`, `--shadow-card-hover`, `--shadow-elevated`, `--shadow-modal`
- Phase 6 components will consume these tokens; this phase just ensures they exist (they do)

### Claude's Discretion
- Exact fade duration values under reduced-motion (reasonable range: 150-300ms)
- Whether to use a single `@media` block or split into sections near each keyframe
- Any additional utility classes needed for the reduced-motion variants

</decisions>

<specifics>
## Specific Ideas

No specific requirements beyond the action plan — the audit (PRIORITIES.md item B-36) defines the exact scope. The key principle is "fade only, no transforms" for reduced-motion users.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- globals.css already has complete design token system: color tokens (admin indigo, portal cyan, semantic), shadow tokens, radius tokens
- 7 keyframe animations already defined: `slide-in-from-right`, `fade-out`, `modal-fade-in/out`, `modal-scale-up/down`, `fade-in-up`, `widget-enter`, `chart-grow`
- 7 animation utility classes: `.animate-in`, `.slide-in-from-right-full`, `.animate-fade-in-up`, `.animate-modal-*`, `.animate-widget-enter`, `.animate-chart-enter`
- 8 stagger delay classes: `.stagger-1` through `.stagger-8`

### Established Patterns
- Tailwind CSS v4 (`@import "tailwindcss"`) — no tailwind.config.js, uses CSS-first config
- Animations use CSS keyframes with utility classes (not Tailwind's built-in animate-* utilities)
- No existing reduced-motion handling anywhere in the codebase

### Integration Points
- globals.css is the single entry point — all changes are in this one file
- Animation classes are consumed by: Modal.tsx, Toast.tsx, dashboard widgets, chart components, page layouts
- Shadow tokens will be consumed by components in Phase 6 (Card, Modal, DropdownMenu, CommandPalette)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-design-tokens*
*Context gathered: 2026-03-19*
