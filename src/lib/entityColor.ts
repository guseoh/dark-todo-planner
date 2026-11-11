export const entityColors = ["blue", "green", "amber", "rose", "violet", "teal"] as const;

type ColoredEntity = { id: string; createdAt: string; color?: string };

export function getEntityColor(entity: ColoredEntity | undefined, entities: ColoredEntity[] = []) {
  if (entity?.color) return entityColors.some((color) => color === entity.color) ? `var(--entity-${entity.color})` : entity.color;
  if (!entity) return "var(--text-muted)";
  const preceding = entities.filter(({ id, createdAt }) =>
    createdAt < entity.createdAt || (createdAt === entity.createdAt && id < entity.id)).length;
  return `var(--entity-${entityColors[preceding % entityColors.length]})`;
}
