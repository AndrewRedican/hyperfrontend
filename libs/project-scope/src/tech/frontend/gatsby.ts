import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { FrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString } from '../shared-utils/detector-helpers'

/**
 * Detect Gatsby in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Gatsby framework
 * ```typescript
 * const result = gatsbyDetector('/path/to/gatsby-blog', {
 *   dependencies: {
 *     'gatsby': '^5.0.0',
 *     'gatsby-plugin-image': '^3.0.0',
 *     'gatsby-source-filesystem': '^5.0.0'
 *   }
 * })
 * // => {
 * //   id: 'gatsby',
 * //   name: 'Gatsby',
 * //   category: 'meta-framework',
 * //   version: '5.0.0',
 * //   confidence: 75,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.gatsby' },
 * //     { type: 'package.json', field: 'dependencies (gatsby plugins)' }
 * //   ]
 * // }
 * ```
 */
export function gatsbyDetector(projectPath: string, packageJson?: PackageJson): FrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['gatsby']) {
    confidence += 70
    version = parseVersionString(deps['gatsby'])
    sources.push({ type: 'package.json', field: 'dependencies.gatsby' })
  }

  if (exists(join(projectPath, 'gatsby-config.js')) || exists(join(projectPath, 'gatsby-config.ts'))) {
    confidence += 25
    sources.push({ type: 'config-file', path: 'gatsby-config.*' })
  }

  const gatsbyPlugins = keys(deps).filter((d) => d.startsWith('gatsby-plugin-') || d.startsWith('gatsby-source-'))
  if (gatsbyPlugins.length > 0) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies (gatsby plugins)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'meta-framework',
    version,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
