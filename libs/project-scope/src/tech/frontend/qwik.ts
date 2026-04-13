import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Qwik in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Qwik framework
 * ```typescript
 * const result = qwikDetector('/path/to/qwik-app', {
 *   dependencies: {
 *     '@builder.io/qwik': '^1.0.0',
 *     '@builder.io/qwik-city': '^1.0.0'
 *   }
 * })
 * // => {
 * //   id: 'qwik',
 * //   name: 'Qwik',
 * //   category: 'frontend',
 * //   version: '1.0.0',
 * //   confidence: 90,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.@builder.io/qwik' },
 * //     { type: 'package.json', field: 'dependencies.@builder.io/qwik-city' }
 * //   ]
 * // }
 * ```
 */
export function qwikDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@builder.io/qwik']) {
    confidence += 70
    version = parseVersionString(deps['@builder.io/qwik'])
    sources.push({ type: 'package.json', field: 'dependencies.@builder.io/qwik' })
  }

  if (deps['@builder.io/qwik-city']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'dependencies.@builder.io/qwik-city' })
  }

  if (exists(join(projectPath, 'qwik.config.ts')) || exists(join(projectPath, 'qwik.config.js'))) {
    confidence += 10
    sources.push({ type: 'config-file', path: 'qwik.config.*' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'qwik',
    name: 'Qwik',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
