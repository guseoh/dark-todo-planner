import { useCallback, useMemo, useState } from "react";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import type { Milestone, MilestoneInput, Project, ProjectInput } from "../types/project";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "프로젝트 요청 처리 중 오류가 발생했습니다.";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, milestoneRows] = await Promise.all([
        apiAllPages<Project>("/api/projects?archived=all", "projects"),
        apiAllPages<Milestone>("/api/milestones", "milestones"),
      ]);
      setProjects(projectRows);
      setMilestones(milestoneRows);
      setError("");
      return projectRows;
    } catch (err) {
      setError(getMessage(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addProject = useCallback(async (input: ProjectInput) => {
    setSaving(true);
    try {
      const result = await api<{ project: Project }>("/api/projects", { method: "POST", ...jsonBody({ status: "ACTIVE", ...input }) });
      setProjects((current) => [...current, result.project].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)));
      setError("");
      return result.project;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<ProjectInput>) => {
    const existing = projects.find((project) => project.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ project: Project }>(`/api/projects/${id}`, {
        method: "PUT",
        ...jsonBody({
          name: updates.name ?? existing.name,
          description: Object.prototype.hasOwnProperty.call(updates, "description") ? updates.description : existing.description,
          status: updates.status ?? existing.status,
          color: Object.prototype.hasOwnProperty.call(updates, "color") ? updates.color : existing.color,
          icon: Object.prototype.hasOwnProperty.call(updates, "icon") ? updates.icon : existing.icon,
          startDate: Object.prototype.hasOwnProperty.call(updates, "startDate") ? updates.startDate : existing.startDate,
          targetDate: Object.prototype.hasOwnProperty.call(updates, "targetDate") ? updates.targetDate : existing.targetDate,
          archived: updates.archived ?? existing.archived,
          order: updates.order ?? existing.order,
        }),
      });
      setProjects((current) => current.map((project) => project.id === id ? result.project : project));
      setError("");
      return result.project;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, [projects]);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    try {
      const result = await api<{ project: Project }>(`/api/projects/${id}/${archived ? "archive" : "unarchive"}`, { method: "PATCH" });
      setProjects((current) => current.map((project) => project.id === id ? result.project : project));
      setError("");
      return result.project;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    }
  }, []);

  const addMilestone = useCallback(async (input: MilestoneInput) => {
    setSaving(true);
    try {
      const result = await api<{ milestone: Milestone }>("/api/milestones", { method: "POST", ...jsonBody({ status: "TODO", ...input }) });
      setMilestones((current) => [...current, result.milestone].sort((a, b) => a.order - b.order));
      setError("");
      return result.milestone;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, []);

  const updateMilestone = useCallback(async (id: string, updates: Partial<MilestoneInput>) => {
    const existing = milestones.find((milestone) => milestone.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ milestone: Milestone }>(`/api/milestones/${id}`, {
        method: "PUT",
        ...jsonBody({
          projectId: updates.projectId ?? existing.projectId,
          title: updates.title ?? existing.title,
          description: Object.prototype.hasOwnProperty.call(updates, "description") ? updates.description : existing.description,
          targetDate: Object.prototype.hasOwnProperty.call(updates, "targetDate") ? updates.targetDate : existing.targetDate,
          status: updates.status ?? existing.status,
          order: updates.order ?? existing.order,
        }),
      });
      setMilestones((current) => current.map((milestone) => milestone.id === id ? result.milestone : milestone));
      setError("");
      return result.milestone;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, [milestones]);

  const deleteMilestone = useCallback(async (id: string) => {
    const previous = milestones;
    setMilestones((current) => current.filter((milestone) => milestone.id !== id));
    try {
      await api(`/api/milestones/${id}`, { method: "DELETE" });
      setError("");
      return true;
    } catch (err) {
      setMilestones(previous);
      setError(getMessage(err));
      return false;
    }
  }, [milestones]);

  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archived), [projects]);

  return {
    projects, activeProjects, archivedProjects, milestones, loading, saving, error,
    loadProjects, addProject, updateProject,
    archiveProject: (id: string) => setArchived(id, true),
    unarchiveProject: (id: string) => setArchived(id, false),
    addMilestone, updateMilestone, deleteMilestone,
  };
}
