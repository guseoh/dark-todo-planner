import type { Category } from "../../types/category";
import type { TodoFilters } from "../../types/todo";
import { TodoFilterBar } from "./TodoFilterBar";

type TodoFilterProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
  tagOptions?: string[];
  categories?: Category[];
};

export function TodoFilter(props: TodoFilterProps) {
  return <TodoFilterBar {...props} />;
}
