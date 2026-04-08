import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect NX in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * // Project with nx.json and apps/libs directories
 * const result = nxDetector('/path/to/nx-workspace')
 * // => {
 * //   id: 'nx',
 * //   name: 'NX',
 * //   confidence: 100,
 * //   configPath: 'nx.json',
 * //   version: '17.0.0',
 * //   workspaceLayout: { appsDir: 'apps', libsDir: 'libs' },
 * //   detectedFrom: [
 * //     { type: 'config-file', path: 'nx.json' },
 * //     { type: 'package.json', field: 'dependencies.nx' },
 * //     { type: 'directory', path: 'apps/ or libs/' }
 * //   ]
 * // }
 * ```
 */
export function nxDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  let workspaceLayout: { /** Applications directory */ appsDir: string; /** Libraries directory */ libsDir: string } | undefined

  const nxJsonPath = join(workspacePath, 'nx.json')
  if (exists(nxJsonPath)) {
    confidence += 70
    sources.push({ type: 'config-file', path: 'nx.json' })
  }

  const deps = collectAllDependencies(pkg)

  if (deps['nx']) {
    confidence += 20
    version = parseVersionString(deps['nx'])
    sources.push({ type: 'package.json', field: 'dependencies.nx' })
  }

  const hasApps = exists(join(workspacePath, 'apps'))
  const hasLibs = exists(join(workspacePath, 'libs'))
  if (hasApps || hasLibs) {
    confidence += 10
    sources.push({ type: 'directory', path: 'apps/ or libs/' })
    workspaceLayout = {
      appsDir: hasApps ? 'apps' : '',
      libsDir: hasLibs ? 'libs' : '',
    }
  }

  const nxPackages = keys(deps).filter((d) => d.startsWith('@nx/') || d.startsWith('@nrwl/'))
  if (nxPackages.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: '@nx/* packages' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'nx',
    name: 'NX',
    version,
    configPath: exists(nxJsonPath) ? 'nx.json' : undefined,
    confidence: min(confidence, 100),
    detectedFrom: sources,
    workspaceLayout,
  }
}
