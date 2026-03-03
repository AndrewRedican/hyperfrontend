# Layer 4: Heuristics Engine

> **Document**: 06-layers-heuristics.md
> **Library**: `@hyperfrontend/project-scope`
> **Layer**: Intelligent Detection and Inference

---

## Overview

Layer 4 is the intelligence layer that synthesizes information from all lower layers to provide comprehensive project understanding. It implements:

- Project type classification
- Framework identification with confidence scoring
- Entry point discovery
- Dependency relationship mapping
- Configuration inference

---

## Design Principles

1. **Composite Detection**: Combine multiple signals for accurate classification
2. **Confidence Scoring**: Express uncertainty in detection results
3. **Graceful Partial Results**: Return what can be determined even on failures
4. **Caching**: Cache expensive computations

---

## Module: `heuristics/project-type`

### Project Type Detection

```typescript
// heuristics/project-type/detect.ts
import { detectAll } from '../../tech'
import { readPackageJson, readPackageJsonIfExists } from '../../project/package'
import { detectConfigs } from '../../project/config'
import { findFiles } from '../../project/traversal'
import type { ProjectType, ProjectTypeDetection, Logger } from '../../models'

/**
 * Project type classification result.
 */
export interface ProjectTypeDetection {
  /** Primary project type */
  type: ProjectType
  /** Secondary classifications */
  secondaryTypes: ProjectType[]
  /** Confidence score 0-100 */
  confidence: number
  /** Evidence supporting the classification */
  evidence: TypeEvidence[]
}

/**
 * Evidence for type classification.
 */
export interface TypeEvidence {
  factor: string
  weight: number
  details: string
}

/**
 * Detect project type using multiple heuristics.
 */
export function detectProjectType(projectPath: string, options?: DetectOptions): ProjectTypeDetection {
  const evidence: TypeEvidence[] = []
  const typeScores: Record<ProjectType, number> = {
    application: 0,
    library: 0,
    e2e: 0,
    tool: 0,
    plugin: 0,
    unknown: 0,
  }

  // Read package.json
  const packageJson = readPackageJsonIfExists(projectPath)

  // Factor 1: Package name patterns
  if (packageJson?.name) {
    const name = packageJson.name

    if (name.includes('-e2e') || name.endsWith('-test') || name.includes('e2e-')) {
      typeScores.e2e += 30
      evidence.push({ factor: 'name-pattern', weight: 30, details: `Name suggests e2e: ${name}` })
    }

    if (name.includes('-plugin') || name.includes('/plugin-')) {
      typeScores.plugin += 30
      evidence.push({ factor: 'name-pattern', weight: 30, details: `Name suggests plugin: ${name}` })
    }

    if (name.includes('-cli') || name.includes('/cli')) {
      typeScores.tool += 25
      evidence.push({ factor: 'name-pattern', weight: 25, details: `Name suggests CLI tool: ${name}` })
    }
  }

  // Factor 2: Exports field (library indicator)
  if (packageJson?.exports || packageJson?.main || packageJson?.module) {
    typeScores.library += 20
    evidence.push({ factor: 'exports', weight: 20, details: 'Has exports/main/module field' })
  }

  // Factor 3: Bin field (tool/CLI indicator)
  if (packageJson && 'bin' in packageJson) {
    typeScores.tool += 40
    evidence.push({ factor: 'bin-field', weight: 40, details: 'Has bin field (CLI)' })
  }

  // Factor 4: Entry point patterns
  const hasServerEntry = findFiles(projectPath, ['src/server.ts', 'src/main.ts', 'src/app.ts', 'server.ts'], { maxDepth: 2 }).length > 0
  const hasIndexEntry = findFiles(projectPath, ['src/index.ts', 'index.ts', 'lib/index.ts'], { maxDepth: 2 }).length > 0

  if (hasServerEntry) {
    typeScores.application += 30
    evidence.push({ factor: 'entry-point', weight: 30, details: 'Has server/app entry point' })
  }

  if (hasIndexEntry && !hasServerEntry) {
    typeScores.library += 20
    evidence.push({ factor: 'entry-point', weight: 20, details: 'Has library-style index entry' })
  }

  // Factor 5: Testing framework presence
  const techDetections = detectAll(projectPath, packageJson ?? undefined)

  const hasE2EFramework = techDetections.testingFrameworks.some((t) => ['cypress', 'playwright', 'puppeteer', 'webdriverio'].includes(t.id))

  if (hasE2EFramework) {
    typeScores.e2e += 25
    evidence.push({ factor: 'e2e-framework', weight: 25, details: 'Has E2E testing framework' })
  }

  // Factor 6: Directory structure
  const hasAppsDir = existsSync(join(projectPath, 'apps'))
  const hasLibsDir = existsSync(join(projectPath, 'libs'))
  const hasPublicDir = existsSync(join(projectPath, 'public'))
  const hasSrcDir = existsSync(join(projectPath, 'src'))

  if (hasPublicDir) {
    typeScores.application += 15
    evidence.push({ factor: 'structure', weight: 15, details: 'Has public directory' })
  }

  // Factor 7: Framework detection
  const hasFrontendFramework = techDetections.frontendFrameworks.length > 0
  const hasBackendFramework = techDetections.backendFrameworks.length > 0

  if (hasFrontendFramework || hasBackendFramework) {
    typeScores.application += 20
    evidence.push({ factor: 'framework', weight: 20, details: 'Uses application framework' })
  }

  // Factor 8: Project.json type field (NX)
  const projectJson = readNxProjectJson(projectPath)
  if (projectJson?.projectType) {
    const nxType = projectJson.projectType === 'library' ? 'library' : 'application'
    typeScores[nxType] += 50
    evidence.push({ factor: 'nx-project-type', weight: 50, details: `NX project type: ${nxType}` })
  }

  // Determine winner
  const sortedTypes = Object.entries(typeScores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0)

  const [primaryType, primaryScore] = sortedTypes[0] ?? ['unknown', 0]
  const secondaryTypes = sortedTypes.slice(1).map(([type]) => type as ProjectType)

  // Calculate confidence
  const totalScore = Object.values(typeScores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? Math.min(Math.round((primaryScore / totalScore) * 100), 100) : 0

  return {
    type: primaryType as ProjectType,
    secondaryTypes,
    confidence,
    evidence,
  }
}
```

