import type { PackageJson } from '../../project/package'
import type { DetectionSource } from '../shared-utils/types'
import type { TestingFrameworkDetection } from './types'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { readPackageJsonIfExists } from '../../project/package'
import { collectAllDependencies, parseVersionString, locateConfigFile } from '../shared-utils/detector-helpers'

/** Config patterns for Mocha */
export const MOCHA_CONFIG_PATTERNS = ['.mocharc.js', '.mocharc.json', '.mocharc.yaml', '.mocharc.yml', 'mocha.opts']

/**
 * Detect Mocha in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Detection result or null if not detected
 *
 * @example Detecting Mocha testing framework
 * ```typescript
 * import { mochaDetector } from '@hyperfrontend/project-scope'
 *
 * const result = mochaDetector('./my-project')
 * if (result) {
 *   console.log(`Mocha ${result.version} detected (${result.confidence}%)`)
 *   // => "Mocha 10.2.0 detected (95%)"
 * }
 * ```
 */
export function mochaDetector(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection | null {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const sources: DetectionSource[] = []
  let confidence = 0
  let version: string | undefined

  const deps = collectAllDependencies(pkg)

  if (deps['mocha']) {
    confidence += 65
    version = parseVersionString(deps['mocha'])
    sources.push({ type: 'package.json', field: 'dependencies.mocha' })
  }

  const configPath = locateConfigFile(projectPath, MOCHA_CONFIG_PATTERNS)
  if (configPath) {
    confidence += 30
    sources.push({ type: 'config-file', path: configPath })
  }

  if (deps['@types/mocha']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.@types/mocha' })
  }

  if (deps['chai']) {
    confidence += 5
    sources.push({ type: 'package.json', field: 'dependencies.chai' })
  }

  const testScript = pkg?.scripts?.['test'] ?? ''
  if (testScript.includes('mocha')) {
    confidence += 10
    sources.push({ type: 'package.json', field: 'scripts.test' })
  }

  if (confidence === 0) {
    return null
  }

  return {
    id: 'mocha',
    name: 'Mocha',
    type: 'unit',
    version,
    configPath,
    confidence: min(confidence, 100),
    detectedFrom: sources,
  }
}
