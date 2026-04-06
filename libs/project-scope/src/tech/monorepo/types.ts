import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Monorepo detection result.
 */
export interface MonorepoDetection {
  /** Tool identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Config file path */
  configPath?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Detection sources */
  detectedFrom: DetectionSource[]
  /** Workspace layout */
  workspaceLayout?: { /** Applications directory */ appsDir: string; /** Libraries directory */ libsDir: string }
  /** Detected project paths */
  projects?: string[]
}

/**
 * Monorepo detector interface.
 */
export interface MonorepoDetector {
  /** Tool identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Check if tool is present */
  detect(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null
}

export type { DetectionSource }
