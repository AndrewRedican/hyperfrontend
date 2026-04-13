import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BackendDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Hono in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 * @example Detecting Hono framework
 * ```typescript
 * const pkg = {
 *   dependencies: { hono: '^3.11.0', '@hono/node-server': '^1.3.0' },
 * }
 *
 * const result = honoDetector('/path/to/project', pkg)
 * // => {
 * //   id: 'hono',
 * //   name: 'Hono',
 * //   version: '3.11.0',
 * //   confidence: 100,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.hono' },
 * //     { type: 'package.json', field: 'dependencies (@hono adapters)' },
 * //   ],
 * // }
 * ```
 */
export function honoDetector(projectPath: string, packageJson?: PackageJson): BackendDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['hono']) {
    confidence += 85
    version = parseVersionString(deps['hono'])
    sources.push({ type: 'package.json', field: 'dependencies.hono' })
  }

  const honoAdapters = keys(deps).filter((d) => d.startsWith('@hono/'))
  if (honoAdapters.length > 0) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies (@hono adapters)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'hono',
    name: 'Hono',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
