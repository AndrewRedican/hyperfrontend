/**
 * Tech stack detection for frontend, backend, build tools, testing, linting, and monorepo tools.
 *
 * @module @hyperfrontend/project-scope/tech
 */
import type { PackageJson } from '../project/package'
import type { BackendDetection } from './backend'
import type { BuildToolDetection } from './build'
import type { FrameworkDetection } from './frontend'
import type { LegacyFrameworkDetection } from './legacy'
import type { LintingToolDetection } from './linting'
import type { MonorepoDetection } from './monorepo'
import type { TestingFrameworkDetection } from './testing'
import type { TypeSystemDetection } from './types'
import { createCache } from '../core/cache'
import { createScopedLogger } from '../core/logger'
import { readPackageJsonIfExists } from '../project/package'
import { backendDetectors } from './backend'
import { buildToolDetectors } from './build'
import { frameworkDetectors } from './frontend'
import { legacyDetectors } from './legacy'
import { lintingDetectors } from './linting'
import { monorepoDetectors } from './monorepo'
import { testingDetectors } from './testing'
import { typeSystemDetectors } from './types'

const techLogger = createScopedLogger('project-scope:tech')

/**
 * Cache for tech detection results.
 * TTL: 60 seconds (tech stack can change during active development)
 */
const detectAllCache = createCache<string, AllDetections>({ ttl: 60000, maxSize: 50 })

export type { BackendDetection, BackendDetector } from './backend'
export type { BuildToolDetection, BuildToolDetector } from './build'
export type { FrameworkDetection, FrameworkDetector } from './frontend'
export type { LegacyFrameworkDetection, LegacyFrameworkDetector } from './legacy'
export type { LintingToolDetection, LintingToolDetector } from './linting'
export type { DetectionSource, MonorepoDetection, MonorepoDetector } from './monorepo'
export type { TestingFrameworkDetection, TestingFrameworkDetector } from './testing'
export type { TypeSystemDetection, TypeSystemDetector } from './types'
export {
  backendDetectors,
  detectBackendFrameworks,
  expressDetector,
  fastifyDetector,
  honoDetector,
  koaDetector,
  nestDetector,
} from './backend'
export {
  BABEL_CONFIG_PATTERNS,
  babelDetector,
  buildToolDetectors,
  detectBuildTools,
  esbuildDetector,
  PARCEL_CONFIG_PATTERNS,
  parcelDetector,
  ROLLUP_CONFIG_PATTERNS,
  rollupDetector,
  SWC_CONFIG_PATTERNS,
  swcDetector,
  VITE_CONFIG_PATTERNS,
  viteDetector,
  WEBPACK_CONFIG_PATTERNS,
  webpackDetector,
} from './build'
export {
  angularDetector,
  astroDetector,
  detectFrontendFrameworks,
  frameworkDetectors,
  gatsbyDetector,
  nextjsDetector,
  nuxtDetector,
  qwikDetector,
  reactDetector,
  remixDetector,
  solidDetector,
  svelteDetector,
  sveltekitDetector,
  vueDetector,
} from './frontend'
export { angularJSDetector, backboneDetector, detectLegacyFrameworks, emberDetector, jqueryDetector, legacyDetectors } from './legacy'
export {
  biomeDetector,
  detectLintingTools,
  ESLINT_CONFIG_PATTERNS,
  eslintDetector,
  lintingDetectors,
  PRETTIER_CONFIG_PATTERNS,
  prettierDetector,
  STYLELINT_CONFIG_PATTERNS,
  stylelintDetector,
} from './linting'
export {
  detectMonorepoTools,
  lernaDetector,
  monorepoDetectors,
  npmWorkspacesDetector,
  nxDetector,
  pnpmWorkspacesDetector,
  rushDetector,
  turborepoDetector,
  yarnWorkspacesDetector,
} from './monorepo'
export {
  CYPRESS_CONFIG_PATTERNS,
  cypressDetector,
  detectTestingFrameworks,
  JEST_CONFIG_PATTERNS,
  jestDetector,
  MOCHA_CONFIG_PATTERNS,
  mochaDetector,
  PLAYWRIGHT_CONFIG_PATTERNS,
  playwrightDetector,
  testingDetectors,
  VITEST_CONFIG_PATTERNS,
  vitestDetector,
} from './testing'
export { detectTypeSystems, flowDetector, jsdocDetector, typescriptDetector, typeSystemDetectors } from './types'

/**
 * All detection results from running all detectors.
 */
