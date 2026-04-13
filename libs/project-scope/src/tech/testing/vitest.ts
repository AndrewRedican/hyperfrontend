import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { TestingFrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Vitest */
export const VITEST_CONFIG_PATTERNS = ['vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs']

/**
 * Detect Vitest in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Vitest testing framework
 * ```typescript
 * import { vitestDetector } from '@hyperfrontend/project-scope'
 *
 * const result = vitestDetector('./my-project')
 * if (result) {
 *   console.log(`Vitest ${result.version} detected`)
 *   console.log('Config:', result.configPath)
 *   // => "Config: vitest.config.ts"
 * }
 * ```
 */
export function vitestDetector(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['vitest']) {
    confidence += 70
    version = parseVersionString(deps['vitest'])
    sources.push({ type: 'package.json', field: 'dependencies.vitest' })
  }

  const configPath = locateConfigFile(projectPath, VITEST_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 25
    sources.push({ type: 'config-file', path: configPath })
  }

  if (!configPath) {
    const viteConfig =
      exists(join(projectPath, 'vite.config.ts')) ||
      exists(join(projectPath, 'vite.config.js')) ||
      exists(join(projectPath, 'vite.config.mjs'))
    if (viteConfig && deps['vitest']) {
      confidence += 5
      sources.push({ type: 'config-file', path: 'vite.config.*' })
    }
  }

  const testScript = pkg?.scripts?.['test'] ?? ''
  if (testScript.includes('vitest')) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'scripts.test' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'vitest',
    name: 'Vitest',
    type: 'unit',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
