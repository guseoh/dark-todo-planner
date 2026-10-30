# Dark Todo Planner — content-first UI design system

This document is the **single source of truth** for all app UI. Hallmark is a review checklist, not an imported theme. This is a dense personal workspace, not a SaaS landing page. See [V2 implementation baseline](docs/ui-v2-baseline.md).

## Design principles
- Content before containers. Avoid nested cards, decorative outlines, shadows and redundant badges. Use typography, alignment, whitespace and hairline dividers.
- Flat lists for Todo and memo rows; keep functional boundaries for inputs, calendar cells, modal dialogs and popovers.
- Neutral grayscale only for chrome in both themes. Semantic success/warning/danger and **user-authored** memo, category and project colors are exceptions. Do not repurpose sage or charcoal as a branding accent.
- Page titles 22–24px, section titles 14–16px, body 14px+, reading surfaces 15px, secondary metadata 12–13px.
- Minimum 36px desktop controls, 44px on mobile navigation. Preserve a visible :focus-visible outline and a non-color state indicator.
- No gradients, translucent glass panels or decorative animation. Honor reduced motion.
- A single functional primary button per local decision context. Secondary actions should be quiet.
- New UI must use semantic tokens; legacy `ink`/`accent` Tailwind shade APIs are compatibility layers only.

## Themes and source of truth
- Default: **Dark**, preserving the existing appearance for current users.
- Options: Dark, Light, System (responds to `prefers-color-scheme`). User preference is stored in `localStorage` only and does not alter D1 data.
- CSS tokens: `src/styles/globals.css`. Tailwind variable bindings: `tailwind.config.ts`. Resolver: `src/lib/theme.ts`. Contrast/preferences tests: `src/lib/theme.test.ts`.
- `data-theme` on `<html>` is the **resolved** theme; `data-theme-preference` stores the selected option.
- Default CSS is dark; light variables apply under `:root[data-theme="light"]`. The client sets the resolved theme before rendering React. Preserve the CSP.
- Semantic roles: `--ui-canvas`, `--ui-navigation`, `--ui-surface`, `--ui-inset`, `--ui-hover`, `--ui-selected`, `--ui-elevated`, `--ui-divider`, `--ui-control-border`, `--ui-text-primary`, `--ui-text-secondary`, `--ui-text-muted`, `--ui-focus`, `--ui-action-bg`, `--ui-action-text`.
- Use `ui.*` Tailwind keys (for example `bg-ui-canvas text-ui-text`) for new work. Historical classes such as `bg-ink-950/95` follow RGB CSS variables and retain opacity support during incremental migration.

| Role | Dark | Light |
| --- | --- | --- |
| Canvas | #101011 | #F7F7F8 |
| Navigation | #121213 | #F3F3F4 |
| Surface | #161617 | #FFFFFF |
| Inset | #1B1B1D | #FFFFFF |
| Hover | #28282B | #E9E9EC |
| Selected | #303033 | #E5E5E8 |
| Divider | #323236 | #DADADD |
| Control border | #77777D | #8A8A90 |
| Primary text | #EFEFF0 | #1B1B1E |
| Secondary text | #BCBCC1 | #505056 |
| Muted text | #99999F | #66666C |
| Primary action | #D4D4D8 | #26262A |
| Action text | #101011 | #F7F7F8 |
| Focus | #D4D4D8 | #26262A |
| Success | #8FB9A3 | #1B6844 |
| Warning | #D9B47D | #805000 |
| Danger | #D88D92 | #A22636 |

## Component contract
1. `.app-card` remains a borderless legacy section; prefer `.work-section`. Do not stack nested cards.
2. `.page-list-item` uses transparent backgrounds and row dividers; selected/hover states may have one neutral overlay.
3. `.page-toolbar` uses no container border; tabs use active typography/underline, not colored chips.
4. `.field` uses inset background, 4px corners and a distinguishable control border.
5. `.btn-primary` is one deliberate CTA; `.btn-secondary` is quiet. Modal and popover surfaces may be elevated.
6. User-selected memo/category/project colors are **data** and must be kept when changing themes.

## Accessibility / release gates
- WCAG AA 4.5:1 for normal text and 3:1 for relevant control boundaries/graphic elements.
- Selection, errors, disabled states and saved/saving status must not depend on color alone.
- Keyboard focus, dialogs, task interactions and mobile navigation remain usable at 320, 390, 768 and 1280px.
- Compare browser screenshots of Today, Calendar, Projects, All Todo, Memo, Scratchpad and Settings in **both** themes; test System preference changes separately.
- Run typecheck, tests, build, isolated Worker/D1 browser smoke before merge.
- Do not change routes, persisted Todo planning states, database schema, API, backup format or scratchpad editing engine in this design-system phase. Inbox removal and WYSIWYG are separate PRs.
