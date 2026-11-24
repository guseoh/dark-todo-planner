import { List, RotateCcw, X } from "lucide-react";
type WorkspaceTabItem = { id: string; title: string; color?: string };
type Props = { label: string; items: WorkspaceTabItem[]; activeId: string | null;
  onList: () => void; onSelect: (id: string) => void; onClose: (id: string) => void;
  onReopen: () => void; canReopen: boolean };
export function WorkspaceTabs({ label, items, activeId, onList, onSelect, onClose, onReopen, canReopen }: Props) {
  const selected = items.some((item) => item.id === activeId) ? activeId : null;
  return (
    <nav className="workspace-document-tabs" aria-label={label}>
      <div className="workspace-document-tabs__strip">
        <button type="button" className="workspace-document-tab workspace-document-tab--list"
          aria-pressed={selected === null} data-active={selected === null} onClick={onList}>
          <List size={13} aria-hidden="true" />전체 목록
        </button>
        {items.map((item) => (
          <div className="workspace-document-tab" key={item.id} data-active={selected === item.id}>
            <button type="button" className="workspace-document-tab__select" aria-pressed={selected === item.id}
              title={item.title} onClick={() => onSelect(item.id)}>
              {item.color ? <span className="workspace-document-tab__dot" style={{ backgroundColor: item.color }} aria-hidden="true" /> : null}
              <span>{item.title}</span>
            </button>
            <button type="button" className="workspace-document-tab__close" title="탭 닫기"
              aria-label={`${item.title} 탭 닫기`} onClick={() => onClose(item.id)}>
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="workspace-document-tabs__restore" disabled={!canReopen}
        title="마지막으로 닫은 탭 복원" aria-label="닫은 탭 복원" onClick={onReopen}>
        <RotateCcw size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}
