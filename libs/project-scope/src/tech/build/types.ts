import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Build tool detection result.
 */
export interface BuildToolDetection {
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
}

/**
 * Build tool detector interface.
 */
export interface BuildToolDetector {
  /** Tool identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Check if tool is present */
  detect(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null
}
