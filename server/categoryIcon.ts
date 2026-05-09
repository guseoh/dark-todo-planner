const MAX_ICON_LENGTH = 120_000;

const hasBlockedScheme = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value) && !/^data:image\//i.test(value);

export const normalizeCategoryIcon = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_ICON_LENGTH || hasBlockedScheme(trimmed)) return null;
  return trimmed;
};
