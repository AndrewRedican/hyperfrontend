import type { FrameworkInfo, TestingInfo } from '../../models'
import { createCache } from '../../core/cache'
import { createScopedLogger } from '../../core/logger'
import { readPackageJsonIfExists } from '../../project/package'
import { detectAll } from '../../tech'

const frameworkLogger = createScopedLogger('project-scope:heuristics:framework')

/**
 * Cache for framework identification results.
 * TTL: 60 seconds (frameworks are stable but can change during development)
 */
const frameworkIdCache = createCache<string, FrameworkIdentification>({ ttl: 60000, maxSize: 50 })

/**
 * Stack summary for a project.
 */
export interface StackSummary {
  /** Frontend framework IDs */
  frontend: string[]
  /** Backend framework IDs */
  backend: string[]
  /** Testing framework IDs */
  testing: string[]
  /** Build tool IDs */
  build: string[]
  /** Type system IDs */
  typeSystem: string[]
  /** Linting tool IDs */
  linting: string[]
}

/**
 * Framework identification result.
 */
export interface FrameworkIdentification {
  /** Primary framework (highest confidence) */
  primary?: FrameworkInfo
  /** Frontend frameworks */
  frontend: FrameworkInfo[]
  /** Backend frameworks */
  backend: FrameworkInfo[]
  /** Testing frameworks */
  testing: TestingInfo[]
  /** Meta-frameworks (Next.js, Nuxt, etc.) */
  metaFrameworks: FrameworkInfo[]
  /** Summary string (e.g., "React + Next.js with Jest") */
  summary: string
  /** Stack summary */
  stack: StackSummary
}

/**
 * Options for framework identification.
 */
export interface IdentifyFrameworksOptions {
  /** Minimum confidence threshold (0-100) */
  minConfidence?: number
  /** Skip cache lookup (force fresh detection) */
  skipCache?: boolean
}

/**
 * Build a human-readable summary string from detected frameworks.
 *
 * @param frontend - Frontend framework names
 * @param backend - Backend framework names
 * @param testing - Testing framework names
 * @returns Human-readable summary
 */
function buildSummary(frontend: string[], backend: string[], testing: string[]): string {
  const parts: string[] = []

  if (frontend.length > 0) {
    parts.push(frontend.join(' + '))
  }

  if (backend.length > 0) {
    if (parts.length > 0) {
      parts.push('with')
    }
    parts.push(backend.join(' + '))
  }

  if (testing.length > 0) {
    if (parts.length > 0) {
      parts.push('and')
    }
    parts.push(testing.join('/'))
  }

  return parts.length > 0 ? parts.join(' ') : 'No frameworks detected'
}

/**
 * Identify all frameworks in project.
 *
 * Runs all technology detectors and aggregates results into a comprehensive
 * framework identification with confidence scoring.
 *
 * @param projectPath - Project directory path
 * @param options - Identification options
 * @returns Framework identification result
 *
 * @example Identifying all frameworks in project
 * ```typescript
 * import { identifyFrameworks } from '@hyperfrontend/project-scope'
 *
 * const result = identifyFrameworks('./my-react-app')
 * console.log(result.summary)      // 'React + Next.js with Jest'
 * console.log(result.primary?.name) // 'React'
 * console.log(result.stack.frontend) // ['react', 'nextjs']
 * console.log(result.stack.testing)  // ['jest']
 * ```
 */
