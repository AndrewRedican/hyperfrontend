import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'

/**
 * Detect pnpm workspaces in project.
 *
 * @param workspacePath - Workspace directory path
 * @returns Detection result or null if not detected
 *
 * @example Detecting pnpm workspaces
 * ```typescript
 * // Project with pnpm-workspace.yaml
 * const result = pnpmWorkspacesDetector('/path/to/pnpm-project')
 * // => {
 * //   id: 'pnpm-workspaces',
 * //   name: 'pnpm Workspaces',
 * //   confidence: 100,
 * //   configPath: 'pnpm-workspace.yaml',
 * //   detectedFrom: [
 * //     { type: 'config-file', path: 'pnpm-workspace.yaml' },
 * //     { type: 'lockfile', path: 'pnpm-lock.yaml' }
 * //   ]
 * // }
 * ```
 */
export function pnpmWorkspacesDetector(workspacePath: string): MonorepoDetection | null {
  const sources: DetectionSource[] = []
  let confidence = 0
  let configPath: string | undefined

  const pnpmWorkspacePath = join(workspacePath, 'pnpm-workspace.yaml')
  if (exists(pnpmWorkspacePath)) {
    confidence += 90
    configPath = 'pnpm-workspace.yaml'
    sources.push({ type: 'config-file', path: 'pnpm-workspace.yaml' })
  }

  if (exists(join(workspacePath, 'pnpm-lock.yaml'))) {
    confidence += 10
    sources.push({ type: 'lockfile', path: 'pnpm-lock.yaml' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'pnpm-workspaces',
    name: 'pnpm Workspaces',
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
