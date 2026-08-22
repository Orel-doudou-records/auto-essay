import { fetchSources, importSources, updateSource, deleteSource } from "@/api";
import { useEffect, useState, useCallback } from "react";
import type { Source } from "@auto-essay/core";

export function useSources(projectId: string | undefined) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSources(projectId);
      setSources(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const importFiles = useCallback(
    async (files: { name: string; content: string }[]) => {
      if (!projectId) return;
      const result = await importSources(projectId, files);
      await load();
      return result;
    },
    [projectId, load]
  );

  const update = useCallback(
    async (sourceId: string, patch: Partial<Omit<Source, "id">>) => {
      if (!projectId) return;
      const updated = await updateSource(projectId, sourceId, patch);
      setSources((prev) => prev.map((s) => (s.id === sourceId ? updated : s)));
      return updated;
    },
    [projectId]
  );

  const remove = useCallback(
    async (sourceId: string) => {
      if (!projectId) return;
      await deleteSource(projectId, sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    },
    [projectId]
  );

  return { sources, loading, error, reload: load, importFiles, update, remove };
}
