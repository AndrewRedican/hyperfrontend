import type { PackageJson } from '../../project/package'
import type { MonorepoDetector, MonorepoDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { lernaDetector } from './lerna'
import { npmWorkspacesDetector } from './npm-workspaces'
import { nxDetector } from './nx'
import { pnpmWorkspacesDetector } from './pnpm-workspaces'
import { rushDetector } from './rush'
import { turborepoDetector } from './turborepo'
import { yarnWorkspacesDetector } from './yarn-workspaces'

/** All monorepo detectors */
export const monorepoDetectors: MonorepoDetector[] = [
  { id: 'nx', name: 'NX', detect: nxDetector },
  { id: 'turborepo', name: 'Turborepo', detect: turborepoDetector },
  { id: 'lerna', name: 'Lerna', detect: lernaDetector },
  { id: 'rush', name: 'Rush', detect: rushDetector },
  { id: 'pnpm-workspaces', name: 'pnpm Workspaces', detect: pnpmWorkspacesDetector },
  { id: 'npm-workspaces', name: 'npm Workspaces', detect: npmWorkspacesDetector },
  { id: 'yarn-workspaces', name: 'Yarn Workspaces', detect: yarnWorkspacesDetector },
]

/**
 * Detect all monorepo tools in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected monorepo tools, sorted by confidence
 */
export function detectMonorepoTools(workspacePath: string, packageJson?: PackageJson): MonorepoDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const results: MonorepoDetection[] = []

  for (const detector of monorepoDetectors) {
    const detection = detector.detect(workspacePath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
