import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Testing framework detection result.
 */
export interface TestingFrameworkDetection {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Config file path */
  configPath?: string
  /** Test type */
  type: 'unit' | 'e2e' | 'integration'
  /** Detection confidence (0-100) */
  confidence: number
  /** Detection sources */
  detectedFrom: DetectionSource[]
}

/**
 * Testing framework detector interface.
 */
export interface TestingFrameworkDetector {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Test type */
  testType: 'unit' | 'e2e' | 'integration'
  /** Check if framework is present */
  detect(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null
}
