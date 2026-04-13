import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { BuildToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for SWC */
export const SWC_CONFIG_PATTERNS = ['.swcrc', 'swc.config.js']

/**
 * Detect SWC in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting SWC compiler
 * ```typescript
 * const result = swcDetector('/path/to/project', {
 *   name: 'my-app',
 *   devDependencies: { '@swc/core': '^1.3.0', '@swc/cli': '^0.1.0' }
 * })
 * // => {
 * //   id: 'swc',
 * //   name: 'SWC',
 * //   version: '1.3.0',
 * //   confidence: 70,
 * //   detectedFrom: [
 * //     { type: 'package.json', field: 'dependencies.@swc/core' },
 * //     { type: 'package.json', field: 'dependencies.@swc/cli' }
 * //   ]
 * // }
 * ```
 */
export function swcDetector(projectPath: string, packageJson?: PackageJson): BuildToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@swc/core']) {
    confidence += 60
    version = parseVersionString(deps['@swc/core'])
    sources.push({ type: 'package.json', field: 'dependencies.@swc/core' })
  }

  const configPath = locateConfigFile(projectPath, SWC_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 35
    sources.push({ type: 'config-file', path: configPath })
  }

  if (deps['@swc/cli']) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies.@swc/cli' })
  }

  const swcPlugins = keys(deps).filter((d) => d.startsWith('@swc/') || d.includes('swc-plugin'))
  if (swcPlugins.length > 1) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies (@swc packages)' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'swc',
    name: 'SWC',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
