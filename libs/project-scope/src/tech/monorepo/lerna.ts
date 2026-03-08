import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Lerna in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function lernaDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  let configPath: string | undefined

  const lernaJsonPath = join(workspacePath, 'lerna.json')
  if (exists(lernaJsonPath)) {
    confidence += 80
    configPath = 'lerna.json'
    sources.push({ type: 'config-file', path: 'lerna.json' })
  }

  const deps = collectAllDependencies(pkg)

  if (deps['lerna']) {
    confidence += 15
    version = parseVersionString(deps['lerna'])
    sources.push({ type: 'package.json', field: 'dependencies.lerna' })
  }

  if (exists(join(workspacePath, 'packages'))) {
    confidence += 5
    sources.push({ type: 'directory', path: 'packages/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'lerna',
    name: 'Lerna',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
