export const SCRATCHPAD_DRAFT_KEY = "dark-todo-planner:scratchpad-recovery";

export type ScratchpadDraft = { content: string; savedAt: number };

export function parseScratchpadDraft(raw: string | null): ScratchpadDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const draft = value as Record<string, unknown>;
    if (typeof draft.content !== "string" || draft.content.length > 2_000_000) return null;
    if (typeof draft.savedAt !== "number" || !Number.isFinite(draft.savedAt) || draft.savedAt <= 0) return null;
    return { content: draft.content, savedAt: draft.savedAt };
  } catch {
    return null;
  }
}

export const isScratchpadRecoveryNeeded = (draft: ScratchpadDraft | null, serverContent: string) =>
  draft !== null && draft.content !== serverContent;
