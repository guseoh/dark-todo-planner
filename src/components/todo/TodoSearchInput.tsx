import { Search } from "lucide-react";

type TodoSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TodoSearchInput({ value, onChange }: TodoSearchInputProps) {
  return (
    <label className="relative block min-w-0 sm:min-w-[280px]">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
        size={17}
        aria-hidden="true"
      />
      <input
        className="field h-11 min-h-11 pl-10 pr-4 leading-5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="제목 또는 메모 검색"
        aria-label="검색"
      />
    </label>
  );
}
