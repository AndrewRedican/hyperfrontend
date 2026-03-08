import type { ProjectType } from '../../models'
import { join } from 'node:path'
import { parse as jsonParse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, readFileIfExists } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { readPackageJsonIfExists } from '../../project/package'
import { detectAll } from '../../tech'

const projectTypeLogger = createScopedLogger('project-scope:heuristics:project-type')

/**
 * Type evidence for detection.
 */
export interface TypeEvidence {
  /** Evidence factor */
  factor: string
  /** Confidence contribution */
  confidence: number
  /** Description */
  description: string
}

/**
 * Project type detection result.
 */
export interface ProjectTypeDetection {
  /** Primary project type */
  type: ProjectType
  /** Secondary types */
  secondaryTypes: ProjectType[]
  /** Detection confidence (0-100) */
  confidence: number
  /** Evidence collected */
  evidence: TypeEvidence[]
}

/**
 * Options for project type detection.
 */
export interface DetectProjectTypeOptions {
  /** Skip technology detection (faster but less accurate) */
  skipTechDetection?: boolean
}

/**
 * Detect the type of a project based on its structure and configuration.
 *
 * Uses multiple heuristics including:
 * - Package name patterns
 * - Exports/main/module fields
 * - Binary (bin) field
 * - Entry point patterns
 * - Testing framework presence
 * - Directory structure
 * - Framework detection
 * - NX project type field
 *
 * @param projectPath - Project directory path
 * @param options - Detection options
 * @returns Project type detection result with confidence score
 *
 * @example
 * ```typescript
 * import { detectProjectType } from '@hyperfrontend/project-scope'
 *
 * const result = detectProjectType('./my-lib')
 * console.log(result.type)       // 'library' | 'application' | 'e2e' | 'tool' | 'plugin'
 * console.log(result.confidence) // 85
 * console.log(result.evidence)   // [{ factor: 'exports', confidence: 20, ... }]
 * ```
 */
