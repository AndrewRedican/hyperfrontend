import type { PackageJson } from '../../project/package'
import type { LintingToolDetector, LintingToolDetection } from './types'
import { readPackageJsonIfExists } from '../../project/package'
import { biomeDetector } from './biome'
import { eslintDetector } from './eslint'
import { prettierDetector } from './prettier'
import { stylelintDetector } from './stylelint'

/** All linting tool detectors */
export const lintingDetectors: LintingToolDetector[] = [
  { id: 'eslint', name: 'ESLint', detect: eslintDetector },
  { id: 'prettier', name: 'Prettier', detect: prettierDetector },
  { id: 'stylelint', name: 'Stylelint', detect: stylelintDetector },
  { id: 'biome', name: 'Biome', detect: biomeDetector },
]

/**
 * Detect all linting tools in project.
 *
 * @param projectPath - Project directory path
 * @param packageJson - Optional pre-loaded package.json
 * @returns Array of detected linting tools, sorted by confidence
 */
export function detectLintingTools(projectPath: string, packageJson?: PackageJson): LintingToolDetection[] {
  const pkg = packageJson ?? readPackageJsonIfExists(projectPath)
  const results: LintingToolDetection[] = []

  for (const detector of lintingDetectors) {
    const detection = detector.detect(projectPath, pkg ?? undefined)
    if (detection) {
      results.push(detection)
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
