import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect SvelteKit in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = sveltekitDetector('/path/to/sveltekit-app', {
 *   devDependencies: { '@sveltejs/kit': '^2.0.0', 'svelte': '^4.0.0' }
 * })
 * // => {
 * //   id: 'sveltekit',
 * //   name: 'SvelteKit',
 * //   category: 'meta-framework',
 * //   version: '2.0.0',
 * //   confidence: 70,
 * //   detectedFrom: [{ type: 'package.json', field: 'dependencies.@sveltejs/kit' }]
 * // }
 * ```
 */
export function sveltekitDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@sveltejs/kit']) {
    confidence += 70
    version = parseVersionString(deps['@sveltejs/kit'])
    sources.push({ type: 'package.json', field: 'dependencies.@sveltejs/kit' })
  }

  if (exists(join(projectPath, 'svelte.config.js'))) {
    confidence += 20
    sources.push({ type: 'config-file', path: 'svelte.config.js' })
  }

  if (exists(join(projectPath, 'src', 'routes'))) {
    confidence += 10
    sources.push({ type: 'directory', path: 'src/routes/' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'sveltekit',
    name: 'SvelteKit',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
