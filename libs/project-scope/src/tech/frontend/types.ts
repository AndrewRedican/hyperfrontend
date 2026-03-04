import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Framework detection result.
 */
export interface FrameworkDetection {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Framework category */
  category: 'frontend' | 'meta-framework'
  /** Detected version */
  version?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Meta-frameworks built on this framework */
  metaFrameworks?: FrameworkDetection[]
  /** Detection sources */
  detectedFrom: DetectionSource[]
}

/**
 * Framework detector interface.
 */
export interface FrameworkDetector {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Framework category */
  category: 'frontend' | 'meta-framework'
  /** Check if framework is present */
  detect(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null
}
