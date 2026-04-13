import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'

/**
 * Detect yarn workspaces in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting yarn workspaces
 * ```typescript
 * // Project with workspaces in package.json and yarn.lock
 * const result = yarnWorkspacesDetector('/path/to/yarn-project')
 * // => {
 * //   id: 'yarn-workspaces',
 * //   name: 'Yarn Workspaces',
 * //   confidence: 100,
 * //   configPath: 'package.json',
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'workspaces' },
 * //     { type: 'lockfile', path: 'yarn.lock' },
 * //     { type: 'config-file', path: '.yarnrc.yml' }
 * //   ]
 * // }
 * ```
 */
export function yarnWorkspacesDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0

  if (pkg?.workspaces) {
    confidence += 70
    sources.push({ type: 'package.json', field: 'workspaces' })
  }

  if (exists(join(workspacePath, 'yarn.lock'))) {
    confidence += 20
    sources.push({ type: 'lockfile', path: 'yarn.lock' })
  }

  if (exists(join(workspacePath, '.yarnrc.yml'))) {
    confidence += 10
    sources.push({ type: 'config-file', path: '.yarnrc.yml' })
  }

  if (confidence === 0 || !pkg?.workspaces) {
    return null
  }

  return {
    id: 'yarn-workspaces',
    name: 'Yarn Workspaces',
    configPath: 'package.json',
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
