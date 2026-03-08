import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Backend framework detection result.
 */
export interface BackendDetection {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Config file path */
  configPath?: string
  /** Detection sources */
  detectedFrom: DetectionSource[]
}

/**
 * Backend detector interface.
 */
export interface BackendDetector {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Check if framework is present */
  detect(projectPath: string, packageJson?: PackageJson): BackendDetection | null
}
