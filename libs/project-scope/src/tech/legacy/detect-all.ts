import type { PackageJson } from '../../project/package'
import type { LegacyFrameworkDetector, LegacyFrameworkDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { angularJSDetector } from './angularjs'
import { backboneDetector } from './backbone'
import { emberDetector } from './ember'
import { jqueryDetector } from './jquery'

/** All legacy framework detectors */
export const legacyDetectors: LegacyFrameworkDetector[] = [
  { id: 'angularjs', name: 'AngularJS', category: 'legacy-frontend', detect: angularJSDetector },
  { id: 'backbone', name: 'Backbone.js', category: 'legacy-frontend', detect: backboneDetector },
  { id: 'ember', name: 'Ember.js', category: 'legacy-frontend', detect: emberDetector },
  { id: 'jquery', name: 'jQuery', category: 'legacy-frontend', detect: jqueryDetector },
]

/**
 * Detect all legacy frameworks in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected legacy frameworks, sorted by confidence
 *
 * @example
 * ```typescript
 * const results = detectLegacyFrameworks('/path/to/project', {
 *   dependencies: { jquery: '^3.6.0', backbone: '^1.4.0' },
 * })
 * // => [{ id: 'jquery', confidence: 80 }, { id: 'backbone', confidence: 70 }]
 * ```
 */
export function detectLegacyFrameworks(projectPath: string, packageJson?: PackageJson): LegacyFrameworkDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: LegacyFrameworkDetection[] = []

  for (const detector of legacyDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
