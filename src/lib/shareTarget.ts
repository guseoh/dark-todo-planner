export type ShareTargetDraft = {
  title: string;
  memo: string;
  referenceUrl: string;
  referenceLabel: string;
};

export const SHARE_TARGET_PATH = "/share-target";
const MAX_REFERENCE_URL_LENGTH = 2048;
const MAX_REFERENCE_LABEL_LENGTH = 80;
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

const trimTrailingPunctuation = (value: string) => value.replace(/[),.\]!?;]+$/g, "");

export const normalizeSharedHttpUrl = (value: string) => {
  const candidate = trimTrailingPunctuation(value.trim());
  if (!candidate || candidate.length > MAX_REFERENCE_URL_LENGTH) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const extractUrlFromText = (text: string) => {
  const match = text.match(HTTP_URL_PATTERN)?.[0] || "";
  return { raw: match, normalized: normalizeSharedHttpUrl(match) };
};

const cleanSharedText = (text: string, extractedRawUrl: string) => {
  if (!text.trim()) return "";
  const withoutUrl = extractedRawUrl ? text.replace(extractedRawUrl, " ") : text;
  return withoutUrl.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const firstMeaningfulLine = (value: string) => value
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find(Boolean) || "";

export const parseShareTargetLocation = (pathname: string, search: string): ShareTargetDraft | null => {
  if (pathname.replace(/\/+$/, "") !== SHARE_TARGET_PATH) return null;

  const params = new URLSearchParams(search);
  const sharedTitle = (params.get("title") || "").trim();
  const sharedText = (params.get("text") || "").trim();
  const explicitUrl = normalizeSharedHttpUrl(params.get("url") || "");
  const extracted = explicitUrl ? { raw: "", normalized: "" } : extractUrlFromText(sharedText);
  const referenceUrl = explicitUrl || extracted.normalized;
  const memo = cleanSharedText(sharedText, extracted.raw);

  let referenceLabel = "";
  if (referenceUrl) {
    try {
      referenceLabel = new URL(referenceUrl).hostname.replace(/^www\./, "").slice(0, MAX_REFERENCE_LABEL_LENGTH);
    } catch {
      referenceLabel = "공유 링크";
    }
  }

  const title = sharedTitle || firstMeaningfulLine(memo) || referenceLabel || "공유한 항목";
  if (!sharedTitle && !sharedText && !referenceUrl) return null;

  return { title, memo, referenceUrl, referenceLabel };
};

export const clearShareTargetLocation = () => {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", "/");
};