---

## Module: `heuristics/framework`

### Framework Identification

```typescript
// heuristics/framework/identify.ts
import { detectAll } from '../../tech'
import { readPackageJsonIfExists } from '../../project/package'
import type { FrameworkInfo, FrameworkId, Logger } from '../../models'

/**
 * Comprehensive framework identification result.
 */
export interface FrameworkIdentification {
  /** All detected frameworks */
  frameworks: FrameworkInfo[]
  /** Primary framework (highest confidence) */
  primary?: FrameworkInfo
  /** Tech stack summary */
  stack: StackSummary
}

/**
 * Technology stack summary.
 */
export interface StackSummary {
  /** Frontend frameworks */
  frontend: FrameworkId[]
  /** Backend frameworks */
  backend: FrameworkId[]
  /** Testing frameworks */
  testing: FrameworkId[]
  /** Build tools */
  build: string[]
  /** Type system */
  typeSystem: string[]
}

/**
 * Identify all frameworks in a project.
 */
export function identifyFrameworks(projectPath: string, options?: { minConfidence?: number }): FrameworkIdentification {
  const minConfidence = options?.minConfidence ?? 10
  const packageJson = readPackageJsonIfExists(projectPath)

  // Run all detectors
  const detections = detectAll(projectPath, packageJson ?? undefined)

  // Collect all framework detections
  const allFrameworks: FrameworkInfo[] = [
    ...detections.frontendFrameworks.map((d) => ({
      id: d.id as FrameworkId,
      name: d.name,
      version: d.version,
      category: 'frontend' as const,
      confidence: d.confidence,
      detectedFrom: d.detectedFrom,
      metaFrameworks: d.metaFrameworks,
    })),
    ...detections.backendFrameworks.map((d) => ({
      id: d.id as FrameworkId,
      name: d.name,
      version: d.version,
      category: 'backend' as const,
      confidence: d.confidence,
      detectedFrom: d.detectedFrom,
    })),
    ...detections.testingFrameworks.map((d) => ({
      id: d.id as FrameworkId,
      name: d.name,
      version: d.version,
      category: 'testing' as const,
      confidence: d.confidence,
      detectedFrom: d.detectedFrom,
    })),
  ]

  // Filter by confidence
  const filteredFrameworks = allFrameworks.filter((f) => f.confidence >= minConfidence)

  // Sort by confidence
  const sortedFrameworks = filteredFrameworks.sort((a, b) => b.confidence - a.confidence)

  // Build stack summary
  const stack: StackSummary = {
    frontend: detections.frontendFrameworks.map((d) => d.id as FrameworkId),
    backend: detections.backendFrameworks.map((d) => d.id as FrameworkId),
    testing: detections.testingFrameworks.map((d) => d.id as string),
    build: detections.buildTools.map((d) => d.id),
    typeSystem: detections.typeSystem.map((d) => d.id),
  }

  return {
    frameworks: sortedFrameworks,
    primary: sortedFrameworks[0],
    stack,
  }
}

/**
 * Check if project uses specific framework.
 */
export function usesFramework(projectPath: string, frameworkId: FrameworkId, minConfidence: number = 50): boolean {
  const identification = identifyFrameworks(projectPath, { minConfidence })
  return identification.frameworks.some((f) => f.id === frameworkId)
}
```

