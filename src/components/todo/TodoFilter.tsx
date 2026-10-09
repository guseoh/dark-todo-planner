import type { Category } from "../../types/category";
import type { Project } from "../../types/project";
import type { TodoFilters } from "../../types/todo";
import { TodoFilterBar } from "./TodoFilterBar";

type TodoFilterProps = {
  filters: TodoFilters;
  onChange: (filters: TodoFilters) => void;
  categories?: Category[];
  projects?: Project[];
};

export function TodoFilter(props: TodoFilterProps) {
  return <TodoFilterBar {...props} />;
}
