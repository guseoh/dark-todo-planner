export const exceedsWipLimit = (count: number, limit?: number) =>
  limit !== undefined && limit > 0 && count > limit;

/** V4 shows all four columns by default; absent preferences mean expanded. */
export const toggleDoneColumnCollapsed = (current: boolean | undefined): boolean => !(current ?? false);