---

## Module: `heuristics/entry-points`

### Entry Point Discovery

```typescript
// heuristics/entry-points/discover.ts
import { findFiles } from '../../project/traversal'
import { readPackageJsonIfExists } from '../../project/package'
import { parseConfig } from '../../project/config'
import { identifyFrameworks } from '../framework'
import type { EntryPointInfo, Logger } from '../../models'

/**
 * Entry point information.
 */
export interface EntryPointInfo {
  /** File path relative to project root */
  path: string
  /** Type of entry point */
  type: EntryPointType
  /** Confidence that this is an entry point */
  confidence: number
  /** How it was discovered */
  source: EntryPointSource
}

/**
 * Entry point types.
 */
export type EntryPointType =
  | 'main' // Main entry (index.ts)
  | 'bin' // CLI binary
  | 'server' // Server entry
  | 'app' // Application bootstrap
  | 'test' // Test entry
  | 'config' // Configuration entry
  | 'route' // Route/page entry (Next.js, etc.)
  | 'worker' // Web worker entry
  | 'export' // Named export entry

/**
 * How entry point was discovered.
 */
export type EntryPointSource =
  | { type: 'package.json'; field: string }
  | { type: 'tsconfig'; field: string }
  | { type: 'build-config'; tool: string }
  | { type: 'convention'; pattern: string }
  | { type: 'framework'; framework: string }

/**
 * Discover all entry points in a project.
 */
export function discoverEntryPoints(projectPath: string, options?: DiscoverOptions): EntryPointInfo[] {
  const entryPoints: EntryPointInfo[] = []
  const packageJson = readPackageJsonIfExists(projectPath)

  // Source 1: package.json fields
  if (packageJson) {
    // main field
    if (packageJson.main) {
      entryPoints.push({
        path: packageJson.main,
        type: 'main',
        confidence: 100,
        source: { type: 'package.json', field: 'main' },
      })
    }

    // module field (ESM entry)
    if (packageJson.module) {
      entryPoints.push({
        path: packageJson.module,
        type: 'main',
        confidence: 100,
        source: { type: 'package.json', field: 'module' },
      })
    }

    // bin field
    if (packageJson.bin) {
      const bins =
        typeof packageJson.bin === 'string' ? { [packageJson.name]: packageJson.bin } : (packageJson.bin as Record<string, string>)

      for (const [name, path] of Object.entries(bins)) {
        entryPoints.push({
          path,
          type: 'bin',
          confidence: 100,
          source: { type: 'package.json', field: `bin.${name}` },
        })
      }
    }

    // exports field
    if (packageJson.exports) {
      const exports = packageJson.exports as Record<string, unknown>
      discoverFromExports(exports, entryPoints)
    }
  }

  // Source 2: Convention-based discovery
  const conventionEntries = [
    { pattern: 'src/index.ts', type: 'main' as const, confidence: 90 },
    { pattern: 'src/index.js', type: 'main' as const, confidence: 90 },
    { pattern: 'src/main.ts', type: 'app' as const, confidence: 85 },
    { pattern: 'src/main.tsx', type: 'app' as const, confidence: 85 },
    { pattern: 'src/app.ts', type: 'app' as const, confidence: 80 },
    { pattern: 'src/server.ts', type: 'server' as const, confidence: 85 },
    { pattern: 'src/server.js', type: 'server' as const, confidence: 85 },
    { pattern: 'index.ts', type: 'main' as const, confidence: 85 },
    { pattern: 'index.js', type: 'main' as const, confidence: 85 },
    { pattern: 'lib/index.ts', type: 'main' as const, confidence: 80 },
  ]

  for (const entry of conventionEntries) {
    const files = findFiles(projectPath, entry.pattern, { maxDepth: 3 })
    for (const file of files) {
      // Avoid duplicates
      if (!entryPoints.some((e) => e.path === file)) {
        entryPoints.push({
          path: file,
          type: entry.type,
          confidence: entry.confidence,
          source: { type: 'convention', pattern: entry.pattern },
        })
      }
    }
  }

  // Source 3: Framework-specific entries
  const frameworks = identifyFrameworks(projectPath)

  // Next.js pages/app directory
  if (frameworks.stack.frontend.includes('nextjs')) {
    const nextEntries = findFiles(projectPath, ['pages/**/*.tsx', 'app/**/*.tsx'], { maxDepth: 5 })
    for (const file of nextEntries) {
      if (!file.includes('_app') && !file.includes('_document')) {
        entryPoints.push({
          path: file,
          type: 'route',
          confidence: 80,
          source: { type: 'framework', framework: 'nextjs' },
        })
      }
    }
  }

  // Angular components
  if (frameworks.stack.frontend.includes('angular')) {
    const angularEntries = findFiles(projectPath, 'src/main.ts', { maxDepth: 2 })
    for (const file of angularEntries) {
      entryPoints.push({
        path: file,
        type: 'app',
        confidence: 95,
        source: { type: 'framework', framework: 'angular' },
      })
    }
  }

  // Sort by confidence
  return entryPoints.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Extract entry points from exports field.
 */
function discoverFromExports(exports: Record<string, unknown>, entryPoints: EntryPointInfo[]): void {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === 'string') {
      entryPoints.push({
        path: value,
        type: key === '.' ? 'main' : 'export',
        confidence: 100,
        source: { type: 'package.json', field: `exports["${key}"]` },
      })
    } else if (typeof value === 'object' && value !== null) {
      // Handle conditional exports
      const conditions = value as Record<string, string>
      const mainPath = conditions['import'] ?? conditions['require'] ?? conditions['default']
      if (typeof mainPath === 'string') {
        entryPoints.push({
          path: mainPath,
          type: key === '.' ? 'main' : 'export',
          confidence: 100,
          source: { type: 'package.json', field: `exports["${key}"]` },
        })
      }
    }
  }
}
```

