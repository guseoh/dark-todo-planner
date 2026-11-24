let maintenance = false;
let writes = 0;
const drafts = new Set<() => boolean>();
const failedDrafts = new Set<string>();
export function registerRecoveryDraft(flush: () => boolean) {
  drafts.add(flush);
  return () => { drafts.delete(flush); };
}
export function markDraftRecovery(key: string, saved: boolean) {
  if (saved) failedDrafts.delete(key); else failedDrafts.add(key);
}
export function startNativeWrite() {
  if (maintenance) throw new Error("앱 종료 또는 업데이트 준비 중입니다.");
  writes++;
  return () => { writes--; };
}
export function beginMaintenance() {
  if (maintenance) throw new Error("다른 유지보수 작업이 진행 중입니다.");
  if (writes) throw new Error("서버에 저장 중인 작업이 있습니다. 완료 후 다시 시도해 주세요.");
  for (const flush of drafts) if (!flush()) throw new Error("편집 초안을 보관하지 못했습니다. 먼저 저장해 주세요.");
  if (failedDrafts.size) throw new Error("보관하지 못한 편집 초안이 있습니다. 해당 문서를 다시 열어 저장해 주세요.");
  maintenance = true;
  const root = typeof document === "undefined" ? null : document.getElementById("root");
  const previous = root?.inert ?? false;
  if (root) root.inert = true;
  return () => { maintenance = false; if (root) root.inert = previous; };
}
