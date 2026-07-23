const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export const normalizeHttpUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARACTER_PATTERN.test(trimmed)) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
};
