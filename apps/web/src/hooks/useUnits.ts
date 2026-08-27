import {
  fetchUnits,
  createUnit,
  updateUnit,
  generateUnit,
  reviseUnitChat,
  evaluateIntegratedUnit,
  evaluateUnit,
  verifyUnit,
} from "@/api";
import { useEffect, useState, useCallback } from "react";
import type { DraftUnit } from "@auto-essay/core";

export function useUnits(projectId: string | undefined) {
  const [units, setUnits] = useState<DraftUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUnits(projectId);
      setUnits(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (section: string, targetWordCount?: number) => {
      if (!projectId) return;
      const unit = await createUnit(projectId, section, targetWordCount);
      setUnits((prev) => [...prev, unit]);
      return unit;
    },
    [projectId]
  );

  const update = useCallback(
    async (unitId: string, patch: Partial<Pick<DraftUnit, "content" | "status" | "targetWordCount" | "thesis" | "version">>) => {
      if (!projectId) return;
      const updated = await updateUnit(projectId, unitId, patch);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? updated : u)));
      return updated;
    },
    [projectId]
  );

  const generate = useCallback(
    async (unitId: string) => {
      if (!projectId) return;
      const updated = await generateUnit(projectId, unitId);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? updated : u)));
      return updated;
    },
    [projectId]
  );

  const reviseChat = useCallback(
    async (unitId: string, instruction: string) => {
      if (!projectId) return;
      return reviseUnitChat(projectId, unitId, instruction);
    },
    [projectId]
  );

  const evaluate = useCallback(
    async (unitId: string) => {
      if (!projectId) return;
      return evaluateUnit(projectId, unitId);
    },
    [projectId]
  );

  const evaluateIntegrated = useCallback(
    async (unitId: string) => {
      if (!projectId) return;
      return evaluateIntegratedUnit(projectId, unitId);
    },
    [projectId]
  );

  const verify = useCallback(
    async (unitId: string) => {
      if (!projectId) return;
      const updated = await verifyUnit(projectId, unitId);
      setUnits((prev) => prev.map((u) => (u.id === unitId ? updated : u)));
      return updated;
    },
    [projectId]
  );

  return {
    units,
    loading,
    error,
    reload: load,
    add,
    update,
    generate,
    reviseChat,
    evaluate,
    evaluateIntegrated,
    verify,
  };
}
