import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'

/**
 * Linting tool detection result.
 */
export interface LintingToolDetection {
  /** Tool identifier */
  id: 'eslint' | 'prettier' | 'stylelint' | 'biome'
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
 * Linting tool detector interface.
 */
export interface LintingToolDetector {
  /** Tool identifier */
  id: 'eslint' | 'prettier' | 'stylelint' | 'biome'
  /** Human-readable name */
  name: string
  /** Check if tool is present */
  detect(projectPath: string, packageJson?: PackageJson): LintingToolDetection | null
}
