import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { MonorepoDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Turborepo in project.
 *
 * @param workspacePath - Workspace directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function turborepoDetector(workspacePath: string, packageJson?: PackageJson): MonorepoDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(workspacePath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  let configPath: string | undefined

  const turboJsonPath = join(workspacePath, 'turbo.json')
  if (exists(turboJsonPath)) {
    confidence += 80
    configPath = 'turbo.json'
    sources.push({ type: 'config-file', path: 'turbo.json' })
  }

  const deps = collectAllDependencies(pkg)

  if (deps['turbo']) {
    confidence += 15
    version = parseVersionString(deps['turbo'])
    sources.push({ type: 'package.json', field: 'dependencies.turbo' })
  }

  const scripts = pkg?.scripts ?? {}
  if (values(scripts).some((s) => s?.includes('turbo'))) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'scripts (turbo commands)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'turborepo',
    name: 'Turborepo',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
