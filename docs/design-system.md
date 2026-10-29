# Minimal Charcoal Dark — design decisions

This is the single visual baseline for the Dark Todo Planner UI, established in phase 1. Calendar integration and screen-level polish follow in later phases.

## Design intentions

- Background and card surfaces are warm-neutral charcoal rather than blue/navy.
- Accent is muted sage and is reserved for active navigation, primary actions, selection and focus. Success, warning and danger remain semantic colors.
- User-assigned category/project colors are data and must not be overwritten when changing the application theme.
- Components distinguish hierarchy with subtle surface differences and spacing rather than large shadows or saturated borders.
- Preserve readable small text, visible keyboard focus, and reduced-motion preferences. Avoid reducing all 11px metadata without checking importance and density.
- Main CTA buttons use charcoal text on a light sage background; white text on that sage fails contrast.
- Keep existing URLs, mobile navigation and functionality unchanged in phase 1.

## Source of truth

- `tailwind.config.ts`: `ink`, `accent` and semantic color scales
- `src/styles/globals.css`: matching CSS custom properties and global components
- `src/lib/theme.test.ts`: token synchronization and key WCAG contrast contracts

| Role | Color |
| --- | --- |
| Application background | `#111315` |
| Sidebar | `#15171a` |
| Surface 1 | `#191b1f` |
| Surface 2 | `#212428` |
| Surface hover | `#34393e` |
| Border | `#41464b` |
| Primary text | `#e8e9ec` |
| Muted text | `#aab0b6` |
| Sage accent | `#a7baab` |

## QA expectations

Run `npm run typecheck`, `npm test`, `npm run build`, and browser smoke tests for Today, Inbox, Calendar/Week, Project, Memo, Scratchpad, Auth and Settings. Verify 320px, 390px, 768px, 1280px and wider screens. Accessibility checks should cover contrast and keyboard focus. No D1 schema migration is expected from phase 1.

## Follow-up

Phase 2 introduces one Calendar navigation entry (month/week toggle). Phase 3 introduces event titles, deadline markers and an optional side panel. Do not mix those behavioral changes into the theme-only phase.
