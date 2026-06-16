const MAX_ICON_LENGTH = 120_000;

const hasAllowedDataImageScheme = (value: string) =>
  /^data:image\/(?:png|jpe?g|gif|webp|avif);/i.test(value);

const hasBlockedScheme = (value: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(value) &&
  !/^https?:\/\//i.test(value) &&
  !hasAllowedDataImageScheme(value) &&
  !/^lucide:[A-Za-z0-9]+$/i.test(value);

export const normalizeCategoryIcon = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_ICON_LENGTH || hasBlockedScheme(trimmed)) return "";
  return trimmed;
};

export const isCategoryImageIcon = (value?: string | null) => {
  const icon = normalizeCategoryIcon(value);
  return /^https?:\/\//i.test(icon) || hasAllowedDataImageScheme(icon);
};

export const CATEGORY_ICON_MAX_BYTES = 180_000;
