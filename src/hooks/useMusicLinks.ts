import { useCallback, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import type { MusicLink, MusicLinkInput } from "../types/music";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "음악 링크 요청 처리 중 오류가 발생했습니다.");

export function useMusicLinks() {
  const [musicLinks, setMusicLinks] = useState<MusicLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadMusicLinks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ musicLinks: MusicLink[] }>("/api/music-links");
      setMusicLinks(result.musicLinks);
      setError("");
      return result.musicLinks;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addMusicLink = useCallback(async (input: MusicLinkInput) => {
    setSaving(true);
    try {
      const result = await api<{ musicLink: MusicLink }>("/api/music-links", {
        method: "POST",
        ...jsonBody(input),
      });
      setMusicLinks((current) => [result.musicLink, ...current]);
      setError("");
      return result.musicLink;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateMusicLink = useCallback(async (id: string, input: MusicLinkInput) => {
    setSaving(true);
    try {
      const result = await api<{ musicLink: MusicLink }>(`/api/music-links/${id}`, {
        method: "PUT",
        ...jsonBody(input),
      });
      setMusicLinks((current) => current.map((link) => (link.id === id ? result.musicLink : link)));
      setError("");
      return result.musicLink;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteMusicLink = useCallback(async (id: string) => {
    const previous = musicLinks;
    setMusicLinks((current) => current.filter((link) => link.id !== id));
    try {
      await api(`/api/music-links/${id}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      setMusicLinks(previous);
      setError(getMessage(err));
      throw err;
    }
  }, [musicLinks]);

  return {
    musicLinks,
    loading,
    saving,
    error,
    loadMusicLinks,
    addMusicLink,
    updateMusicLink,
    deleteMusicLink,
  };
}
