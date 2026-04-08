import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile, filterScriptsByCommand } from '../shared-utils/detector-helpers'

/** Config patterns for Rollup */
export const ROLLUP_CONFIG_PATTERNS = ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs', 'rollup.config.cjs']

/**
 * Detect Rollup in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = rollupDetector('/path/to/project', {
 *   name: 'my-lib',
 *   devDependencies: {
 *     'rollup': '^4.0.0',
 *     '@rollup/plugin-node-resolve': '^15.0.0',
 *     '@rollup/plugin-commonjs': '^25.0.0'
 *   }
 * })
 * // => {
 * //   id: 'rollup',
 * //   name: 'Rollup',
 * //   version: '4.0.0',
 * //   confidence: 65,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.rollup' },
 * //     { type: 'package.json', field: 'dependencies (rollup plugins)' }
 * //   ]
 * // }
 * ```
 */
export function rollupDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['rollup']) {
    confidence += 55
    version = parseVersionString(deps['rollup'])
    sources.push({ type: 'package.json', field: 'dependencies.rollup' })
  }

  const configPath = locateConfigFile(projectPath, ROLLUP_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 40
    sources.push({ type: 'config-file', path: configPath })
  }

  const rollupPlugins = keys(deps).filter((d) => d.startsWith('@rollup/') || d.startsWith('rollup-plugin-'))
  if (rollupPlugins.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (rollup plugins)' })
  }

  const scriptMatches = filterScriptsByCommand(pkg?.scripts, 'rollup')
  for (const name of scriptMatches) {
    confidence = min(confidence + 5, 100)
    sources.push({ type: 'package.json', field: `scripts.${name}` })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'rollup',
    name: 'Rollup',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
