# Kanban interaction and performance — 2026-11-08

## Verified source-level findings
- Column header count reads the actual items; the `WIP` input was a **manual Work In Progress limit**, separately stored in browser localStorage by project. Limits do not increase with new tasks and warn (not block) when exceeded. The former UI conflated count and limit. Before this change, count/over-limit also depended on the search-filtered subset.
- dnd-kit originally used `closestCenter` against wide droppable columns and directly translated the source card. This can yield surprising hit targets, no floating drag preview, and awkward release animation.
- Online `updateTodo` previously awaited the HTTP PUT before changing the visible Todo. Network delays thus blocked the apparent drop.
- Core load previously awaited `POST /api/planner-automations/run` after loading four base resources, postponing first app paint even if basic data was ready.
- `ProjectKanban` rendered each item on changes with an unstable callback wrapper; local `memo` plus stable delegated toggle reduces work for unchanged cards.
- These are **code-path findings**, not measured production flamegraph evidence. Do not claim milliseconds saved until real user/device measurements exist.

## Implementation contract
- Pointer-first collision + rect-intersection fallback; floating `DragOverlay`, no transform on original card. Only status transitions to valid lanes write to the server.
- Immediate optimistic UI, serialize writes per Todo ID, ignore stale response in local UI, restore previous state on the latest failed request. Preserve existing offline mutation queue and reloading semantics.
- Default board header: always display the actual total count. WIP is collapsed behind `한도` settings with explicit explanation, and warnings use total project count, even with a search filter. Stored limits remain unmodified and browser-local.
- First paint may proceed before automation POST; automatically run maintenance and deferred goals/memos/project details after core data is displayed. Retain day rollover and manual refresh behavior.
- Do not introduce a new API, database table, secret or third-party runtime dependency.

## Acceptance
1. TypeScript, unit, build, audit, isolated Worker/D1+Chromium and dual theme 320–1920px checks.
2. Browser simulation verifies live count vs WIP limit and warning while filter is applied.
3. Drag preview appears during pointer movement; destination receives card **while HTTP PUT is delayed**; server later persists same status.
4. Existing E2E covers backup, recovery, offline edits, calendar editing and theme changes.
5. Performance improvements need additional real-device profiling for precise latency claims.

## Contribution heatmap research decision
GitHub and Codex heatmaps are separate data sources. **No heatmap is implemented in this PR**, because the user requested feasibility review rather than direct implementation.
- GitHub can provide daily activity via authenticated GraphQL `contributionsCollection.contributionCalendar`; use server-side token storage, cached read-only proxy or a vetted public source. Do not ship GitHub credentials to browser code.
- Personal Codex activity does not have a proven, consumer-wide, public heatmap API for authenticated third-party planners. Local Codex session logs can be counted on-device only with explicit user opt-in; do not transmit raw prompts, paths or session transcripts to the Worker.
- A combined activity page may show GitHub and Codex as two independently labeled heatmaps if data sources are available; never add their numeric totals together or imply Codex prompts are GitHub commits.
