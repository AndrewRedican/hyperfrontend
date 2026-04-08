import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LegacyFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect AngularJS (1.x) in project.
 * AngularJS is the original Angular framework, distinct from Angular 2+.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = angularJSDetector('/path/to/project', {
 *   dependencies: { angular: '^1.8.0', 'angular-route': '^1.8.0' },
 * })
 * // => { id: 'angularjs', name: 'AngularJS', confidence: 85, version: '1.8.0', ... }
 * ```
 */
export function angularJSDetector(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['angular']) {
    confidence += 70
    version = parseVersionString(deps['angular'])
    sources.push({ type: 'package.json', field: 'dependencies.angular' })
  }

  if (deps['angular-route']) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies.angular-route' })
  }

  if (deps['angular-resource']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.angular-resource' })
  }

  if (deps['angular-animate']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.angular-animate' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'angularjs',
    name: 'AngularJS',
    category: 'legacy-frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
