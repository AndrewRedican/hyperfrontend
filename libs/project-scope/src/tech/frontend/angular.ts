import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Angular in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = angularDetector('/path/to/angular-app', {
 *   dependencies: { '@angular/core': '^17.0.0', '@angular/cli': '^17.0.0' }
 * })
 * // => {
 * //   id: 'angular',
 * //   name: 'Angular',
 * //   category: 'frontend',
 * //   version: '17.0.0',
 * //   confidence: 85,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.@angular/core' },
 * //     { type: 'package.json', field: 'dependencies.@angular/cli' }
 * //   ]
 * // }
 * ```
 */
export function angularDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@angular/core']) {
    confidence += 70
    version = parseVersionString(deps['@angular/core'])
    sources.push({ type: 'package.json', field: 'dependencies.@angular/core' })
  }

  if (deps['@angular/cli']) {
    confidence += 15
    sources.push({ type: 'package.json', field: 'dependencies.@angular/cli' })
  }

  if (exists(join(projectPath, 'angular.json'))) {
    confidence += 15
    sources.push({ type: 'config-file', path: 'angular.json' })
  }

  if (deps['angular'] && !deps['@angular/core']) {
    return {
      id: 'angularjs',
      name: 'AngularJS (Legacy)',
      category: 'frontend',
      version: parseVersionString(deps['angular']),
      confidence: 80,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.angular' }],
    }
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'angular',
    name: 'Angular',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
