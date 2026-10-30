# UI V2 — G4 Scratchpad WYSIWYG editor

## T19 — data and conversion contract
- React Tiptap 3.32.0 with StarterKit, TaskList/TaskItem, and Markdown extension. Only the Scratchpad screen changes; existing Todo Memo editors remain separate.
- **D1 / API stay unchanged:** `GET/PUT /api/scratchpad` still use `scratchpad.content: string` as Markdown. No schema migration, historical production data rewrite, or HTML persistence.
- Existing local recovery draft key `dark-todo-planner:scratchpad-recovery` remains valid. On mount, the persisted Markdown is loaded into the editor without triggering a write.
- Tiptap Markdown is beta. Table syntax, inline HTML, images, reference links, YAML front matter and math are edited in the **Markdown source fallback** rather than being round-tripped through a lossy rich renderer. Source mode must never discard the original string.

## T20–T21 — editing
- Rich editing of headings, paragraph text, bold, italics, strikethrough, blockquote, bullets, ordered lists and checklist.
- Tiptap StarterKit input rules interpret common Markdown triggers when typing (`# `, `- `, `1. `, `> `); task items use TaskList input rules.
- Keyboard shortcuts and accessibility: the rich surface has the same `낙서장 편집기` accessible name as the old textarea. Toolbar actions operate directly on the selection, not by injecting literal `**` tokens.

## T22 — interoperability and safety
- Import `.md` and `.txt`, with original raw Markdown available in source mode; export `.md` using exactly the current Markdown content.
- Unsupported source structures use the legacy textarea to prevent silent conversion loss. Advanced Markdown source cannot be switched to rich mode until unsupported constructs are removed.
- Markdown is the only persisted representation. A page reload restores the document through the same GET endpoint.

## T23 — save, undo, recovery and files
- Preserve 700 ms debounced autosave and ordered save queue (older response cannot overwrite newer edit).
- Preserve browser draft recovery, visible pending/saved/error state, retry button and beforeunload protection for uncommitted edits.
- Rich Undo/Redo use Tiptap editor history, and raw Markdown continues to use the previous local text history. Find/replace runs against editor text nodes and avoids HTML injection.
- Preserve new document, open file, zoom, wrap, manual save and file export. The server does not gain arbitrary attachment upload storage.

## T24 — release gate
- Vitest safeguards ordinary Korean Markdown and unsupported legacy structures.
- Existing isolated Worker + D1 Chromium smoke must verify failed PUT -> local draft -> reload -> recovery -> persisted server content. Test the rich contenteditable surface rather than assuming a textarea.
- Required CI stages: typecheck, Vitest, build, audit, isolated Worker/D1 and responsive Chromium. Only merge after all pass.

## Rollback
Revert the UI PR to restore the previous textarea. The stored Markdown string and recovery draft schema are unchanged, so no D1 data migration or rollback is necessary.