---

## Module: `heuristics/dependencies`

### Dependency Graph Building

```typescript
// heuristics/dependencies/graph.ts
import { walkDirectory, findFiles } from '../../project/traversal'
import { readPackageJsonIfExists } from '../../project/package'
import { parseSourceFile, queryCode } from '../../ast'
import type { DependencyGraph, DependencyNode, DependencyEdge, CircularDependency, Logger } from '../../models'

/**
 * Build complete dependency graph for workspace.
 */
export function buildDependencyGraph(workspacePath: string, options?: GraphBuildOptions): DependencyGraph {
  const nodes: Record<string, DependencyNode> = {}
  const edges: DependencyEdge[] = []

  // Step 1: Discover all projects
  const projects = discoverProjects(workspacePath)

  // Step 2: Create nodes for each project
  for (const project of projects) {
    const packageJson = readPackageJsonIfExists(project.path)

    nodes[project.name] = {
      name: project.name,
      root: project.root,
      type: project.type,
      dependencies: [],
      dependents: [],
      externalDependencies: extractExternalDeps(packageJson),
    }
  }

  // Step 3: Analyze imports to build edges
  if (options?.analyzeSourceFiles !== false) {
    for (const project of projects) {
      const imports = analyzeProjectImports(project.path, projects)

      for (const imp of imports) {
        const edge: DependencyEdge = {
          source: project.name,
          target: imp.targetProject,
          type: imp.isDynamic ? 'dynamic' : 'static',
          sources: imp.sources,
        }

        edges.push(edge)

        // Update node dependencies/dependents
        nodes[project.name].dependencies.push(imp.targetProject)
        if (nodes[imp.targetProject]) {
          nodes[imp.targetProject].dependents.push(project.name)
        }
      }
    }
  }

  // Step 4: Add implicit dependencies (from project.json, package.json)
  for (const project of projects) {
    const implicitDeps = getImplicitDependencies(project.path)

    for (const dep of implicitDeps) {
      if (!nodes[project.name].dependencies.includes(dep)) {
        edges.push({
          source: project.name,
          target: dep,
          type: 'implicit',
          sources: [{ filePath: 'project.json', reference: 'implicitDependencies' }],
        })

        nodes[project.name].dependencies.push(dep)
        if (nodes[dep]) {
          nodes[dep].dependents.push(project.name)
        }
      }
    }
  }

  // Step 5: Find roots and leaves
  const roots = Object.keys(nodes).filter((n) => nodes[n].dependents.length === 0)
  const leaves = Object.keys(nodes).filter((n) => nodes[n].dependencies.length === 0)

  // Step 6: Detect cycles
  const cycles = findCircularDependencies(nodes, edges)

  return {
    nodes,
    edges,
    roots,
    leaves,
    cycles,
  }
}

/**
 * Find circular dependencies using DFS.
 */
export function findCircularDependencies(nodes: Record<string, DependencyNode>, edges: DependencyEdge[]): CircularDependency[] {
  const cycles: CircularDependency[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): void {
    if (recursionStack.has(node)) {
      // Found cycle
      const cycleStart = path.indexOf(node)
      const chain = [...path.slice(cycleStart), node]

      // Determine severity (error if involves production deps)
      const involvesProdDeps = chain.some((n) => {
        const nodeData = nodes[n]
        return nodeData?.externalDependencies.some((d) => d.type === 'production')
      })

      cycles.push({
        chain,
        severity: involvesProdDeps ? 'error' : 'warning',
      })
      return
    }

    if (visited.has(node)) {
      return
    }

    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const nodeData = nodes[node]
    if (nodeData) {
      for (const dep of nodeData.dependencies) {
        dfs(dep)
      }
    }

    path.pop()
    recursionStack.delete(node)
  }

  for (const node of Object.keys(nodes)) {
    if (!visited.has(node)) {
      dfs(node)
    }
  }

  return cycles
}

/**
 * Analyze imports in a project to find dependencies.
 */
function analyzeProjectImports(projectPath: string, allProjects: ProjectInfo[]): ImportAnalysis[] {
  const imports: ImportAnalysis[] = []

  // Find all TypeScript/JavaScript files
  const sourceFiles = findFiles(projectPath, ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'], {
    maxDepth: 10,
    ignorePatterns: ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**'],
  })

  for (const file of sourceFiles) {
    try {
      const ast = parseSourceFile(file)
      const importNodes = queryCode(ast, { kind: 'import' })

      for (const imp of importNodes) {
        const module = imp.data.module as string

        // Check if import references another workspace project
        const targetProject = allProjects.find((p) => module.startsWith(`@${p.scope}/${p.name}`) || module.startsWith(p.name))

        if (targetProject) {
          const existing = imports.find((i) => i.targetProject === targetProject.name)

          if (existing) {
            existing.sources.push({
              filePath: file,
              line: imp.location.startLine,
              column: imp.location.startColumn,
              reference: module,
            })
          } else {
            imports.push({
              targetProject: targetProject.name,
              isDynamic: false, // Would need to check for dynamic import()
              sources: [
                {
                  filePath: file,
                  line: imp.location.startLine,
                  column: imp.location.startColumn,
                  reference: module,
                },
              ],
            })
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return imports
}
```