export function identifyFrameworks(projectPath: string, options?: IdentifyFrameworksOptions): FrameworkIdentification {
  frameworkLogger.debug('Identifying frameworks', { projectPath, minConfidence: options?.minConfidence ?? 10 })

  const minConfidence = options?.minConfidence ?? 10

  const cacheKey = `${projectPath}:${minConfidence}`

  if (!options?.skipCache) {
    const cached = frameworkIdCache.get(cacheKey)
    if (cached) {
      frameworkLogger.debug('Returning cached framework identification', { projectPath })
      return cached
    }
  }

  const packageJson = readPackageJsonIfExists(projectPath)

  const detections = detectAll(projectPath, packageJson ?? undefined)

  const frontendFrameworks: FrameworkInfo[] = detections.frontendFrameworks
    .filter((d) => d.confidence >= minConfidence)
    .map((d) => ({
      id: d.id,
      name: d.name,
      version: d.version,
      confidence: d.confidence,
      category: d.category === 'meta-framework' ? <const>'frontend' : <const>'frontend',
      metaFrameworks: d.metaFrameworks?.map((m) => m.id),
    }))

  const metaFrameworks: FrameworkInfo[] = []
  for (const detection of detections.frontendFrameworks) {
    if (detection.category === 'meta-framework' && detection.confidence >= minConfidence) {
      metaFrameworks.push({
        id: detection.id,
        name: detection.name,
        version: detection.version,
        confidence: detection.confidence,
        category: 'frontend',
      })
    }
    if (detection.metaFrameworks) {
      for (const meta of detection.metaFrameworks) {
        if (meta.confidence >= minConfidence && !metaFrameworks.some((m) => m.id === meta.id)) {
          metaFrameworks.push({
            id: meta.id,
            name: meta.name,
            version: meta.version,
            confidence: meta.confidence,
            category: 'frontend',
          })
        }
      }
    }
  }

  const backendFrameworks: FrameworkInfo[] = detections.backendFrameworks
    .filter((d) => d.confidence >= minConfidence)
    .map((d) => ({
      id: d.id,
      name: d.name,
      version: d.version,
      confidence: d.confidence,
      category: <const>'backend',
    }))

  const testingFrameworks: TestingInfo[] = detections.testingFrameworks
    .filter((d) => d.confidence >= minConfidence)
    .map((d) => ({
      id: d.id,
      name: d.name,
      version: d.version,
      configPath: d.configPath,
      type: d.type,
      confidence: d.confidence,
    }))

  const stack: StackSummary = {
    frontend: detections.frontendFrameworks.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
    backend: detections.backendFrameworks.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
    testing: detections.testingFrameworks.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
    build: detections.buildTools.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
    typeSystem: detections.typeSystem.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
    linting: detections.linting.filter((d) => d.confidence >= minConfidence).map((d) => d.id),
  }

  const allFrameworks: FrameworkInfo[] = [...frontendFrameworks, ...backendFrameworks]
  allFrameworks.sort((a, b) => b.confidence - a.confidence)

  const primary = allFrameworks[0]

  const summary = buildSummary(
    frontendFrameworks.map((f) => f.name),
    backendFrameworks.map((f) => f.name),
    testingFrameworks.map((f) => f.name)
  )

  frameworkLogger.debug('Framework identification complete', {
    projectPath,
    primaryFramework: primary?.name ?? 'none',
    frontendCount: frontendFrameworks.length,
    backendCount: backendFrameworks.length,
    testingCount: testingFrameworks.length,
    metaFrameworkCount: metaFrameworks.length,
    summary,
  })

  const result: FrameworkIdentification = {
    primary,
    frontend: frontendFrameworks,
    backend: backendFrameworks,
    testing: testingFrameworks,
    metaFrameworks,
    summary,
    stack,
  }

  frameworkIdCache.set(cacheKey, result)

  return result
}

/**
 * Clear the framework identification cache.
 *
 * Useful for testing or when the project files have changed.
 *
 * @example Clearing the framework cache
 * ```typescript
 * import { clearFrameworkIdentificationCache } from '@hyperfrontend/project-scope'
 *
 * // Reset cache before re-identifying frameworks
 * clearFrameworkIdentificationCache()
 * ```
 */
export function clearFrameworkIdentificationCache(): void {
  frameworkIdCache.clear()
}

/**
 * Check if a project uses a specific framework.
 *
 * @param projectPath - Project directory path
 * @param frameworkId - Framework identifier to check
 * @param minConfidence - Minimum confidence threshold (default: 50)
 * @returns True if the framework is detected with sufficient confidence
 *
 * @example Checking for a specific framework
 * ```typescript
 * import { usesFramework } from '@hyperfrontend/project-scope'
 *
 * if (usesFramework('/path/to/project', 'react', 70)) {
 *   console.log('Project uses React with high confidence')
 * }
 * ```
 */
export function usesFramework(projectPath: string, frameworkId: string, minConfidence = 50): boolean {
  const identification = identifyFrameworks(projectPath, { minConfidence })

  const allFrameworks = [...identification.frontend, ...identification.backend, ...identification.metaFrameworks]

  return allFrameworks.some((f) => f.id === frameworkId && f.confidence >= minConfidence)
}
