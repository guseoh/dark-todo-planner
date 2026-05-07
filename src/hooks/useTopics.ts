import { useCallback, useMemo, useState } from "react";
import { api, jsonBody } from "../lib/api/client";
import type { Topic, TopicInput, TopicLink, TopicLinkInput, TopicStatus } from "../types/topic";

const getMessage = (error: unknown) => (error instanceof Error ? error.message : "주제 보관함 요청 처리 중 오류가 발생했습니다.");

const normalizeTags = (tags?: string[]) =>
  Array.from(new Set((tags || []).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean)));

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ topics: Topic[] }>("/api/topics");
      setTopics(result.topics);
      setError("");
      return result.topics;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTopic = useCallback(async (input: TopicInput) => {
    setSaving(true);
    try {
      const result = await api<{ topic: Topic }>("/api/topics", {
        method: "POST",
        ...jsonBody({ ...input, status: input.status || "IDEA", tags: normalizeTags(input.tags) }),
      });
      setTopics((current) => [result.topic, ...current]);
      setError("");
      return result.topic;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTopic = useCallback(async (id: string, input: Partial<TopicInput>) => {
    const existing = topics.find((topic) => topic.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ topic: Topic }>(`/api/topics/${id}`, {
        method: "PUT",
        ...jsonBody({
          title: input.title ?? existing.title,
          memo: hasOwn(input, "memo") ? input.memo : existing.memo,
          status: input.status ?? existing.status,
          tags: normalizeTags(hasOwn(input, "tags") ? input.tags : existing.tags),
        }),
      });
      setTopics((current) => current.map((topic) => (topic.id === id ? result.topic : topic)));
      setError("");
      return result.topic;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [topics]);

  const deleteTopic = useCallback(async (id: string) => {
    const previous = topics;
    setTopics((current) => current.filter((topic) => topic.id !== id));
    try {
      await api(`/api/topics/${id}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      setTopics(previous);
      setError(getMessage(err));
      throw err;
    }
  }, [topics]);

  const addTopicLink = useCallback(async (topicId: string, input: TopicLinkInput) => {
    setSaving(true);
    try {
      const result = await api<{ link: TopicLink }>(`/api/topics/${topicId}/links`, {
        method: "POST",
        ...jsonBody(input),
      });
      setTopics((current) =>
        current.map((topic) => (topic.id === topicId ? { ...topic, links: [...topic.links, result.link] } : topic)),
      );
      setError("");
      return result.link;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateTopicLink = useCallback(async (topicId: string, linkId: string, input: TopicLinkInput) => {
    setSaving(true);
    try {
      const result = await api<{ link: TopicLink }>(`/api/topics/${topicId}/links/${linkId}`, {
        method: "PUT",
        ...jsonBody(input),
      });
      setTopics((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? { ...topic, links: topic.links.map((link) => (link.id === linkId ? result.link : link)) }
            : topic,
        ),
      );
      setError("");
      return result.link;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteTopicLink = useCallback(async (topicId: string, linkId: string) => {
    const previous = topics;
    setTopics((current) =>
      current.map((topic) =>
        topic.id === topicId ? { ...topic, links: topic.links.filter((link) => link.id !== linkId) } : topic,
      ),
    );
    try {
      await api(`/api/topics/${topicId}/links/${linkId}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      setTopics(previous);
      setError(getMessage(err));
      throw err;
    }
  }, [topics]);

  const topicTags = useMemo(
    () => Array.from(new Set(topics.flatMap((topic) => topic.tags))).sort((a, b) => a.localeCompare(b, "ko")),
    [topics],
  );

  const topicCounts = useMemo<Record<TopicStatus | "ALL", number>>(
    () => ({
      ALL: topics.length,
      IDEA: topics.filter((topic) => topic.status === "IDEA").length,
      WRITING: topics.filter((topic) => topic.status === "WRITING").length,
      DONE: topics.filter((topic) => topic.status === "DONE").length,
    }),
    [topics],
  );

  return {
    topics,
    topicTags,
    topicCounts,
    loading,
    saving,
    error,
    loadTopics,
    addTopic,
    updateTopic,
    deleteTopic,
    addTopicLink,
    updateTopicLink,
    deleteTopicLink,
  };
}
