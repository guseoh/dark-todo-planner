export type TodoProjectLinks = {
  projectId: string | null;
  milestoneId: string | null;
  parentTodoId: string | null;
};

export type TodoProjectLinkChange = {
  id: string;
  before: TodoProjectLinks;
  after: TodoProjectLinks;
};
