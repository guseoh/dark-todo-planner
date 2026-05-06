import type { Reflection } from "../../types/reflection";
import { EmptyState } from "../common/EmptyState";
import { ReflectionCard } from "./ReflectionCard";

export function ReflectionList({
  reflections,
  onUpdate,
  onDelete,
}: {
  reflections: Reflection[];
  onUpdate: (id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => void;
  onDelete: (id: string) => void;
}) {
  if (!reflections.length) {
    return <EmptyState title="작성된 회고가 없습니다." description="오늘 회고를 짧게 남겨보세요." />;
  }
  return (
    <div className="space-y-3">
      {reflections.map((reflection) => (
        <ReflectionCard key={reflection.id} reflection={reflection} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}
