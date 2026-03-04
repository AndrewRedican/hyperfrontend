import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Astro in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 */
export function astroDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['astro']) {
    confidence += 70
    version = parseVersionString(deps['astro'])
    sources.push({ type: 'package.json', field: 'dependencies.astro' })
  }

  if (
    exists(join(projectPath, 'astro.config.mjs')) ||
    exists(join(projectPath, 'astro.config.ts')) ||
    exists(join(projectPath, 'astro.config.js'))
  ) {
    confidence += 25
    sources.push({ type: 'config-file', path: 'astro.config.*' })
  }

  if (exists(join(projectPath, 'src', 'pages'))) {
    confidence += 5
    sources.push({ type: 'directory', path: 'src/pages/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'astro',
    name: 'Astro',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