export interface AllDetections {
  /** Detected build tools */
  buildTools: BuildToolDetection[]
  /** Detected monorepo tools */
  monorepo: MonorepoDetection[]
  /** Detected frontend frameworks */
  frontendFrameworks: FrameworkDetection[]
  /** Detected backend frameworks */
  backendFrameworks: BackendDetection[]
  /** Detected legacy frameworks (AngularJS, Backbone, Ember, jQuery) */
  legacyFrameworks: LegacyFrameworkDetection[]
  /** Detected testing frameworks */
  testingFrameworks: TestingFrameworkDetection[]
  /** Detected type systems */
  typeSystem: TypeSystemDetection[]
  /** Detected linting tools */
  linting: LintingToolDetection[]
}

/**
 * All available detectors organized by category.
 */
export const allDetectors = {
  build: buildToolDetectors,
  monorepo: monorepoDetectors,
  frontend: frameworkDetectors,
  backend: backendDetectors,
  legacy: legacyDetectors,
  testing: testingDetectors,
  types: typeSystemDetectors,
  linting: lintingDetectors,
}

/**
 * Options for detectAll function.
 */
export interface DetectAllOptions {
  /** Pre-loaded package.json to avoid re-reading */
  packageJson?: PackageJson
  /** Skip cache lookup (force fresh detection) */
  skipCache?: boolean
}

/**
 * Check if the value is a DetectAllOptions object.
 *
 * @param value - Value to check
 * @returns True if value is DetectAllOptions
 */
function isDetectAllOptions(value: unknown): value is DetectAllOptions {
  if (typeof value !== 'object' || value === null) return false
  return 'skipCache' in value || 'packageJson' in value
}

/**
 * Run all technology detectors on a project.
 *
 * Results are cached for 60 seconds per project path to avoid
 * redundant file system operations on repeated calls.
 *
 * @param projectPath - Path to project directory
 * @param packageJsonOrOptions - Optional pre-loaded package.json or options object
 * @returns All detection results organized by category
 *
 * @example Running all tech detectors
 * ```typescript
 * import { detectAll } from '@hyperfrontend/project-scope'
 *
 * const detections = detectAll('./my-project')
 *
 * // Check frontend frameworks
 * for (const fw of detections.frontendFrameworks) {
 *   console.log(`${fw.name} v${fw.version} (${fw.confidence}% confidence)`)
 * }
 *
 * // Check build tools
 * console.log('Build tools:', detections.buildTools.map(t => t.name))
 *
 * // Check testing frameworks
 * console.log('Testing:', detections.testingFrameworks.map(t => t.name))
 * ```
 */
export function detectAll(projectPath: string, packageJsonOrOptions?: PackageJson | DetectAllOptions): AllDetections {
  const options: DetectAllOptions = isDetectAllOptions(packageJsonOrOptions) ? packageJsonOrOptions : { packageJson: packageJsonOrOptions }

  if (!options.skipCache) {
    const cached = detectAllCache.get(projectPath)
    if (cached) {
      techLogger.debug('Returning cached tech detection results', { projectPath })
      return cached
    }
  }

  const pkg = options.packageJson ?? readPackageJsonIfExists(projectPath)

  techLogger.debug('Running all tech detectors', { projectPath })

  const result = {
    buildTools: buildToolDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is BuildToolDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    monorepo: monorepoDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is MonorepoDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    frontendFrameworks: frameworkDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is FrameworkDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    backendFrameworks: backendDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is BackendDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    legacyFrameworks: legacyDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is LegacyFrameworkDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    testingFrameworks: testingDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is TestingFrameworkDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    typeSystem: typeSystemDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is TypeSystemDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
    linting: lintingDetectors
      .map((d) => d.detect(projectPath, pkg ?? undefined))
      .filter((r): r is LintingToolDetection => r !== null)
      .sort((a, b) => b.confidence - a.confidence),
  }

  techLogger.debug('Tech detection complete', {
    buildTools: result.buildTools.map((t) => t.id),
    frontendFrameworks: result.frontendFrameworks.map((f) => f.id),
    backendFrameworks: result.backendFrameworks.map((f) => f.id),
    legacyFrameworks: result.legacyFrameworks.map((f) => f.id),
    testingFrameworks: result.testingFrameworks.map((f) => f.id),
  })

  detectAllCache.set(projectPath, result)

  return result
}

/**
 * Clear the tech detection cache.
 *
 * Useful for testing or when the project files have changed.
 *
 * @example Clearing the tech detection cache
 * ```typescript
 * import { detectAll, clearTechDetectionCache } from '@hyperfrontend/project-scope'
 *
 * // Initial detection (cached)
 * const first = detectAll('./my-project')
 *
 * // After modifying package.json, clear cache to re-detect
 * clearTechDetectionCache()
 * const fresh = detectAll('./my-project')
 * ```
 */
export function clearTechDetectionCache(): void {
  detectAllCache.clear()
}
