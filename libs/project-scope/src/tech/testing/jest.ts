import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { TestingFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Jest */
export const JEST_CONFIG_PATTERNS = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json']

/**
 * Detect Jest in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example
 * ```typescript
 * import { jestDetector } from '@hyperfrontend/project-scope'
 *
 * const result = jestDetector('./my-project')
 * if (result) {
 *   console.log(`Jest ${result.version} detected`)
 *   console.log('Sources:', result.detectedFrom.map(s => s.type))
 *   // => "Sources: ['package.json', 'config-file']"
 * }
 * ```
 */
export function jestDetector(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['jest']) {
    confidence += 60
    version = parseVersionString(deps['jest'])
    sources.push({ type: 'package.json', field: 'dependencies.jest' })
  }

  const configPath = locateConfigFile(projectPath, JEST_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 30
    sources.push({ type: 'config-file', path: configPath })
  }

  if (pkg && 'jest' in pkg) {
    confidence += 20
    sources.push({ type: 'package.json', field: 'jest' })
  }

  const testScript = pkg?.scripts?.['test'] ?? ''
  if (testScript.includes('jest')) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'scripts.test' })
  }

  if (deps['@types/jest']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.@types/jest' })
  }

  if (deps['ts-jest']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.ts-jest' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'jest',
    name: 'Jest',
    type: 'unit',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
