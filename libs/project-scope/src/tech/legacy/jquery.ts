import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LegacyFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect jQuery in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function jqueryDetector(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['jquery']) {
    confidence += 80
    version = parseVersionString(deps['jquery'])
    sources.push({ type: 'package.json', field: 'dependencies.jquery' })
  }

  if (deps['jquery-ui']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.jquery-ui' })
  }

  if (deps['jquery-validation']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.jquery-validation' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'jquery',
    name: 'jQuery',
    category: 'legacy-frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
