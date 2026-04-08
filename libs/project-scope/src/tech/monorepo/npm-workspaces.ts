import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'

/**
 * Detect npm workspaces in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * // Project with workspaces in package.json and package-lock.json
 * const result = npmWorkspacesDetector('/path/to/npm-project')
 * // => {
 * //   id: 'npm-workspaces',
 * //   name: 'npm Workspaces',
 * //   confidence: 90,
 * //   configPath: 'package.json',
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'workspaces' },
 * //     { type: 'lockfile', path: 'package-lock.json' }
 * //   ]
 * // }
 * ```
 */
export function npmWorkspacesDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0

  if (pkg?.workspaces) {
    confidence += 80
    sources.push({ type: 'package.json', field: 'workspaces' })
  }

  if (exists(join(workspacePath, 'package-lock.json'))) {
    confidence += 10
    sources.push({ type: 'lockfile', path: 'package-lock.json' })
  }

  if (exists(join(workspacePath, 'yarn.lock'))) {
    return null
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'npm-workspaces',
    name: 'npm Workspaces',
    configPath: 'package.json',
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
