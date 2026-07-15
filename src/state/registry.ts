import type { DraftUnit } from "../domain/draftUnit";
import {
  DeliveryManifestSchema,
  type DeliveryManifest,
} from "../domain/revision";

/**
 * Entrée de version dans le registry
 */
export interface VersionEntry {
  version: number;
  unitId: string;
  publishedAt: string;
  manifest: DeliveryManifest;
  contentHash: string;
}

/**
 * Registry déterministe - Gestion des versions canoniques
 * Inspiré d'OpenClaw : déterministe, pas agentique
 *
 * Invariant : Une fois publiée, une version est immuable
 */
export interface Registry {
  /** Publie une nouvelle version */
  publishVersion(
    projectId: string,
    unit: DraftUnit,
    manifest: DeliveryManifest
  ): Promise<VersionEntry>;

  /** Récupère la dernière version */
  getLatest(projectId: string, unitId: string): Promise<DraftUnit | null>;

  /** Rollback vers une version spécifique */
  rollback(
    projectId: string,
    unitId: string,
    version: number
  ): Promise<DraftUnit | null>;

  /** Liste toutes les versions */
  listVersions(projectId: string, unitId: string): Promise<VersionEntry[]>;

  /** Récupère une version spécifique */
  getVersion(
    projectId: string,
    unitId: string,
    version: number
  ): Promise<DraftUnit | null>;
}

/**
 * Implémentation fichier JSON (MVP)
 */
export class FileRegistry implements Registry {
  private basePath: string;

  constructor(basePath: string = "./.auto-essay") {
    this.basePath = basePath;
  }

  private getRegistryPath(projectId: string): string {
    return `${this.basePath}/${projectId}/registry.json`;
  }

  private getUnitPath(projectId: string, unitId: string, version: number): string {
    return `${this.basePath}/${projectId}/units/${unitId}_v${version}.json`;
  }

  private async loadRegistry(projectId: string): Promise<Record<string, VersionEntry[]>> {
    try {
      const fs = await import("fs/promises");
      const path = this.getRegistryPath(projectId);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveRegistry(
    projectId: string,
    registry: Record<string, VersionEntry[]>
  ): Promise<void> {
    const fs = await import("fs/promises");
    const path = this.getRegistryPath(projectId);
    await fs.mkdir(path.split("/").slice(0, -1).join("/"), { recursive: true });
    await fs.writeFile(path, JSON.stringify(registry, null, 2));
  }

  private computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  async publishVersion(
    projectId: string,
    unit: DraftUnit,
    manifest: DeliveryManifest
  ): Promise<VersionEntry> {
    if (unit.projectId !== projectId) {
      throw new Error("Published unit does not belong to the requested project");
    }

    const validatedManifest = DeliveryManifestSchema.parse(manifest);
    validateManifestForUnit(unit, validatedManifest);

    const fs = await import("fs/promises");

    const unitPath = this.getUnitPath(projectId, unit.id, unit.version);
    await fs.mkdir(unitPath.split("/").slice(0, -1).join("/"), { recursive: true });
    await fs.writeFile(unitPath, JSON.stringify(unit, null, 2));

    const registry = await this.loadRegistry(projectId);
    if (!registry[unit.id]) {
      registry[unit.id] = [];
    }

    const entry: VersionEntry = {
      version: unit.version,
      unitId: unit.id,
      publishedAt: new Date().toISOString(),
      manifest: validatedManifest,
      contentHash: this.computeHash(unit.content),
    };

    registry[unit.id].push(entry);
    await this.saveRegistry(projectId, registry);

    return entry;
  }

  async getLatest(projectId: string, unitId: string): Promise<DraftUnit | null> {
    const registry = await this.loadRegistry(projectId);
    const versions = registry[unitId];
    if (!versions || versions.length === 0) return null;

    const latest = versions[versions.length - 1];
    return this.getVersion(projectId, unitId, latest.version);
  }

  async rollback(
    projectId: string,
    unitId: string,
    version: number
  ): Promise<DraftUnit | null> {
    const target = await this.getVersion(projectId, unitId, version);
    if (!target) return null;

    const rolledBack: DraftUnit = {
      ...target,
      version: target.version + 1,
      status: "drafting",
      updatedAt: new Date().toISOString(),
    };

    return rolledBack;
  }

  async listVersions(projectId: string, unitId: string): Promise<VersionEntry[]> {
    const registry = await this.loadRegistry(projectId);
    return registry[unitId] || [];
  }

  async getVersion(
    projectId: string,
    unitId: string,
    version: number
  ): Promise<DraftUnit | null> {
    try {
      const fs = await import("fs/promises");
      const path = this.getUnitPath(projectId, unitId, version);
      const data = await fs.readFile(path, "utf-8");
      return JSON.parse(data) as DraftUnit;
    } catch {
      return null;
    }
  }
}

export function createRegistry(basePath?: string): Registry {
  return new FileRegistry(basePath);
}

function validateManifestForUnit(
  unit: DraftUnit,
  manifest: DeliveryManifest
): void {
  const unitEntry = manifest.units.find(
    (entry) => entry.unitId === unit.id && entry.version === unit.version
  );
  if (!unitEntry) {
    throw new Error(
      `Delivery manifest does not include unit ${unit.id} version ${unit.version}`
    );
  }

  const provenance = manifest.editorialProvenance;
  if (!provenance) {
    return;
  }

  if (!unit.editorialPlanId || provenance.planId !== unit.editorialPlanId) {
    throw new Error("Editorial manifest plan does not match the published unit");
  }

  const manifestDecisionIds = provenance.decisions.map(
    (decision) => decision.decisionId
  );
  if (!sameStringSet(manifestDecisionIds, unit.appliedDecisionIds)) {
    throw new Error(
      "Editorial manifest decisions do not match the published unit"
    );
  }

  if (!sameStringSet(provenance.articulationIds, unit.appliedArticulationIds)) {
    throw new Error(
      "Editorial manifest articulations do not match the published unit"
    );
  }

  if (
    !sameStringSet(
      provenance.transformationTraceIds,
      unit.transformationTraceIds
    )
  ) {
    throw new Error(
      "Editorial manifest transformation traces do not match the published unit"
    );
  }
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    [...leftSet].every((value) => rightSet.has(value))
  );
}
