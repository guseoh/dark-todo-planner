# UI V2 G3 — retire Inbox, preserve historic Todo records

## T16 — persistence impact
- The existing `INBOX` planning state is a **persisted compatibility value**, not a new navigation destination. Existing records, their dates (`9999-12-31`), titles, category/project linkage, completion and priority are preserved without a database migration or bulk write.
- Worker API (`worker/routes/todos.ts`), validation schema (`worker/validation.ts`), backup export/import and local/offline storage **continue to support** historical `INBOX` values, including GET and PUT operations. No production user data or schema is mutated in this PR.
- `INBOX` is shown as **미계획** for existing records. `SOMEDAY` and `WAITING` remain distinct.
- A legacy record retains `INBOX` during non-scheduling edits. Editing its planning state to `SCHEDULED` and choosing a real date is an explicit user decision.

## T17 — retire the Inbox user flow
- Remove Inbox from desktop/mobile sidebar, command palette, app router, quick-add token parser and new Todo creation selectors.
- Replace the fourth mobile primary destination with **전체 Todo**.
- A legacy `#/inbox` bookmark routes to `#/all` (including direct navigation / page load), replacing history rather than adding an extra entry.
- Historical `INBOX` storage values remain valid at the API boundary. The admin/backup compatibility is not a new supported UI creation flow.

## T18 — recover existing unscheduled work in the All Todo screen
- Count non-archived legacy `INBOX` rows and expose a **미계획 N개 보기** control only when there are matches. It sets a planning-state filter and includes both completed/uncompleted rows.
- Advanced search supports **계획 상태 → 미계획 (기존 Todo)**. Older saved filter objects gain the `ALL` default, without rewriting local storage. Standard Todo detail editing and bulk date assignment can schedule legacy rows.
- Existing `INBOX` records remain visible in the unfiltered All Todo list; their historical value stays untouched on the server until explicitly changed.

## Automated release evidence
- Unit tests: navigation list and old hashes, retired parsing keywords, existing general planning-state behavior.
- Isolated Worker/D1 browser flow creates a **test-only legacy record** (never production), reloads a `#/inbox` deep link, filters it in All Todo, verifies a failed update preserves the record, and successfully schedules it.
- Standard CI: typecheck, Vitest, production build, audit, Worker/D1 isolation, Chromium responsive and theme screenshots. Merge only when all required jobs succeed.

## Rollback
Revert the UI PR if necessary. Historical `INBOX` rows and backup payloads remain unchanged; no database rollback or migration undo is required.
