export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const optional = (value?: string | null) => value?.trim() || null;
export const normalizeIcon = (value?: string | null) => {
  const icon = value?.trim();
  const blocked = icon && /^[a-z][a-z0-9+.-]*:/i.test(icon) && !/^https?:\/\//i.test(icon) && !/^data:image\//i.test(icon) && !/^lucide:[A-Za-z0-9]+$/i.test(icon);
  return !icon || icon.length > 120_000 || blocked ? null : icon;
};
export const pagination = (query: (name: string) => string | undefined) => {
  const limit = Math.min(100, Math.max(1, Number(query("limit")) || 100));
  const offset = Math.max(0, Number(query("cursor")) || 0);
  return { limit, offset, next: (count: number) => count === limit ? String(offset + limit) : undefined };
};
export const parseJsonArray = (value: string) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
