# Dark Todo Planner V4 — Neutral Black, action-first workspaces

**Design status:** implementation in PR #146, awaiting CI and visual verification.  
**User direction:** no charcoal/blue-grey background; neutral black with restrained blue interaction emphasis.

## Visual and tokens
- Dark: canvas `#09090B`, navigation `#111113`, surface `#18181B`, divider `#303036`, text `#F2F2F4`, secondary `#B3B3BE`, primary `#79A7F7`.
- Light: canvas `#FAFAFA`, surface `#FFFFFF`, text `#18181B`, primary `#245FBF`.
- Semantic roles: success `#67BE9B`/light `#147553`, warning `#E5B66D`/light `#8D5B20`, danger `#DE858E`/light `#B14050`.
- Do not stack dark tinted cards around Today lists. Only use subtle surfaces for inputs and project cards. Preserve focus indicators and contrast AA >= 4.5:1.

## Today
- Date + completed/total; **QuickCapture first**, then pinned tasks (max 3), category-filterable regular list, completed disclosure.
- Planning candidates/overdue/weekly statistics remain in optional drawer, never the default view.
- Task entity and server-date/due-date identities preserved; no duplication.

## Project
- Wide screens: project switcher rail + task-focused workbench. Narrow screens: project select + same workbench.
- Inline quick-add, 4 existing status lanes, drag status updates, board/list view and WIP limits stay.
- Kanban cards show title and only relevant priority/milestone/subtask/due-date metadata. Inspector edits workflow, category, priority, milestone and adds subtask without reconstructing API or introducing schema changes.
- Project overview and resources belong to the management tab; milestone and decision logs remain independent tabs.

## Calendar
- Month: full 7-column calendar, event chips (execution blue, deadline amber) and independently opened date drawer. Existing drag and fallback date input write the execution date, not the deadline.
- Week: compact range controls + seven-day navigation + selected-day Todo list, weekly goals moved to collapsible section beneath the agenda.
- Existing day-status controls and goal CRUD retained.

## Acceptance gates
- CI: TypeScript, Vitest, audit and bundle; isolated Worker/D1, auth CRUD, offline queue and recovery, and Chromium full smoke.
- Visual: dark/light, 320/390/700/900/1280/1440/1920 px; no horizontal document overflow; 0/1/20 Todo states. Focus and calendar drawer close/reopen plus escape, project inspector and subtask persistence.
- `main` merge only after checks; production deploy and health after merge.
- Health success is not equivalent to manual authenticated production acceptance.
