# Dark Todo Planner — Desktop utility UX V3

**Date:** 2026-11-08  
**Status:** Implemented in review PR; merge and production verification are separate claims.

## Goal
Small, action-first daily Todo utility with wider project boards and calendar only where needed. Keep React/Worker/D1, identity of each Todo and existing backup/offline contracts. No native/Electron rewrite.

## Screen ownership
| View | Default | Expanded interaction |
| --- | --- | --- |
| Today | Narrow execution list and inline capture (820px) | Explicit **계획하기** button reveals existing candidate/overdue panel. No automatic second column |
| All Todo | Search/filter/bulk management (1080px) | Existing selection and advanced actions |
| Projects | Wide kanban/list (up to 1680px) | Project resources and administrative actions in **프로젝트 관리** tab |
| Calendar | Wide week/month (up to 1680px) | Existing date editing and detail surfaces |
| Memo | Readable collection width (1100px) | Existing draft-safe creation/edit modal, rather than risky editor migration |
| Scratchpad | 920px editor canvas | Existing Markdown/raw/WYSIWYG, recovery and automatic save |
| Settings | 920px | Data, backup, automation and display settings |

## Navigation
- Main: Today → All Todo → Projects → Calendar; Record: Memo, Scratchpad.
- Settings at sidebar foot, Trash in **더보기**; all routes still reachable via Ctrl+K and mobile More.
- Under 640px: bottom phone navigation. 640–1099px: collapsed 68px desktop rail, hovering expands an overlay without resizing content. 1100px+: obey saved expanded/collapsed preference.

## Data boundaries
- Today candidate selection, original ID/project/milestone/dueDate and offline queued mutations unchanged.
- There is no new schema, API, remote sync, external authority or destructive data migration.
- Date rollover continues to honor the existing planner-day 03:00 boundary.
- No reimplementation of code reverse engineering or PR verification; these remain external tools.

## Review gates
- Unit/type/build/audit plus isolated Worker/D1, recoverability and browser smoke must succeed.
- Test narrow 320/390, compact 768, desktop 1280 and wider 1440 widths in dark/light. Confirm no overflow and no hidden destinations.
- Today default panel absent, opened via keyboard/click, Escape/close action, overdue review and moving an existing Todo without duplication.
- Project tabs retain resource links, milestone and kanban behavior.
- Production deploy/health success does not replace authenticated operational CRUD or human visual review.
