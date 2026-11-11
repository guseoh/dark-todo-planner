export const exceedsWipLimit = (count: number, limit?: number) =>
  limit !== undefined && limit > 0 && count > limit;
