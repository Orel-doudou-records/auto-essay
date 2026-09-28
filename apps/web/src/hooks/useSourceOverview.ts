import { useEffect, useState } from "react";
import type { ScopeContextSource } from "@/api/scopeContext";

export const sourceStateLabels: Record<ScopeContextSource["state"], string> = {
  explored: "Explorée",
  partial: "Partielle",
  registered_unexplored: "Non explorée",
  unusable: "Non exploitable",
};

export function useSourceOverview(projectId: string | undefined, revision = 0) {
  const [sources, setSources] = useState<ScopeContextSource[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setSources([]);
    setError(undefined);
    if (!projectId) return;
    void fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sources/overview`,
    )
      .then(async (res) => {
        if (!res.ok)
          throw new Error("Les états documentaires sont indisponibles.");
        return res.json() as Promise<{ sources: ScopeContextSource[] }>;
      })
      .then((data) => {
        if (active) setSources(data.sources);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "États indisponibles.",
          );
      });
    return () => {
      active = false;
    };
  }, [projectId, revision]);
  return { sources, error };
}
