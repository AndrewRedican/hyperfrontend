import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LegacyFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Backbone.js in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Backbone.js framework
 * ```typescript
 * const result = backboneDetector('/path/to/project', {
 *   dependencies: { backbone: '^1.4.0', underscore: '^1.13.0' },
 * })
 * // => { id: 'backbone', name: 'Backbone.js', confidence: 85, version: '1.4.0', ... }
 * ```
 */
export function backboneDetector(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['backbone']) {
    confidence += 70
    version = parseVersionString(deps['backbone'])
    sources.push({ type: 'package.json', field: 'dependencies.backbone' })

    if (deps['underscore']) {
      confidence += 15
      sources.push({ type: 'package.json', field: 'dependencies.underscore' })
    }

    if (deps['lodash']) {
      confidence += 5
      sources.push({ type: 'package.json', field: 'dependencies.lodash' })
    }
  }

  if (deps['backbone.marionette'] || deps['marionette']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.backbone.marionette' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'backbone',
    name: 'Backbone.js',
    category: 'legacy-frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