---

## Module: `heuristics/inference`

### Configuration Inference

```typescript
// heuristics/inference/infer.ts
import { detectConfigs, parseConfig } from '../../project/config'
import { identifyFrameworks } from '../framework'
import { discoverEntryPoints } from '../entry-points'
import type { InferredConfig, Logger } from '../../models'

/**
 * Infer missing configuration based on project analysis.
 */
export function inferConfiguration(projectPath: string, options?: InferOptions): InferredConfig {
  const frameworks = identifyFrameworks(projectPath)
  const entryPoints = discoverEntryPoints(projectPath)
  const configs = detectConfigs(projectPath)

  const inferred: InferredConfig = {
    suggestedChanges: [],
    missingConfigs: [],
    recommendations: [],
  }

  // Check for TypeScript without tsconfig
  const hasTypeScript = frameworks.stack.typeSystem.includes('typescript')
  const hasTsConfig = configs.some((c) => c.type === 'tsconfig')

  if (hasTypeScript && !hasTsConfig) {
    inferred.missingConfigs.push({
      type: 'tsconfig',
      reason: 'TypeScript dependency found but no tsconfig.json',
      suggestedContent: generateDefaultTsConfig(frameworks),
    })
  }

  // Check for build tool configuration
  if (entryPoints.length > 0 && frameworks.stack.build.length === 0) {
    inferred.recommendations.push({
      type: 'build-tool',
      message: 'No build tool detected. Consider adding one.',
      suggestions: recommendBuildTool(frameworks),
    })
  }

  // Check for testing configuration
  if (frameworks.stack.testing.length === 0) {
    inferred.recommendations.push({
      type: 'testing',
      message: 'No testing framework detected.',
      suggestions: recommendTestingFramework(frameworks),
    })
  }

  // Infer entry points if not explicit
  if (!configs.some((c) => c.type === 'package.json')) {
    const mainEntry = entryPoints.find((e) => e.type === 'main')
    if (mainEntry) {
      inferred.suggestedChanges.push({
        file: 'package.json',
        field: 'main',
        value: mainEntry.path,
        reason: 'Detected main entry point',
      })
    }
  }

  return inferred
}

/**
 * Generate default tsconfig based on detected frameworks.
 */
function generateDefaultTsConfig(frameworks: FrameworkIdentification): object {
  const hasReact = frameworks.stack.frontend.includes('react')
  const hasNodeBackend = frameworks.stack.backend.length > 0

  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      ...(hasReact && { jsx: 'react-jsx' }),
      ...(hasNodeBackend && { types: ['node'] }),
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }
}

/**
 * Recommend build tool based on detected frameworks.
 */
function recommendBuildTool(frameworks: FrameworkIdentification): string[] {
  const suggestions: string[] = []

  // Vite for modern frontend
  if (frameworks.stack.frontend.length > 0) {
    suggestions.push('vite')
  }

  // ESBuild for fast builds
  suggestions.push('esbuild')

  // Rollup for libraries
  if (!frameworks.stack.frontend.length) {
    suggestions.push('rollup')
  }

  return suggestions
}
```

