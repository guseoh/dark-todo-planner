import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type ProjectSwitcherItem = {
  id: string;
  name: string;
  statusLabel: string;
  done: number;
  total: number;
  color: string;
  /** Cumulative measured time, e.g. "12시간 30분". */
  trackedLabel?: string;
};

type Props = {
  items: ProjectSwitcherItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** Project name as a dropdown trigger: replaces the permanent left-hand project list. */
export function ProjectSwitcher({ items, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = items.find(({ id }) => id === selectedId);
  const showSearch = items.length > 6;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? items.filter(({ name }) => name.toLocaleLowerCase().includes(needle)) : items;
  }, [items, query]);

  const close = (returnFocus = false) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Land on the search box for long lists, otherwise on the current project.
    const target = showSearch ? searchRef.current
      : rootRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ?? rootRef.current?.querySelector<HTMLElement>('[role="option"]');
    target?.focus();
  }, [open, showSearch]);

  const options = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); close(true); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const list = options();
    if (!list.length) return;
    event.preventDefault();
    const index = list.findIndex((element) => element === document.activeElement);
    const next = event.key === "ArrowDown" ? Math.min(list.length - 1, index + 1) : index <= 0 && showSearch ? -1 : Math.max(0, index - 1);
    if (next < 0) searchRef.current?.focus(); else list[next].focus();
  };

  return (
    <div ref={rootRef} className="project-switcher" onKeyDown={onKeyDown}>
      <button ref={triggerRef} type="button" className="project-switcher__trigger" aria-haspopup="listbox"
        aria-expanded={open} aria-controls={open ? listId : undefined} title="프로젝트 전환"
        onClick={() => (open ? close() : setOpen(true))}>
        {selected ? <span className="project-switcher__dot" style={{ backgroundColor: selected.color }} aria-hidden="true" /> : null}
        <span className="min-w-0 truncate">{selected?.name ?? "프로젝트 선택"}</span>
        <ChevronDown size={16} className="shrink-0 text-ui-muted" aria-hidden="true" />
      </button>
      {open ? (
        <div className="project-switcher__panel">
          {showSearch ? (
            <label className="project-switcher__search">
              <Search size={14} aria-hidden="true" />
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 검색" aria-label="프로젝트 검색" />
            </label>
          ) : null}
          <div id={listId} role="listbox" aria-label="프로젝트 목록">
            {visible.map((item) => (
              <button key={item.id} type="button" role="option" aria-selected={item.id === selectedId} data-project-id={item.id}
                className="project-switcher__option" onClick={() => { onSelect(item.id); close(true); }}>
                <span className="project-switcher__dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ui-text">{item.name}</span>
                  <span className="project-switcher__meta">
                    {item.statusLabel} · {item.done}/{item.total}{item.trackedLabel ? ` · ${item.trackedLabel}` : ""}
                    <span className="project-switcher__bar" aria-hidden="true"><i style={{ width: item.total ? `${item.done / item.total * 100}%` : 0, backgroundColor: item.color }} /></span>
                  </span>
                </span>
                {item.id === selectedId ? <Check size={15} className="shrink-0 text-ui-text" aria-hidden="true" /> : null}
              </button>
            ))}
            {!visible.length ? <p className="px-3 py-4 text-xs text-ui-muted">일치하는 프로젝트가 없습니다.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
