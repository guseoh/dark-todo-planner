# UI V2 — G0 baseline and scope

Baseline: main commit `06f7bf017f3be8f60dbc7daab07d865d1e63b941` (2026-10-30). The existing `.github/workflows/ci.yml` runs typecheck, Vitest, build, npm audit, isolated Worker/D1 and Chromium browser smoke. This document is source-based inventory; baseline browser screenshots must be recorded by CI, not asserted without a run.

## Current architecture
- App root: `src/main.tsx`, `src/App.tsx`; navigation: `src/components/layout/{Header,Sidebar}.tsx`.
- Screens: Today, Inbox, Calendar (month/week), Projects, All Todo, Memo, Scratchpad, Trash, Settings; planning/insight modules appear inside existing views.
- Common presentation: `src/styles/globals.css`, `tailwind.config.ts`; `.app-card`, `.page-toolbar`, `.page-list-item`, `.field`, `.btn*`, `.page-tabs`.
- Before V2, `design.md` defined a neutral dark workspace but `docs/design-system.md` still described the older charcoal/sage colors; `src/lib/theme.test.ts` assumed immutable dark hex values.
- The current source stores Todo state in D1, supports an Inbox `INBOX` planning state and the Scratchpad `textarea` editor. Neither persistence behavior is part of G0/G1.

## Component inventory and follow-up decisions
| Area | G1 (design system) | Next stage |
| --- | --- | --- |
| Global styles and Tailwind | Semantic CSS variables, dual theme and legacy class compatibility | G2 migrate remaining legacy classes by semantics |
| Settings | Theme choice under overview; local-only preference | G2 simplify other settings layout |
| Header and navigation | Existing `ink` shades automatically theme-aware | G2 content-first navigation polish |
| Today / All Todo | Keep existing workflow and list semantics | G2 tighten hierarchy and task density |
| Calendar / Week | Preserve grid and functionality | G2 refine selection, deadlines and responsive states |
| Projects / Planning | Preserve kanban/drag interactions | G2 tailor structure to workflow |
| Memo | Preserve markdown, links and persisted authored colors | G2 tune memo row typography, search and details |
| Scratchpad | Preserve `textarea`, recovery, undo and server sync | G2 layout; G4 separate editor replacement |
| Inbox | Preserve route, parser and persisted `INBOX` | G3 remove UI with data-preserving compatibility |
| Dialogs / settings / trash | Use theme-aware legacy colors | G2 review surfaces and edge states |

## Acceptance / evidence
- Theme defaults to Dark when no local preference is stored; switching to Light or System changes the complete app without modifying D1.
- Existing `ink-*` and `accent-*` classes honor opacity and theme choices. New components use `ui` semantic names.
- Error/success/warning states stay meaningful; user-assigned colors are not overwritten.
- The PR CI run is the source of evidence for automated browser testing; do not claim manual visual QA is complete before review.
- G3 and G4 are intentionally excluded to isolate data migrations/editor change risk.
