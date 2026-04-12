import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile, filterScriptsByCommand } from '../shared-utils/detector-helpers'

/** Config patterns for Webpack */
export const WEBPACK_CONFIG_PATTERNS = [
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'webpack.config.babel.js',
]

/**
 * Detect Webpack in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Webpack bundler
 * ```typescript
 * const result = webpackDetector('/path/to/project', {
 *   name: 'my-app',
 *   devDependencies: { 'webpack': '^5.89.0', 'webpack-cli': '^5.1.0' },
 *   scripts: { 'build': 'webpack --mode production' }
 * })
 * // => {
 * //   id: 'webpack',
 * //   name: 'Webpack',
 * //   version: '5.89.0',
 * //   confidence: 65,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.webpack' },
 * //     { type: 'package.json', field: 'dependencies.webpack-cli' },
 * //     { type: 'package.json', field: 'scripts.build' }
 * //   ]
 * // }
 * ```
 */
export function webpackDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['webpack']) {
    confidence += 50
    version = parseVersionString(deps['webpack'])
    sources.push({ type: 'package.json', field: 'dependencies.webpack' })
  }

  const configPath = locateConfigFile(projectPath, WEBPACK_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 40
    sources.push({ type: 'config-file', path: configPath })
  }

  if (deps['webpack-cli']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.webpack-cli' })
  }

  const scriptMatches = filterScriptsByCommand(pkg?.scripts, 'webpack')
  for (const name of scriptMatches) {
    confidence = min(confidence + 5, 100)
    sources.push({ type: 'package.json', field: `scripts.${name}` })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'webpack',
    name: 'Webpack',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