---

## Caching Strategy

```typescript
// heuristics/cache.ts
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import type { AnalysisResult, DependencyGraph } from '../models'

/**
 * Cached analysis results.
 */
interface AnalysisCache {
  /** Full analysis results by path */
  analyses: Map<string, CachedAnalysis>
  /** Dependency graphs by workspace */
  graphs: Map<string, CachedGraph>
  /** Framework detections by path */
  frameworks: Map<string, CachedFrameworks>
}

interface CachedAnalysis {
  result: AnalysisResult
  timestamp: number
  hash: string
}

/**
 * Global analysis cache.
 */
const cache: AnalysisCache = {
  analyses: new Map(),
  graphs: new Map(),
  frameworks: new Map(),
}

/**
 * Get or compute analysis with caching.
 */
export function getOrComputeAnalysis(path: string, compute: () => AnalysisResult): AnalysisResult {
  const cached = cache.analyses.get(path)

  if (cached && isStillValid(cached)) {
    return cached.result
  }

  const result = compute()

  cache.analyses.set(path, {
    result,
    timestamp: Date.now(),
    hash: computeHash(path),
  })

  return result
}

/**
 * Invalidate cache for a path.
 */
export function invalidateCache(path: string): void {
  cache.analyses.delete(path)
  cache.graphs.delete(path)
  cache.frameworks.delete(path)
}

/**
 * Clear all caches.
 */
export function clearAllCaches(): void {
  cache.analyses.clear()
  cache.graphs.clear()
  cache.frameworks.clear()
}
```

---

## Related Documents

- [Layer 3: Tech Stack Utilities](./05-layers-tech-stack.md)
- [API Design](./02-api-design.md)
- [Dependencies](./12-dependencies.md)
