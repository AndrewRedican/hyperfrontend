import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { LintingToolDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for ESLint */
export const ESLINT_CONFIG_PATTERNS = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc',
]

/**
 * Detect ESLint in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * const result = eslintDetector('/path/to/project', {
 *   devDependencies: { eslint: '^8.50.0', '@typescript-eslint/parser': '^6.0.0' },
 *   scripts: { lint: 'eslint src/' },
 * })
 * // => { id: 'eslint', name: 'ESLint', confidence: 65, version: '8.50.0', ... }
 * ```
 */
export function eslintDetector(projectPath: string, packageJson?: PackageJson): LintingToolDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['eslint']) {
    confidence += 50
    version = parseVersionString(deps['eslint'])
    sources.push({ type: 'package.json', field: 'dependencies.eslint' })
  }

  const configPath = locateConfigFile(projectPath, ESLINT_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 40
    sources.push({ type: 'config-file', path: configPath })
  }

  if (pkg && 'eslintConfig' in pkg) {
    confidence += 30
    sources.push({ type: 'package.json', field: 'eslintConfig' })
  }

  const eslintPlugins = keys(deps).filter(
    (d) => d.startsWith('eslint-plugin-') || d.startsWith('@typescript-eslint/') || d.startsWith('eslint-config-')
  )
  if (eslintPlugins.length > 0) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'dependencies (eslint plugins)' })
  }

  const lintScript = pkg?.scripts?.['lint'] ?? ''
  if (lintScript.includes('eslint')) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'scripts.lint' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'eslint',
    name: 'ESLint',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
