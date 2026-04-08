import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { TestingFrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Cypress */
export const CYPRESS_CONFIG_PATTERNS = ['cypress.config.js', 'cypress.config.ts', 'cypress.config.mjs', 'cypress.json']

/**
 * Detect Cypress in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * import { cypressDetector } from '@hyperfrontend/project-scope'
 *
 * const result = cypressDetector('./my-project')
 * if (result) {
 *   console.log(`Cypress ${result.version} detected (${result.confidence}% confidence)`)
 *   // => "Cypress 13.6.0 detected (95% confidence)"
 * }
 * ```
 */
export function cypressDetector(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['cypress']) {
    confidence += 60
    version = parseVersionString(deps['cypress'])
    sources.push({ type: 'package.json', field: 'dependencies.cypress' })
  }

  const configPath = locateConfigFile(projectPath, CYPRESS_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 30
    sources.push({ type: 'config-file', path: configPath })
  }

  if (exists(join(projectPath, 'cypress'))) {
    confidence += 10
    sources.push({ type: 'directory', path: 'cypress/' })
  }

  const e2eScript = pkg?.scripts?.['e2e'] ?? pkg?.scripts?.['test:e2e'] ?? ''
  if (e2eScript.includes('cypress')) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'scripts.e2e or scripts.test:e2e' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'cypress',
    name: 'Cypress',
    type: 'e2e',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
