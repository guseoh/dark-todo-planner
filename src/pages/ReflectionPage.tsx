import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "../components/common/Modal";
import { ReflectionForm } from "../components/reflection/ReflectionForm";
import { ReflectionList } from "../components/reflection/ReflectionList";
import type { Reflection } from "../types/reflection";

type ReflectionPageProps = {
  reflections: Reflection[];
  onAdd: (input: { date: string; type: Reflection["type"]; sections: Reflection["sections"]; content?: string }) => unknown | Promise<unknown>;
  onUpdate: (id: string, updates: Partial<Pick<Reflection, "date" | "type" | "content" | "sections">>) => unknown | Promise<unknown>;
  onDelete: (id: string) => unknown | Promise<unknown>;
};

export function ReflectionPage({ reflections, onAdd, onUpdate, onDelete }: ReflectionPageProps) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">회고</h2>
          <p className="mt-2 text-sm text-ink-400">오늘, 이번 주, 이번 달을 짧게 정리합니다.</p>
        </div>
        <button type="button" className="btn-primary justify-center" onClick={() => setCreating(true)}>
          <Plus size={17} />
          회고 작성
        </button>
      </section>
      <ReflectionList reflections={reflections} onUpdate={onUpdate} onDelete={onDelete} />

      {creating ? (
        <Modal
          title="회고 작성"
          description="유형과 날짜를 선택하고 한 개 이상의 항목을 작성하세요."
          onClose={() => setCreating(false)}
          size="lg"
        >
          <ReflectionForm
            onSubmit={async (input) => {
              await onAdd(input);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
