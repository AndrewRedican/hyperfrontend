import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Svelte in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = svelteDetector('/path/to/svelte-app', {
 *   devDependencies: { 'svelte': '^4.0.0' }
 * })
 * // => {
 * //   id: 'svelte',
 * //   name: 'Svelte',
 * //   category: 'frontend',
 * //   version: '4.0.0',
 * //   confidence: 70,
 * //   detectedFrom: [{ type: 'package.json', field: 'dependencies.svelte' }]
 * // }
 * ```
 */
export function svelteDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined
  const metaFrameworks: FrameworkDetection[] = []

  const deps = collectAllDependencies(pkg)

  if (deps['svelte']) {
    confidence += 70
    version = parseVersionString(deps['svelte'])
    sources.push({ type: 'package.json', field: 'dependencies.svelte' })
  }

  if (exists(join(projectPath, 'svelte.config.js'))) {
    confidence += 20
    sources.push({ type: 'config-file', path: 'svelte.config.js' })
  }

  const hasSvelteFiles = exists(join(projectPath, 'src', 'App.svelte')) || exists(join(projectPath, 'src', 'routes'))
  if (hasSvelteFiles) {
    confidence += 10
    sources.push({ type: 'directory', path: 'src/*.svelte or src/routes/' })
  }

  if (deps['@sveltejs/kit']) {
    metaFrameworks.push({
      id: 'sveltekit',
      name: 'SvelteKit',
      category: 'meta-framework',
      version: parseVersionString(deps['@sveltejs/kit']),
      confidence: 90,
      detectedFrom: [{ type: 'package.json', field: 'dependencies.@sveltejs/kit' }],
    })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'svelte',
    name: 'Svelte',
    category: 'frontend',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
    metaFrameworks: metaFrameworks.length > 0 ? metaFrameworks : undefined,
  }
}