export function detectProjectType(projectPath: string, options?: DetectProjectTypeOptions): ProjectTypeDetection {
  projectTypeLogger.debug('Detecting project type', { projectPath, skipTechDetection: options?.skipTechDetection })

  const evidence: TypeEvidence[] = []
  const typeScores: Record<ProjectType, number> = {
    application: 0,
    library: 0,
    e2e: 0,
    tool: 0,
    plugin: 0,
    unknown: 0,
  }

  const packageJson = readPackageJsonIfExists(projectPath)

  if (packageJson?.name) {
    const name = packageJson.name

    if (name.includes('-e2e') || name.endsWith('-test') || name.includes('e2e-')) {
      typeScores.e2e += 30
      evidence.push({ factor: 'name-pattern', confidence: 30, description: `Name suggests e2e: ${name}` })
    }

    if (name.includes('-plugin') || name.includes('/plugin-')) {
      typeScores.plugin += 30
      evidence.push({ factor: 'name-pattern', confidence: 30, description: `Name suggests plugin: ${name}` })
    }

    if (name.includes('-cli') || name.includes('/cli') || name.endsWith('-cli')) {
      typeScores.tool += 25
      evidence.push({ factor: 'name-pattern', confidence: 25, description: `Name suggests CLI tool: ${name}` })
    }

    if (name.includes('-lib') || name.includes('/lib-') || name.includes('-utils') || name.includes('/utils')) {
      typeScores.library += 15
      evidence.push({ factor: 'name-pattern', confidence: 15, description: `Name suggests library: ${name}` })
    }

    if (name.includes('-app') || name.includes('/app-') || name.includes('-web') || name.includes('-frontend')) {
      typeScores.application += 15
      evidence.push({ factor: 'name-pattern', confidence: 15, description: `Name suggests application: ${name}` })
    }
  }

  if (packageJson?.exports || packageJson?.main || packageJson?.module) {
    typeScores.library += 20
    evidence.push({ factor: 'exports', confidence: 20, description: 'Has exports/main/module field' })
  }

  if (packageJson && 'bin' in packageJson) {
    typeScores.tool += 40
    evidence.push({ factor: 'bin-field', confidence: 40, description: 'Has bin field (CLI executable)' })
  }

  const serverEntryPatterns = ['src/server.ts', 'src/server.js', 'server.ts', 'server.js', 'src/main.ts', 'src/app.ts']
  const indexEntryPatterns = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'lib/index.ts', 'lib/index.js']

  const hasServerEntry = serverEntryPatterns.some((p) => exists(join(projectPath, p)))
  const hasIndexEntry = indexEntryPatterns.some((p) => exists(join(projectPath, p)))

  if (hasServerEntry) {
    typeScores.application += 30
    evidence.push({ factor: 'entry-point', confidence: 30, description: 'Has server/app entry point' })
  }

  if (hasIndexEntry && !hasServerEntry) {
    typeScores.library += 20
    evidence.push({ factor: 'entry-point', confidence: 20, description: 'Has library-style index entry' })
  }

  if (options?.skipTechDetection !== true) {
    const techDetections = detectAll(projectPath, packageJson ?? undefined)

    const e2eFrameworkIds = ['cypress', 'playwright', 'puppeteer', 'webdriverio']
    const hasE2EFramework = techDetections.testingFrameworks.some((t) => e2eFrameworkIds.includes(t.id))

    if (hasE2EFramework) {
      typeScores.e2e += 25
      evidence.push({ factor: 'e2e-framework', confidence: 25, description: 'Has E2E testing framework' })
    }

    const unitFrameworkIds = ['jest', 'vitest', 'mocha']
    const hasUnitFramework = techDetections.testingFrameworks.some((t) => unitFrameworkIds.includes(t.id) && t.type === 'unit')
    if (hasUnitFramework && !hasE2EFramework) {
      typeScores.library += 10
      evidence.push({ factor: 'unit-framework', confidence: 10, description: 'Has unit testing framework' })
    }

    const hasFrontendFramework = techDetections.frontendFrameworks.length > 0
    const hasBackendFramework = techDetections.backendFrameworks.length > 0

    if (hasFrontendFramework || hasBackendFramework) {
      typeScores.application += 20
      const frameworks = [
        ...techDetections.frontendFrameworks.map((f) => f.name),
        ...techDetections.backendFrameworks.map((f) => f.name),
      ].join(', ')
      evidence.push({ factor: 'framework', confidence: 20, description: `Uses application framework: ${frameworks}` })
    }
  }

  const hasPublicDir = exists(join(projectPath, 'public'))
  const hasStaticDir = exists(join(projectPath, 'static'))
  const hasAssetsDir = exists(join(projectPath, 'assets'))
  const hasPagesDir = exists(join(projectPath, 'pages')) || exists(join(projectPath, 'src', 'pages'))
  const hasAppDir = exists(join(projectPath, 'app')) || exists(join(projectPath, 'src', 'app'))
  const hasLibDir = exists(join(projectPath, 'lib')) || exists(join(projectPath, 'src', 'lib'))
  const hasCypressDir = exists(join(projectPath, 'cypress'))
  const hasE2EDir = exists(join(projectPath, 'e2e'))

  if (hasPublicDir || hasStaticDir || hasAssetsDir) {
    typeScores.application += 15
    evidence.push({ factor: 'structure', confidence: 15, description: 'Has public/static/assets directory' })
  }

  if (hasPagesDir || hasAppDir) {
    typeScores.application += 15
    evidence.push({ factor: 'structure', confidence: 15, description: 'Has pages/app directory' })
  }

  if (hasLibDir && !hasPagesDir && !hasAppDir) {
    typeScores.library += 10
    evidence.push({ factor: 'structure', confidence: 10, description: 'Has lib directory' })
  }

  if (hasCypressDir || hasE2EDir) {
    typeScores.e2e += 20
    evidence.push({ factor: 'structure', confidence: 20, description: 'Has cypress/e2e directory' })
  }

  const projectJsonPath = join(projectPath, 'project.json')
  const projectJsonContent = readFileIfExists(projectJsonPath)
  if (projectJsonContent) {
    try {
      const projectJson = jsonParse(projectJsonContent)

      if (projectJson.projectType) {
        const nxType = projectJson.projectType === 'library' ? 'library' : 'application'
        typeScores[nxType] += 50
        evidence.push({ factor: 'nx-project-type', confidence: 50, description: `NX project type: ${projectJson.projectType}` })
      }

      const tags: string[] = projectJson.tags ?? []
      if (tags.some((t: string) => t.includes('e2e'))) {
        typeScores.e2e += 15
        evidence.push({ factor: 'nx-tags', confidence: 15, description: 'NX tags contain e2e' })
      }
      if (tags.some((t: string) => t.includes('util') || t.includes('lib'))) {
        typeScores.library += 10
        evidence.push({ factor: 'nx-tags', confidence: 10, description: 'NX tags suggest library' })
      }
    } catch {
      // Ignore parse errors
    }
  }

  const hasNextConfig = exists(join(projectPath, 'next.config.js')) || exists(join(projectPath, 'next.config.mjs'))
  const hasAngularJson = exists(join(projectPath, 'angular.json'))
  const hasDockerfile = exists(join(projectPath, 'Dockerfile'))

  if (hasNextConfig || hasAngularJson) {
    typeScores.application += 25
    evidence.push({ factor: 'framework-config', confidence: 25, description: 'Has framework config (Next.js/Angular)' })
  }

  if (hasDockerfile) {
    typeScores.application += 10
    evidence.push({ factor: 'docker', confidence: 10, description: 'Has Dockerfile' })
  }

  const sortedTypes = entries(typeScores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0)

  const [primaryType, primaryScore] = sortedTypes[0] ?? ['unknown', 0]
  const secondaryTypes = sortedTypes.slice(1).map(([type]) => <ProjectType>type)

  const totalScore = values(typeScores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? min(round((primaryScore / totalScore) * 100), 100) : 0

  projectTypeLogger.debug('Project type detection complete', {
    projectPath,
    detectedType: <ProjectType>primaryType,
    confidence,
    evidenceCount: evidence.length,
    secondaryTypes,
  })

  return {
    type: <ProjectType>primaryType,
    secondaryTypes,
    confidence,
    evidence,
  }
}
