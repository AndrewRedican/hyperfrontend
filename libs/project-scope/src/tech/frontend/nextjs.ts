import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Next.js in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function nextjsDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['next']) {
    confidence += 70
    version = parseVersionString(deps['next'])
    sources.push({ type: 'package.json', field: 'dependencies.next' })
  }

  if (
    exists(join(projectPath, 'next.config.js')) ||
    exists(join(projectPath, 'next.config.mjs')) ||
    exists(join(projectPath, 'next.config.ts'))
  ) {
    confidence += 25
    sources.push({ type: 'config-file', path: 'next.config.*' })
  }

  if (
    exists(join(projectPath, 'pages')) ||
    exists(join(projectPath, 'app')) ||
    exists(join(projectPath, 'src', 'pages')) ||
    exists(join(projectPath, 'src', 'app'))
  ) {
    confidence += 5
    sources.push({ type: 'directory', path: 'pages/ or app/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'nextjs',
    name: 'Next.js',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
