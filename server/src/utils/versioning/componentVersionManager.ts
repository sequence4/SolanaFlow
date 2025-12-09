/**
 * Component Version Manager
 * Manages versioning, rollback, and comparison of UI components
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import pool from '../../config/database';
import fs from 'fs/promises';
import path from 'path';

export interface ComponentVersion {
  id: string;
  projectId: string;
  version: string;
  hash: string;
  files: ComponentFile[];
  metadata: VersionMetadata;
  createdAt: Date;
  createdBy: string;
  status: 'active' | 'archived' | 'draft';
}

interface ComponentFile {
  path: string;
  content: string;
  hash: string;
  size: number;
}

interface VersionMetadata {
  templateUsed?: string;
  programId: string;
  description?: string;
  breaking: boolean;
  dependencies: Record<string, string>;
  performance: {
    buildTime: number;
    bundleSize: number;
  };
}

export class ComponentVersionManager extends EventEmitter {
  private readonly VERSION_REGEX = /^v\d+\.\d+\.\d+$/;
  
  /**
   * Create a new component version
   */
  async createVersion(
    projectId: string, 
    files: ComponentFile[], 
    metadata: Partial<VersionMetadata>
  ): Promise<ComponentVersion> {
    const version = await this.getNextVersion(projectId);
    const versionHash = this.calculateVersionHash(files);
    
    const componentVersion: ComponentVersion = {
      id: crypto.randomUUID(),
      projectId,
      version,
      hash: versionHash,
      files,
      metadata: {
        ...metadata,
        breaking: false,
        dependencies: {},
        performance: {
          buildTime: 0,
          bundleSize: this.calculateBundleSize(files)
        }
      } as VersionMetadata,
      createdAt: new Date(),
      createdBy: 'system', // Should be actual user ID
      status: 'draft'
    };
    
    // Store in database
    await pool.query(
      `INSERT INTO component_versions 
       (id, project_id, version, hash, files, metadata, created_at, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        componentVersion.id,
        projectId,
        version,
        versionHash,
        JSON.stringify(files),
        JSON.stringify(componentVersion.metadata),
        componentVersion.createdAt,
        componentVersion.createdBy,
        componentVersion.status
      ]
    );
    
    // Store files on disk for backup
    await this.storeVersionFiles(projectId, version, files);
    
    this.emit('version-created', componentVersion);
    console.log(`[VersionManager] Created version ${version} for project ${projectId}`);
    return componentVersion;
  }
  
  /**
   * Get next semantic version
   */
  private async getNextVersion(projectId: string): Promise<string> {
    const result = await pool.query(
      `SELECT version FROM component_versions 
       WHERE project_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return 'v1.0.0';
    }
    
    const lastVersion = result.rows[0].version;
    const [major, minor, patch] = lastVersion.substring(1).split('.').map(Number);
    
    // Auto-increment patch version (can be enhanced with semver logic)
    return `v${major}.${minor}.${patch + 1}`;
  }
  
  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(projectId: string, targetVersion: string): Promise<void> {
    console.log(`[VersionManager] Rolling back project ${projectId} to ${targetVersion}`);
    
    // Get the target version
    const result = await pool.query(
      `SELECT * FROM component_versions 
       WHERE project_id = $1 AND version = $2`,
      [projectId, targetVersion]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Version ${targetVersion} not found for project ${projectId}`);
    }
    
    const version: ComponentVersion = {
      ...result.rows[0],
      files: JSON.parse(result.rows[0].files),
      metadata: JSON.parse(result.rows[0].metadata)
    };
    
    // Restore files
    await this.restoreVersionFiles(projectId, version);
    
    // Update active version
    await pool.query(
      `UPDATE component_versions 
       SET status = 'archived' 
       WHERE project_id = $1 AND status = 'active'`,
      [projectId]
    );
    
    await pool.query(
      `UPDATE component_versions 
       SET status = 'active' 
       WHERE project_id = $1 AND version = $2`,
      [projectId, targetVersion]
    );
    
    // Log the rollback action
    await pool.query(
      `INSERT INTO version_history 
       (project_id, to_version, action, performed_by, metadata)
       VALUES ($1, $2, 'rollback', 'system', $3)`,
      [projectId, targetVersion, JSON.stringify({ reason: 'manual rollback' })]
    );
    
    this.emit('version-rollback', { projectId, version: targetVersion });
    console.log(`[VersionManager] Rollback completed to ${targetVersion}`);
  }
  
  /**
   * Compare two versions
   */
  async compareVersions(
    projectId: string, 
    version1: string, 
    version2: string
  ): Promise<VersionComparison> {
    const v1 = await this.getVersion(projectId, version1);
    const v2 = await this.getVersion(projectId, version2);
    
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      removed: [] as string[],
      performance: {
        bundleSizeDiff: v2.metadata.performance.bundleSize - v1.metadata.performance.bundleSize,
        buildTimeDiff: v2.metadata.performance.buildTime - v1.metadata.performance.buildTime
      }
    };
    
    // Compare files
    const v1Files = new Map(v1.files.map(f => [f.path, f]));
    const v2Files = new Map(v2.files.map(f => [f.path, f]));
    
    for (const [path, file] of v2Files) {
      if (!v1Files.has(path)) {
        changes.added.push(path);
      } else if (v1Files.get(path)!.hash !== file.hash) {
        changes.modified.push(path);
      }
    }
    
    for (const path of v1Files.keys()) {
      if (!v2Files.has(path)) {
        changes.removed.push(path);
      }
    }
    
    return {
      version1: v1,
      version2: v2,
      changes
    };
  }
  
  /**
   * Get version history for a project
   */
  async getVersionHistory(projectId: string): Promise<ComponentVersion[]> {
    const result = await pool.query(
      `SELECT * FROM component_versions 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [projectId]
    );
    
    return result.rows.map(row => ({
      ...row,
      files: JSON.parse(row.files),
      metadata: JSON.parse(row.metadata)
    }));
  }
  
  /**
   * Activate a specific version
   */
  async activateVersion(projectId: string, versionId: string): Promise<void> {
    // Deactivate current active version
    await pool.query(
      `UPDATE component_versions 
       SET status = 'archived' 
       WHERE project_id = $1 AND status = 'active'`,
      [projectId]
    );
    
    // Activate specified version
    await pool.query(
      `UPDATE component_versions 
       SET status = 'active' 
       WHERE id = $1`,
      [versionId]
    );
    
    console.log(`[VersionManager] Activated version ${versionId} for project ${projectId}`);
  }
  
  private calculateVersionHash(files: ComponentFile[]): string {
    const content = files.map(f => f.content).join('');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  private calculateBundleSize(files: ComponentFile[]): number {
    return files.reduce((sum, f) => sum + f.size, 0);
  }
  
  private async storeVersionFiles(
    projectId: string, 
    version: string, 
    files: ComponentFile[]
  ): Promise<void> {
    const versionDir = path.join(
      process.env.ROOT_FOLDER || '/tmp',
      'versions',
      projectId,
      version
    );
    
    await fs.mkdir(versionDir, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(versionDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
    
    console.log(`[VersionManager] Stored ${files.length} files for version ${version}`);
  }
  
  private async restoreVersionFiles(
    projectId: string,
    version: ComponentVersion
  ): Promise<void> {
    const targetDir = path.join(
      process.env.ROOT_FOLDER || '/tmp',
      projectId,
      'web/src/components/generated'
    );
    
    // Clear existing files
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });
    
    // Restore versioned files
    for (const file of version.files) {
      const filePath = path.join(targetDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
    
    console.log(`[VersionManager] Restored ${version.files.length} files from version ${version.version}`);
  }
  
  private async getVersion(projectId: string, version: string): Promise<ComponentVersion> {
    const result = await pool.query(
      `SELECT * FROM component_versions 
       WHERE project_id = $1 AND version = $2`,
      [projectId, version]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Version ${version} not found`);
    }
    
    return {
      ...result.rows[0],
      files: JSON.parse(result.rows[0].files),
      metadata: JSON.parse(result.rows[0].metadata)
    };
  }
}

interface VersionComparison {
  version1: ComponentVersion;
  version2: ComponentVersion;
  changes: {
    added: string[];
    modified: string[];
    removed: string[];
    performance: {
      bundleSizeDiff: number;
      buildTimeDiff: number;
    };
  };
}

export const componentVersionManager = new ComponentVersionManager();