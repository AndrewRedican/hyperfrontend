import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Nuxt in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = nuxtDetector('/path/to/nuxt-app', {
 *   dependencies: { 'nuxt': '^3.0.0', 'vue': '^3.0.0' }
 * })
 * // => {
 * //   id: 'nuxt',
 * //   name: 'Nuxt',
 * //   category: 'meta-framework',
 * //   version: '3.0.0',
 * //   confidence: 70,
 * //   detectedFrom: [{ type: 'package.json', field: 'dependencies.nuxt' }]
 * // }
 * ```
 */
export function nuxtDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['nuxt'] || deps['nuxt3']) {
    confidence += 70
    version = parseVersionString(deps['nuxt'] ?? deps['nuxt3'])
    sources.push({ type: 'package.json', field: 'dependencies.nuxt' })
  }

  if (exists(join(projectPath, 'nuxt.config.js')) || exists(join(projectPath, 'nuxt.config.ts'))) {
    confidence += 25
    sources.push({ type: 'config-file', path: 'nuxt.config.*' })
  }

  if (exists(join(projectPath, 'pages'))) {
    confidence += 5
    sources.push({ type: 'directory', path: 'pages/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
