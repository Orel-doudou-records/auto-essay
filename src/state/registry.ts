import type { DraftUnit } from "../domain/draftUnit";
import type { DeliveryManifest } from "../domain/revision";

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
    // Simple hash pour MVP - en production, utiliser crypto.subtle
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
    const fs = await import("fs/promises");

    // Sauvegarder le contenu de l'unité
    const unitPath = this.getUnitPath(projectId, unit.id, unit.version);
    await fs.mkdir(unitPath.split("/").slice(0, -1).join("/"), { recursive: true });
    await fs.writeFile(unitPath, JSON.stringify(unit, null, 2));

    // Mettre à jour le registry
    const registry = await this.loadRegistry(projectId);
    if (!registry[unit.id]) {
      registry[unit.id] = [];
    }

    const entry: VersionEntry = {
      version: unit.version,
      unitId: unit.id,
      publishedAt: new Date().toISOString(),
      manifest,
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

    // Créer une nouvelle version basée sur le rollback
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

/**
 * Factory pour créer un registry
 */
export function createRegistry(basePath?: string): Registry {
  return new FileRegistry(basePath);
}
