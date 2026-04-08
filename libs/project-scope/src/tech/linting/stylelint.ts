import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LintingToolDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/** Config patterns for Stylelint */
export const STYLELINT_CONFIG_PATTERNS = [
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.js',
  'stylelint.config.js',
  'stylelint.config.cjs',
]

/**
 * Detect Stylelint in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = stylelintDetector('/path/to/project', {
 *   devDependencies: { stylelint: '^15.0.0', 'stylelint-config-standard': '^30.0.0' },
 * })
 * // => { id: 'stylelint', name: 'Stylelint', confidence: 65, version: '15.0.0', ... }
 * ```
 */
export function stylelintDetector(projectPath: string, packageJson?: PackageJson): LintingToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let configPath: string | undefined
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['stylelint']) {
    confidence += 60
    version = parseVersionString(deps['stylelint'])
    sources.push({ type: 'package.json', field: 'dependencies.stylelint' })
  }

  for (const config of STYLELINT_CONFIG_PATTERNS) {
    if (exists(join(projectPath, config))) {
      confidence += 35
      configPath = config
      sources.push({ type: 'config-file', path: config })
      break
    }
  }

  const stylelintPlugins = keys(deps).filter((d) => d.startsWith('stylelint-'))
  if (stylelintPlugins.length > 0) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies (stylelint plugins)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'stylelint',
    name: 'Stylelint',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
