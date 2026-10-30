# G2 content-first screen redesign (T10–T15)

## Product decision
G1 introduced Dark/Light/System semantic tokens. G2 changes page hierarchy and density without changing persistence, routes, keyboard shortcuts, backup formats, API, or editor technology. The app should feel like a cohesive workspace, not a collection of rounded dashboard cards.

## Implementation inventory

| Task | Screens | Change |
| --- | --- | --- |
| T10 | Header, Sidebar, mobile navigation | Neutral header and search, text-first selection, active rail, understated mobile active underline |
| T11 | Today, All Todo | Replace three-column KPI tiles with inline daily status and one completion bar; flatten sticky filtering and batch actions |
| T12 | Calendar, weekly/monthly views, detail panel | Keep interactive month grid and date DnD; use a continuous weekly date grid instead of seven standalone cards; reduce outer boundaries |
| T13 | Projects, planning, insights | Flatten project selection, quick-add sections, planning tabs, repeated metric/project/day cards while retaining the kanban boundary and data visuals |
| T14 | Memo, Scratchpad | Limit memo reading/list measure, improve text hierarchy and flat rows; make the Scratchpad editing canvas uninterrupted (not WYSIWYG yet) |
| T15 | Settings, Trash, Auth, shared metrics | Turn nested informational tiles into rows, simplify destructive actions and login presentation; keep dialogs contained |

## Preservation
- Author-assigned memo and project colors remain data, and theme selection stays browser-local.
- Inbox UI/INBOX persistence remains intact until G3.
- Scratchpad continues to use the existing textarea/Markdown-string editor, original autosave/recovery, and export until G4.
- Time/day calendar drag/drop, project editing, memo linking, Todo bulk actions, authentication and session semantics remain unchanged.

## Test gate
- CI typecheck, Vitest, Wrangler build, audit, isolated Worker/D1 and real Chromium smoke.
- Preserve the existing 24 breakpoints screen shots and add 32 G2 Dark/Light screenshots (390px and 1280px; Today, All Todo, Calendar, Projects, Memo, Scratchpad, Settings, Trash).
- Check DOM scroll overflow and functional flows before allowing merge. Automated screenshots demonstrate rendering/geometry, not a human aesthetic review.
