import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { TestingFrameworkDetection } from './types'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { exists } from '../../core/fs'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Playwright */
export const PLAYWRIGHT_CONFIG_PATTERNS = ['playwright.config.js', 'playwright.config.ts', 'playwright.config.mjs']

/**
 * Detect Playwright in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Playwright testing framework
 * ```typescript
 * import { playwrightDetector } from '@hyperfrontend/project-scope'
 *
 * const result = playwrightDetector('./my-project')
 * if (result) {
 *   console.log(`Playwright ${result.version} (${result.type} tests)`)
 *   // => "Playwright 1.42.0 (e2e tests)"
 * }
 * ```
 */
export function playwrightDetector(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['@playwright/test']) {
    confidence += 70
    version = parseVersionString(deps['@playwright/test'])
    sources.push({ type: 'package.json', field: 'dependencies.@playwright/test' })
  }

  if (deps['playwright']) {
    confidence += 50
    version = version ?? parseVersionString(deps['playwright'])
    sources.push({ type: 'package.json', field: 'dependencies.playwright' })
  }

  const configPath = locateConfigFile(projectPath, PLAYWRIGHT_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 25
    sources.push({ type: 'config-file', path: configPath })
  }

  if (exists(join(projectPath, 'e2e')) || exists(join(projectPath, 'tests'))) {
    confidence += 5
    sources.push({ type: 'directory', path: 'e2e/ or tests/' })
  }

  const e2eScript = pkg?.scripts?.['e2e'] ?? pkg?.scripts?.['test:e2e'] ?? ''
  if (e2eScript.includes('playwright')) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'scripts.e2e or scripts.test:e2e' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'playwright',
    name: 'Playwright',
    type: 'e2e',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
