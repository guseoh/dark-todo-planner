export type TodoTrashEntry = {
  id: string;
  originalTodoId: string;
  title: string;
  deletedAt: string;
};

export type RestoreRefPreview = {
  requested: string | null;
  restored: string | null;
};

export type RestoreCountPreview = {
  requested: number;
  restored: number;
};

export type TodoRestorePreview = TodoTrashEntry & {
  restorable: boolean;
  refs: {
    category: RestoreRefPreview;
    project: RestoreRefPreview;
    milestone: RestoreRefPreview;
    parentTodo: RestoreRefPreview;
  };
  links: {
    children: RestoreCountPreview;
    memos: RestoreCountPreview;
    timeBlocks: RestoreCountPreview;
    focusSessions: RestoreCountPreview;
    dailyPlans: RestoreCountPreview;
  };
  warnings: string[];
};
