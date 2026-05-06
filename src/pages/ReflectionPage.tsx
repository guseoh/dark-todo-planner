import { ReflectionForm } from "../components/reflection/ReflectionForm";
import { ReflectionList } from "../components/reflection/ReflectionList";
import type { Reflection } from "../types/reflection";

type ReflectionPageProps = {
  reflections: Reflection[];
  onAdd: (input: { date: string; type: Reflection["type"]; sections: Reflection["sections"]; content?: string }) => void;
  onUpdate: (id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => void;
  onDelete: (id: string) => void;
};

export function ReflectionPage({ reflections, onAdd, onUpdate, onDelete }: ReflectionPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">회고</h2>
        <p className="mt-2 text-sm text-ink-400">오늘, 이번 주, 이번 달을 짧게 정리합니다.</p>
      </section>
      <ReflectionForm onAdd={onAdd} />
      <ReflectionList reflections={reflections} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  );
}
