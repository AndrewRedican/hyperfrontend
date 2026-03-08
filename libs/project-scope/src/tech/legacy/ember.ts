import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LegacyFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Ember.js in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function emberDetector(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  // Ember source package
  if (deps['ember-source']) {
    confidence += 70
    version = parseVersionString(deps['ember-source'])
    sources.push({ type: 'package.json', field: 'dependencies.ember-source' })
  }

  // Ember CLI
  if (deps['ember-cli']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'devDependencies.ember-cli' })
  }

  // Ember Data
  if (deps['ember-data']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.ember-data' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'ember',
    name: 'Ember.js',
    category: 'legacy-frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
