# Design system — Minimal dark workspace

This is the product's locked UI direction. Treat Hallmark's quality gates as review criteria, not as a preset theme. The planner is a dense personal workspace, **not a SaaS landing page**.

## Direction

- **Neutral, not charcoal/sage:** no green-tinted neutral surfaces and no thematic accent. Use black, graphite and neutral grays. Color is permitted for semantic states only (critical, warning, success) and user-authored colors on existing data.
- **Content before containers:** page structure is carried by headings, whitespace, alignment and hairline dividers. No dashboard of nested rounded boxes. Avoid cards inside cards.
- **One canvas:** main area and side navigation read as a single workspace. Toolbars, task lists, summaries and settings are sections, not tiles.
- **One functional boundary at a time:** keep a clear border on input controls, dialogs, dropdowns and calendar cells where it communicates interaction. Do not outline every heading, card or badge.
- **Type hierarchy:** page title 22–24px, section title 14–16px, body 14px+, supporting text 12–13px. Strong text only for actions and important titles. Avoid repeated explanatory paragraphs, bright borders or pill-shaped metadata.
- **Functional hover and focus:** no decorative motion, glowing shadows, glass, or gradients. Keyboard focus rings must be visible; touch targets >= 36px (44px on mobile navigation).
- **Responsive:** preserve 320px, 390px, 768px and 1280px layouts. Avoid sideways page scrolling. Controls can wrap, contextual metadata can simplify. The calendar's day cells are a genuine grid, not faux cards.
- **State preservation:** changing colors/layout must not change routes, DOM semantics, keyboard shortcuts, Todo operations, D1 data, API, exports, or editor state.

## Tokens

| Role | Value | Usage |
| --- | --- | --- |
| Canvas | `#101011` | App background |
| Navigation | `#121213` | Subtle navigation separation |
| Inset | `#1b1b1d` | Inputs, editable areas, selected rows |
| Hover | `#28282b` | Intentional hover feedback |
| Hairline | `#323236` | One section boundary, list separators |
| Strong divider | `#454549` | Forms and active state |
| Primary text | `#efeff0` | Titles and active content |
| Secondary text | `#bcbcc1` | Supporting content |
| Muted text | `#99999f` | Metadata, hints |
| Neutral interaction | `#d4d4d8` | Single primary action; focus affordance |
| Danger/warning/success | reserved semantic tokens | Never broad surface colors |

## Component contract

- `.app-card` is a *legacy structural wrapper*, now a borderless section with a bottom hairline. Prefer `.work-section` for new work.
- `.page-list-item` and Todo rows are compact, flat list entries split by a single hairline.
- `.page-toolbar` is a toolbar row, no container border; tabs are text with a small active underline or quiet neutral state.
- Inputs have a discernible inset surface and restrained 4px radius. Primary action is light neutral on dark.
- Use `.page-header` for title + one line of context + actions; metadata is plain text, not a framed pill.
- Modals/popovers are exceptions: a contained elevated surface is required to separate layers.

## UI review gates

1. Can any nested border or card be removed without losing function? Remove it.
2. Is the visual hierarchy apparent with colors disabled? Title / section / body / metadata should still read correctly.
3. Are selected/disabled/loading/error/success states understandable without color alone?
4. Does keyboard navigation show visible focus and preserve expected actions?
5. Has every interactive workflow survived regression testing on desktop and mobile widths?
6. Compare actual browser screenshots of **Today, Calendar, Projects, All Todo, Memo, Scratchpad, Settings**. Avoid declaring success from CSS-only review.

## Scope boundaries

- This pass is visual-system and presentation work. Do not change the persisted Todo `INBOX` state, remove a route or replace the Scratchpad editor engine as a side effect. Those require separately tested migrations and editing data preservation.
