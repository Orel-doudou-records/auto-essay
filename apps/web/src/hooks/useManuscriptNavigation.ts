import { useCallback, useEffect, useState } from "react";
import { fetchManuscriptNavigation, type ManuscriptNavigationEntry } from "@/api";

export function useManuscriptNavigation(projectId: string | undefined) {
  const [entries, setEntries] = useState<ManuscriptNavigationEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchManuscriptNavigation(projectId));
    } catch (reason) {
      setError(reason as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void reload(); }, [reload]);
  return { entries, loading, error, reload };
}
