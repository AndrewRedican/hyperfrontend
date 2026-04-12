import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Rush in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Rush monorepo
 * ```typescript
 * // Project with rush.json config file
 * const result = rushDetector('/path/to/rush-project')
 * // => {
 * //   id: 'rush',
 * //   name: 'Rush',
 * //   confidence: 90,
 * //   configPath: 'rush.json',
 * //   detectedFrom: [{ type: 'config-file', path: 'rush.json' }]
 * // }
 * ```
 */
export function rushDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  let configPath: string | undefined

  const rushJsonPath = join(workspacePath, 'rush.json')
  if (exists(rushJsonPath)) {
    confidence += 90
    configPath = 'rush.json'
    sources.push({ type: 'config-file', path: 'rush.json' })
  }

  const deps = collectAllDependencies(pkg)

  if (deps['@microsoft/rush']) {
    confidence += 10
    version = parseVersionString(deps['@microsoft/rush'])
    sources.push({ type: 'package.json', field: 'dependencies.@microsoft/rush' })
  }

  if (exists(join(workspacePath, 'common', 'config', 'rush'))) {
    confidence += 5
    sources.push({ type: 'directory', path: 'common/config/rush/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'rush',
    name: 'Rush',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
