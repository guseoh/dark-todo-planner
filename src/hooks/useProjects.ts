import { useCallback, useMemo, useState } from "react";
import { api, apiAllPages, jsonBody } from "../lib/api/client";
import type { Milestone, MilestoneInput, Project, ProjectDecision, ProjectDecisionInput, ProjectInput } from "../types/project";

const getMessage = (error: unknown) => error instanceof Error ? error.message : "프로젝트 요청 처리 중 오류가 발생했습니다.";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, milestoneRows, decisionRows] = await Promise.all([
        apiAllPages<Project>("/api/projects?archived=all", "projects"),
        apiAllPages<Milestone>("/api/milestones", "milestones"),
        apiAllPages<ProjectDecision>("/api/project-decisions", "decisions"),
      ]);
      setProjects(projectRows.map((project) => ({ ...project, resources: project.resources || [] })));
      setMilestones(milestoneRows);
      setDecisions(decisionRows);
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
      const result = await api<{ project: Project }>("/api/projects", { method: "POST", ...jsonBody({ status: "ACTIVE", resources: [], ...input }) });
      const project = { ...result.project, resources: result.project.resources || [] };
      setProjects((current) => [...current, project].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)));
      setError("");
      return project;
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
          resources: Object.prototype.hasOwnProperty.call(updates, "resources") ? updates.resources : existing.resources,
          archived: updates.archived ?? existing.archived,
          order: updates.order ?? existing.order,
        }),
      });
      const project = { ...result.project, resources: result.project.resources || [] };
      setProjects((current) => current.map((item) => item.id === id ? project : item));
      setError("");
      return project;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, [projects]);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    try {
      const result = await api<{ project: Project }>(`/api/projects/${id}/${archived ? "archive" : "unarchive"}`, { method: "PATCH" });
      const project = { ...result.project, resources: result.project.resources || [] };
      setProjects((current) => current.map((item) => item.id === id ? project : item));
      setError("");
      return project;
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

  const addDecision = useCallback(async (input: ProjectDecisionInput) => {
    setSaving(true);
    try {
      const result = await api<{ decision: ProjectDecision }>("/api/project-decisions", { method: "POST", ...jsonBody(input) });
      setDecisions((current) => [result.decision, ...current].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || b.createdAt.localeCompare(a.createdAt)));
      setError("");
      return result.decision;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, []);

  const updateDecision = useCallback(async (id: string, updates: Partial<ProjectDecisionInput>) => {
    const existing = decisions.find((decision) => decision.id === id);
    if (!existing) return undefined;
    setSaving(true);
    try {
      const result = await api<{ decision: ProjectDecision }>(`/api/project-decisions/${id}`, {
        method: "PUT",
        ...jsonBody({
          projectId: updates.projectId ?? existing.projectId,
          title: updates.title ?? existing.title,
          decision: updates.decision ?? existing.decision,
          rationale: Object.prototype.hasOwnProperty.call(updates, "rationale") ? updates.rationale : existing.rationale,
          decidedAt: updates.decidedAt ?? existing.decidedAt,
        }),
      });
      setDecisions((current) => current.map((decision) => decision.id === id ? result.decision : decision).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || b.createdAt.localeCompare(a.createdAt)));
      setError("");
      return result.decision;
    } catch (err) {
      setError(getMessage(err));
      return undefined;
    } finally { setSaving(false); }
  }, [decisions]);

  const deleteDecision = useCallback(async (id: string) => {
    const previous = decisions;
    setDecisions((current) => current.filter((decision) => decision.id !== id));
    try {
      await api(`/api/project-decisions/${id}`, { method: "DELETE" });
      setError("");
      return true;
    } catch (err) {
      setDecisions(previous);
      setError(getMessage(err));
      return false;
    }
  }, [decisions]);

  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archived), [projects]);

  return {
    projects, activeProjects, archivedProjects, milestones, decisions, loading, saving, error,
    loadProjects, addProject, updateProject,
    archiveProject: (id: string) => setArchived(id, true),
    unarchiveProject: (id: string) => setArchived(id, false),
    addMilestone, updateMilestone, deleteMilestone,
    addDecision, updateDecision, deleteDecision,
  };
}
