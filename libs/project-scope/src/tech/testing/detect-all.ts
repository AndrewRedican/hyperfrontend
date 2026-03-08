import type { PackageJson } from '../../project/package'
import type { TestingFrameworkDetector, TestingFrameworkDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { cypressDetector } from './cypress'
import { jestDetector } from './jest'
import { mochaDetector } from './mocha'
import { playwrightDetector } from './playwright'
import { vitestDetector } from './vitest'

/** All testing framework detectors */
export const testingDetectors: TestingFrameworkDetector[] = [
  { id: 'jest', name: 'Jest', testType: 'unit', detect: jestDetector },
  { id: 'vitest', name: 'Vitest', testType: 'unit', detect: vitestDetector },
  { id: 'mocha', name: 'Mocha', testType: 'unit', detect: mochaDetector },
  { id: 'cypress', name: 'Cypress', testType: 'e2e', detect: cypressDetector },
  { id: 'playwright', name: 'Playwright', testType: 'e2e', detect: playwrightDetector },
]

/**
 * Detect all testing frameworks in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected testing frameworks, sorted by confidence
 */
export function detectTestingFrameworks(projectPath: string, packageJson?: PackageJson): TestingFrameworkDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: TestingFrameworkDetection[] = []

  for (const detector of testingDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
