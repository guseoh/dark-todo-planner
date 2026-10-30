# UI V2 — G5 integrated QA and production release gate

## Scope and acceptance

- **T25 Static gate:** use the existing CI TypeScript, Vitest, backup crypto regression, production build/Wrangler dry run, and production dependency audit. Failure blocks merge.
- **T26 Light/Dark visual evidence:** render all eight active views in both themes at 320, 390, 768 and 1280 CSS pixels. Save 64 named, fixed-viewport screenshots for review. Screenshots are evidence artifacts; **this is not a pixel-diff visual baseline**.
- **T27 Responsive and accessibility gate:** assert no horizontal overflow, one discoverable main page heading, mobile navigation only at mobile/tablet widths, retired Inbox absent, reduced-motion preference, minimum 4.5:1 opaque semantic text token contrast (normal-size WCAG AA threshold), and command dialog keyboard focus containment/Escape. Token checks are **not a full element-level or manual accessibility audit**.
- **T28 Isolated D1 integration:** existing browser smoke covers authenticated CRUD, calendar actions, Todo legacy INBOX preservation, failure injection, memo recovery, and G4 scratchpad autosave failure/reload/recovery/Markdown preservation. Additional G5 read-only baseline and final snapshots detect unintended changes to Todo persisted fields and scratchpad Markdown during theme/route/responsive navigation.
- **T29 Release:** both CI jobs must pass at the exact PR head before Squash Merge. Post-merge main CI must pass before declaring Production complete; confirm production deployment step, D1 migration result and /api/health. Do not write regression fixtures to Production.

## How to run and interpret

Run standard CI via pull request. The isolated Worker/D1 browser job runs scripts/smoke-browser.mjs and then scripts/smoke-ui-v2-g5.mjs using temporary local credentials. Inspect the uploaded local-responsive-layout-snapshots artifact. Static screenshots are not a substitute for reviewed design quality or physical-device tests.

G3 INBOX storage values, G4 Markdown content and local draft schema remain backwards compatible. No Production D1 schema change, bulk rewrite, or destructive migration is introduced in G5.

## Rollback

Use docs/runbook/deploy-rollback.md and the previous production Worker version if deployment regressions are identified. Retain D1 and backup data; G5 only adds verification and documentation.
