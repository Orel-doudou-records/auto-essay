import {
  fetchProjects,
  createProject,
  deleteProject,
} from "@/api";
import { useEffect, useState, useCallback } from "react";
import type { EssayProject } from "@auto-essay/core";

export function useProjects() {
  const [projects, setProjects] = useState<EssayProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (title: string) => {
      const project = await createProject(title);
      setProjects((prev) => [project, ...prev]);
      return project;
    },
    []
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    },
    []
  );

  return { projects, loading, error, reload: load, add, remove };
}
