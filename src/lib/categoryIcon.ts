const MAX_ICON_LENGTH = 120_000;

const hasBlockedScheme = (value: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value) && !/^data:image\//i.test(value) && !/^lucide:[A-Za-z0-9]+$/i.test(value);

export const normalizeCategoryIcon = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_ICON_LENGTH || hasBlockedScheme(trimmed)) return "";
  return trimmed;
};

export const isCategoryImageIcon = (value?: string | null) => {
  const icon = normalizeCategoryIcon(value);
  return /^https?:\/\//i.test(icon) || /^data:image\//i.test(icon);
};

export const CATEGORY_ICON_MAX_BYTES = 180_000;
