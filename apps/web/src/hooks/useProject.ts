import { fetchProject, updateProject } from "@/api";
import { useEffect, useState, useCallback } from "react";
import type { EssayProject } from "@auto-essay/core";

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<EssayProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProject(projectId);
      setProject(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<Pick<EssayProject, "title" | "thesisSeed" | "voiceConfig" | "argumentMap">>) => {
      if (!projectId) return;
      const updated = await updateProject(projectId, patch);
      setProject(updated);
      return updated;
    },
    [projectId]
  );

  return { project, loading, error, reload: load, update };
}
