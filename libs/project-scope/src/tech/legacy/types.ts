import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Legacy framework detection result.
 */
export interface LegacyFrameworkDetection {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Framework category */
  category: 'legacy-frontend'
  /** Detected version */
  version?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Detection sources */
  detectedFrom: DetectionSource[]
}

/**
 * Legacy framework detector interface.
 */
export interface LegacyFrameworkDetector {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Framework category */
  category: 'legacy-frontend'
  /** Check if framework is present */
  detect(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection | null
}
