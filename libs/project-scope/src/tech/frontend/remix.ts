import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Remix in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function remixDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@remix-run/react']) {
    confidence += 70
    version = parseVersionString(deps['@remix-run/react'])
    sources.push({ type: 'package.json', field: 'dependencies.@remix-run/react' })
  }

  if (deps['@remix-run/node'] || deps['@remix-run/cloudflare'] || deps['@remix-run/deno']) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'dependencies.@remix-run/*' })
  }

  if (exists(join(projectPath, 'remix.config.js')) || exists(join(projectPath, 'remix.config.ts'))) {
    confidence += 10
    sources.push({ type: 'config-file', path: 'remix.config.*' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'remix',
    name: 'Remix',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
