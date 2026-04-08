import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LintingToolDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Prettier */
export const PRETTIER_CONFIG_PATTERNS = [
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.cjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.toml',
]

/**
 * Detect Prettier in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = prettierDetector('/path/to/project', {
 *   devDependencies: { prettier: '^3.0.0' },
 *   scripts: { format: 'prettier --write .' },
 * })
 * // => { id: 'prettier', name: 'Prettier', confidence: 55, version: '3.0.0', ... }
 * ```
 */
export function prettierDetector(projectPath: string, packageJson?: PackageJson): LintingToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['prettier']) {
    confidence += 50
    version = parseVersionString(deps['prettier'])
    sources.push({ type: 'package.json', field: 'dependencies.prettier' })
  }

  const configPath = locateConfigFile(projectPath, PRETTIER_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 40
    sources.push({ type: 'config-file', path: configPath })
  }

  if (pkg && 'prettier' in pkg) {
    confidence += 30
    sources.push({ type: 'package.json', field: 'prettier' })
  }

  if (exists(join(projectPath, '.prettierignore'))) {
    confidence += 10
    sources.push({ type: 'config-file', path: '.prettierignore' })
  }

  const prettierPlugins = keys(deps).filter((d) => d.startsWith('prettier-plugin-'))
  if (prettierPlugins.length > 0) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies (prettier plugins)' })
  }

  const formatScript = pkg?.scripts?.['format'] ?? pkg?.scripts?.['prettier'] ?? ''
  if (formatScript.includes('prettier')) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'scripts.format' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'prettier',
    name: 'Prettier',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
