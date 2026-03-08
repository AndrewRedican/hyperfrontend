import type { PackageJson } from '../../project/package'

/**
 * Detection source information.
 */
export interface DetectionSource {
  /** Source type */
  type: 'package.json' | 'config-file' | 'lockfile' | 'directory'
  /** Field or path identifier */
  field?: string
  /** File path */
  path?: string
}

/**
 * Base detection result.
 */
export interface TechDetection {
  /** Technology identifier */
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
 * Generic technology detector interface.
 */
export interface TechDetector<T extends TechDetection> {
  /** Technology identifier (e.g., 'react', 'webpack') */
  id: string
  /** Human-readable name */
  name: string
  /** Check if technology is present */
  detect(projectPath: string, packageJson?: PackageJson): T | null
}
