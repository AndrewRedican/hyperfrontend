import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Babel */
export const BABEL_CONFIG_PATTERNS = ['babel.config.js', 'babel.config.cjs', 'babel.config.mjs', 'babel.config.json', '.babelrc', '.babelrc.json', '.babelrc.js']

/**
 * Detect Babel in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = babelDetector('/path/to/project', {
 *   name: 'my-app',
 *   devDependencies: { '@babel/core': '^7.23.0', '@babel/preset-env': '^7.23.0' }
 * })
 * // => {
 * //   id: 'babel',
 * //   name: 'Babel',
 * //   version: '7.23.0',
 * //   confidence: 60,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.@babel/core' },
 * //     { type: 'package.json', field: 'dependencies (@babel packages)' }
 * //   ]
 * // }
 * ```
 */
export function babelDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@babel/core']) {
    confidence += 50
    version = parseVersionString(deps['@babel/core'])
    sources.push({ type: 'package.json', field: 'dependencies.@babel/core' })
  }

  const configPath = locateConfigFile(projectPath, BABEL_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 40
    sources.push({ type: 'config-file', path: configPath })
  }

  if (pkg && 'babel' in pkg) {
    confidence += 30
    sources.push({ type: 'package.json', field: 'babel' })
  }

  const babelPackages = keys(deps).filter((d) => d.startsWith('@babel/'))
  if (babelPackages.length > 1) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (@babel packages)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'babel',
    name: 'Babel',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
