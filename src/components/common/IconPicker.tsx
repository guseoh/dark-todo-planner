import { ClipboardEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { CATEGORY_ICON_MAX_BYTES, normalizeCategoryIcon } from "../../lib/categoryIcon";
import { IconRenderer, lucideIconMap, type LucideIconName } from "./IconRenderer";

type IconPickerProps = {
  value: string;
  onChange: (value: string) => void;
  color?: string;
  name: string;
};

type Tab = "emoji" | "icon" | "url";

const emojiOptions = [
  "📌",
  "📚",
  "📝",
  "✅",
  "🔥",
  "💡",
  "🧠",
  "⚙️",
  "🗂️",
  "💻",
  "🚀",
  "⭐",
  "🔖",
  "🧩",
  "📎",
  "🛠️",
  "🎯",
  "📅",
  "🔍",
  "✍️",
  "🎓",
  "📖",
  "📒",
  "🧪",
  "🐛",
  "☁️",
  "🗄️",
  "🌐",
  "📦",
  "⏰",
  "⏱️",
  "🚩",
  "💼",
  "🏠",
  "☕",
  "🏋️",
  "🛒",
  "❤️",
  "🎵",
  "✈️",
];

const iconLabels: Record<LucideIconName, string> = {
  BookOpen: "책",
  BookMarked: "북마크 책",
  Library: "라이브러리",
  GraduationCap: "학습",
  CheckSquare: "체크",
  ListTodo: "할 일",
  ClipboardList: "체크리스트",
  Code: "코드",
  Braces: "중괄호",
  Terminal: "터미널",
  Bug: "버그",
  GitBranch: "Git 브랜치",
  FileText: "문서",
  StickyNote: "메모",
  Calendar: "달력",
  CalendarDays: "일정",
  CalendarCheck: "일정 완료",
  Clock: "시계",
  Timer: "타이머",
  AlarmClock: "알람",
  Lightbulb: "아이디어",
  Brain: "생각",
  Folder: "폴더",
  Star: "별",
  PenTool: "쓰기",
  Github: "GitHub",
  Database: "DB",
  Server: "서버",
  Cloud: "클라우드",
  Cpu: "CPU",
  HardDrive: "스토리지",
  Network: "네트워크",
  Package: "패키지",
  Rocket: "배포",
  Target: "목표",
  Flag: "플래그",
  Briefcase: "업무",
  Home: "집",
  Coffee: "커피",
  Dumbbell: "운동",
  ShoppingCart: "쇼핑",
  Heart: "건강",
  Music: "음악",
  Plane: "여행",
  Settings: "설정",
};

export function IconPicker({ value, onChange, color = "#6366f1", name }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");

  const iconOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (Object.keys(lucideIconMap) as LucideIconName[]).filter((item) =>
      keyword ? `${item} ${iconLabels[item]}`.toLowerCase().includes(keyword) : true,
    );
  }, [query]);

  const emojiList = useMemo(() => {
    const keyword = query.trim();
    return keyword ? emojiOptions.filter((item) => item.includes(keyword)) : emojiOptions;
  }, [query]);

  useEffect(() => {
    setDraft(value);
    setError("");
  }, [value]);

  const applyValue = (next: string, closePicker = false) => {
    const normalized = normalizeCategoryIcon(next);
    if (next.trim() && !normalized) {
      setError("http/https, data:image, emoji 또는 lucide 아이콘만 사용할 수 있습니다.");
      return;
    }
    setError("");
    setDraft(normalized);
    onChange(normalized);
    if (closePicker) {
      setOpen(false);
      setQuery("");
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").trim();
    if (text) {
      event.preventDefault();
      applyValue(text, true);
      return;
    }

    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;
    event.preventDefault();
    if (imageFile.size > CATEGORY_ICON_MAX_BYTES) {
      setError("이미지 아이콘은 180KB 이하만 붙여넣을 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyValue(String(reader.result || ""), true);
    reader.onerror = () => setError("이미지 아이콘을 읽지 못했습니다.");
    reader.readAsDataURL(imageFile);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary min-h-10 px-3 py-1.5 text-sm" onClick={() => setOpen((current) => !current)}>
          <IconRenderer icon={value} color={color} name={name || "아이콘"} className="h-6 w-6" fallback="box" />
          아이콘 선택
        </button>
        <input
          className="field min-h-10 min-w-[220px] flex-1 py-1.5 text-sm"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            applyValue(event.target.value);
          }}
          onPaste={handlePaste}
          placeholder="emoji, lucide:BookOpen, 이미지 URL"
          aria-label="아이콘 직접 입력"
        />
        {value ? (
          <button type="button" className="icon-btn h-10 w-10" onClick={() => applyValue("")} aria-label="아이콘 제거">
            <X size={15} />
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink-500">Noticon에서 원하는 이모지나 아이콘을 복사한 뒤 붙여넣을 수 있습니다.</p>
      {error ? <p className="mt-1 text-xs text-red-200">{error}</p> : null}

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-full max-w-xl rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[
              ["emoji", "이모지"],
              ["icon", "아이콘"],
              ["url", "URL / 붙여넣기"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  tab === id ? "border-accent-500/60 bg-accent-500/20 text-ink-100" : "border-ink-700 bg-ink-950/50 text-ink-400 hover:text-ink-100"
                }`}
                onClick={() => setTab(id as Tab)}
              >
                {label}
              </button>
            ))}
            <a className="ml-auto inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-300 hover:text-ink-100" href="https://noticon.tammolo.com/" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} />
              Noticon 열기
            </a>
            <button type="button" className="icon-btn h-8 w-8" onClick={() => setOpen(false)} aria-label="아이콘 선택기 닫기" title="닫기">
              <X size={14} />
            </button>
          </div>

          {tab !== "url" ? (
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={15} />
              <input className="field min-h-9 pl-9 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색" />
            </label>
          ) : null}

          {tab === "emoji" ? (
            <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-10">
              {emojiList.map((item) => (
                <button key={item} type="button" className="flex h-9 items-center justify-center rounded-lg border border-ink-800 bg-ink-950/40 text-lg hover:border-accent-500/60" onClick={() => applyValue(item, true)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          {tab === "icon" ? (
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {iconOptions.map((item) => {
                const Icon = lucideIconMap[item];
                return (
                  <button
                    key={item}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/40 px-2 py-2 text-left text-xs font-semibold text-ink-300 hover:border-accent-500/60 hover:text-ink-100"
                    onClick={() => applyValue(`lucide:${item}`, true)}
                  >
                    <Icon size={16} />
                    {iconLabels[item]}
                  </button>
                );
              })}
            </div>
          ) : null}

          {tab === "url" ? (
            <div className="space-y-2">
              <input
                className="field"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  applyValue(event.target.value);
                }}
                onPaste={handlePaste}
                placeholder="https://... 또는 data:image..."
              />
              <p className="text-xs text-ink-500">이미지 파일을 클립보드로 복사한 뒤 이 입력칸에 붙여넣을 수도 있습니다.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
