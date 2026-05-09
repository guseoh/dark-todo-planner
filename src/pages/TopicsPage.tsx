import { FormEvent, useMemo, useState } from "react";
import { ExternalLink, Link2, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { IconPicker } from "../components/common/IconPicker";
import { IconRenderer } from "../components/common/IconRenderer";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { MarkdownPreview } from "../components/editor/MarkdownPreview";
import type { Topic, TopicInput, TopicLink, TopicLinkInput, TopicStatus } from "../types/topic";

const statusLabel: Record<TopicStatus | "ALL", string> = {
  ALL: "전체",
  IDEA: "아이디어",
  WRITING: "작성 중",
  DONE: "완료",
};

const statusClass: Record<TopicStatus, string> = {
  IDEA: "border-accent-500/35 bg-accent-500/10 text-indigo-100",
  WRITING: "border-warning/40 bg-warning/10 text-amber-100",
  DONE: "border-success/40 bg-success/10 text-emerald-100",
};

const parseTagsInput = (value: string) =>
  Array.from(new Set(value.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean)));

type TopicsPageProps = {
  topics: Topic[];
  topicTags: string[];
  topicCounts: Record<TopicStatus | "ALL", number>;
  onAddTopic: (input: TopicInput) => unknown | Promise<unknown>;
  onUpdateTopic: (id: string, input: Partial<TopicInput>) => unknown | Promise<unknown>;
  onDeleteTopic: (id: string) => unknown | Promise<unknown>;
  onAddTopicLink: (topicId: string, input: TopicLinkInput) => unknown | Promise<unknown>;
  onUpdateTopicLink: (topicId: string, linkId: string, input: TopicLinkInput) => unknown | Promise<unknown>;
  onDeleteTopicLink: (topicId: string, linkId: string) => unknown | Promise<unknown>;
};

function TopicForm({
  onSubmit,
}: {
  onSubmit: (input: TopicInput) => unknown | Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [tags, setTags] = useState("");
  const [icon, setIcon] = useState("lucide:Lightbulb");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const titleValue = title.trim();
    if (!titleValue) return;
    await onSubmit({ title: titleValue, memo: memo.trim() || undefined, status: "IDEA", tags: parseTagsInput(tags), icon: icon || undefined });
    setTitle("");
    setMemo("");
    setTags("");
    setIcon("lucide:Lightbulb");
  };

  return (
    <form onSubmit={submit} className="app-card space-y-3 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="저장할 공부 주제나 블로그 글감"
        />
        <input
          className="field"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="태그: Spring, Security"
        />
        <button type="submit" className="btn-primary" disabled={!title.trim()}>
          <Plus size={17} />
          주제 추가
        </button>
      </div>
      <div className="rounded-lg border border-ink-700 bg-ink-950/35 p-3">
        <p className="mb-2 text-sm font-semibold text-ink-300">주제 아이콘</p>
        <IconPicker value={icon} onChange={setIcon} name={title || "주제"} />
      </div>
      <MarkdownEditor
        value={memo}
        onChange={setMemo}
        placeholder="메모: 정리할 내용, 비교 포인트, 코드 예시 등을 가볍게 적어두세요."
      />
    </form>
  );
}

function LinkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<TopicLink>;
  submitLabel: string;
  onSubmit: (input: TopicLinkInput) => unknown | Promise<unknown>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [description, setDescription] = useState(initial?.description || "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const urlValue = url.trim();
    if (!urlValue) return;
    await onSubmit({
      title: title.trim() || undefined,
      url: urlValue,
      description: description.trim(),
    });
    if (!initial) {
      setTitle("");
      setUrl("");
      setDescription("");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field min-h-10 py-1.5 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="링크 제목" />
        <input className="field min-h-10 py-1.5 text-sm" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
      </div>
      <input
        className="field min-h-10 py-1.5 text-sm"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="설명 선택"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary min-h-9 px-3 py-1.5 text-sm" disabled={!url.trim()}>
          <Save size={15} />
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-sm" onClick={onCancel}>
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}

function TopicCard({
  topic,
  onUpdateTopic,
  onDeleteTopic,
  onAddTopicLink,
  onUpdateTopicLink,
  onDeleteTopicLink,
}: {
  topic: Topic;
  onUpdateTopic: TopicsPageProps["onUpdateTopic"];
  onDeleteTopic: TopicsPageProps["onDeleteTopic"];
  onAddTopicLink: TopicsPageProps["onAddTopicLink"];
  onUpdateTopicLink: TopicsPageProps["onUpdateTopicLink"];
  onDeleteTopicLink: TopicsPageProps["onDeleteTopicLink"];
}) {
  const [editing, setEditing] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [title, setTitle] = useState(topic.title);
  const [memo, setMemo] = useState(topic.memo || "");
  const [status, setStatus] = useState<TopicStatus>(topic.status);
  const [tags, setTags] = useState(topic.tags.join(", "));
  const [icon, setIcon] = useState(topic.icon || "");

  const saveTopic = async () => {
    const titleValue = title.trim();
    if (!titleValue) return;
    await onUpdateTopic(topic.id, {
      title: titleValue,
      memo: memo.trim(),
      status,
      tags: parseTagsInput(tags),
      icon: icon || undefined,
    });
    setEditing(false);
  };

  return (
    <article className="app-card flex min-h-full flex-col gap-3 p-4">
      {editing ? (
        <div className="space-y-2">
          <input className="field min-h-10 py-1.5 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <select className="field min-h-10 py-1.5 text-sm" value={status} onChange={(event) => setStatus(event.target.value as TopicStatus)}>
              <option value="IDEA">아이디어</option>
              <option value="WRITING">작성 중</option>
              <option value="DONE">완료</option>
            </select>
            <input className="field min-h-10 py-1.5 text-sm" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="태그" />
          </div>
          <div className="rounded-lg border border-ink-700 bg-ink-950/35 p-3">
            <p className="mb-2 text-sm font-semibold text-ink-300">아이콘</p>
            <IconPicker value={icon} onChange={setIcon} name={title || "주제"} />
          </div>
          <MarkdownEditor value={memo} onChange={setMemo} placeholder="주제 메모" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary min-h-9 px-3 py-1.5 text-sm" onClick={saveTopic}>
              <Save size={15} />
              저장
            </button>
            <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-sm" onClick={() => setEditing(false)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <IconRenderer icon={topic.icon || "lucide:Lightbulb"} color="#6366f1" name={topic.title} className="h-9 w-9" fallback="box" />
              <div className="min-w-0">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass[topic.status]}`}>
                {statusLabel[topic.status]}
              </span>
              <h3 className="mt-2 break-words text-base font-bold leading-6 text-ink-100">{topic.title}</h3>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => setEditing(true)} aria-label="주제 수정">
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                onClick={() => window.confirm("주제를 삭제할까요? 참고 링크도 함께 삭제됩니다.") && onDeleteTopic(topic.id)}
                aria-label="주제 삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {topic.memo ? <MarkdownPreview className="line-clamp-4" value={topic.memo} /> : null}
          {topic.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {topic.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-ink-700 bg-ink-950/60 px-2 py-0.5 text-[11px] text-ink-300">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}

      <div className="mt-auto space-y-2 border-t border-ink-700/70 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Link2 size={15} className="text-accent-400" />
            참고 링크 {topic.links.length}개
          </div>
        </div>

        {topic.links.length ? (
          <div className="space-y-2">
            {topic.links.map((link) =>
              editingLinkId === link.id ? (
                <LinkForm
                  key={link.id}
                  initial={link}
                  submitLabel="링크 저장"
                  onSubmit={async (input) => {
                    await onUpdateTopicLink(topic.id, link.id, input);
                    setEditingLinkId(null);
                  }}
                  onCancel={() => setEditingLinkId(null)}
                />
              ) : (
                <div key={link.id} className="rounded-lg border border-ink-800 bg-ink-950/35 px-3 py-2">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-100">{link.title || link.url}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">{link.url}</p>
                      {link.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-400">{link.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <a className="icon-btn min-h-8 min-w-8 rounded-md" href={link.url} target="_blank" rel="noreferrer" aria-label="링크 새 탭으로 열기">
                        <ExternalLink size={14} />
                      </a>
                      <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => setEditingLinkId(link.id)} aria-label="링크 수정">
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                        onClick={() => window.confirm("링크를 삭제할까요?") && onDeleteTopicLink(topic.id, link.id)}
                        aria-label="링크 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-ink-800 bg-ink-950/25 px-3 py-2 text-xs text-ink-500">아직 참고 링크가 없습니다.</p>
        )}

        <LinkForm submitLabel="링크 추가" onSubmit={(input) => onAddTopicLink(topic.id, input)} />
      </div>
    </article>
  );
}

export function TopicsPage({
  topics,
  topicTags,
  topicCounts,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onAddTopicLink,
  onUpdateTopicLink,
  onDeleteTopicLink,
}: TopicsPageProps) {
  const [status, setStatus] = useState<TopicStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");

  const filteredTopics = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesStatus = status === "ALL" || topic.status === status;
      const matchesTag = !tag || topic.tags.includes(tag);
      const matchesKeyword = keyword
        ? `${topic.title} ${topic.memo || ""} ${topic.tags.join(" ")} ${topic.links.map((link) => `${link.title || ""} ${link.url} ${link.description || ""}`).join(" ")}`
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchesStatus && matchesTag && matchesKeyword;
    });
  }, [query, status, tag, topics]);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">주제 보관함</h2>
          <p className="mt-2 text-sm text-ink-400">나중에 블로그로 작성할 공부 주제와 참고 링크를 모아둡니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary min-h-10 px-3 py-2 text-sm" href="https://guseoh.github.io/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} />
            내 블로그 열기
          </a>
          <span className="inline-flex min-h-10 items-center rounded-full border border-ink-700 bg-ink-800 px-3 py-1 text-sm text-ink-300">
            {filteredTopics.length}개 표시
          </span>
        </div>
      </section>

      <TopicForm onSubmit={onAddTopic} />

      <section className="app-card space-y-3 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto]">
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={17} />
            <input
              className="field w-full pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 메모, 링크 검색"
            />
          </label>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value as TopicStatus | "ALL")}>
            {(["ALL", "IDEA", "WRITING", "DONE"] as const).map((item) => (
              <option key={item} value={item}>
                {statusLabel[item]} {topicCounts[item]}
              </option>
            ))}
          </select>
          <select className="field" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">전체 태그</option>
            {topicTags.map((item) => (
              <option key={item} value={item}>
                #{item}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredTopics.length ? (
        <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onUpdateTopic={onUpdateTopic}
              onDeleteTopic={onDeleteTopic}
              onAddTopicLink={onAddTopicLink}
              onUpdateTopicLink={onUpdateTopicLink}
              onDeleteTopicLink={onDeleteTopicLink}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          title="아직 저장된 주제가 없습니다."
          description="나중에 블로그로 작성할 공부 주제를 저장해보세요."
        />
      )}
    </div>
  );
}
