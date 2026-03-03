# API Design

> **Document**: 02-api-design.md
> **Library**: `@hyperfrontend/project-scope`

---

## Overview

This document specifies the complete public API surface of the `project-scope` library. The API is designed to be:

- **Intuitive**: Function names clearly describe their purpose
- **Composable**: Small functions combine for complex operations
- **Type-Safe**: Comprehensive TypeScript types for all operations
- **Consistent**: Uniform patterns across all modules

---

## Public Exports Structure

```typescript
// Main entry point: @hyperfrontend/project-scope
export {
  // Virtual File System
  createTree,
  createTreeFromDisk,
  commitChanges,
  rollbackChanges,
  listChanges,

  // Project Analysis
  analyzeProject,
  detectWorkspaceType,
  detectFrameworks,
  detectBuildTools,
  detectTestingFrameworks,

  // Configuration
  readProjectConfig,
  readPackageJson,
  readTsConfig,
  readNxJson,
  parseConfig,

  // Traversal
  walkDirectory,
  findFiles,
  findConfigs,
  searchContent,

  // Dependencies
  getDependencyGraph,
  findCircularDependencies,
  getProjectDependencies,

  // Root Detection
  findProjectRoot,
  findWorkspaceRoot,
  findNearestPackageJson,

  // Git Utilities
  getGitRoot,
  getGitBranch,
  getChangedFiles,
  isGitIgnored,

  // AST Operations
  parseSourceFile,
  queryCode,
  transformCode,

  // Platform
  getPlatformInfo,
  normalizePath,

  // Logging
  setVerbosity,
  getLogger,

  // Types
  type Tree,
  type ProjectConfig,
  type WorkspaceType,
  type FrameworkInfo,
  type DependencyGraph,
  type FileChange,
  type AnalysisResult,
  // ... more types
}
```

---

## Core Types

### Virtual File System Types

```typescript
/**
 * Virtual file system tree interface.
 * Mirrors NX devkit Tree interface for compatibility.
 */
export interface Tree {
  /** Workspace root path */
  readonly root: string

  /**
   * Read file contents.
   * @returns Buffer if no encoding specified, string otherwise
   */
  read(filePath: string): Buffer | null
  read(filePath: string, encoding: BufferEncoding): string | null

  /**
   * Write file contents.
   * Creates parent directories if they don't exist.
   */
  write(filePath: string, content: Buffer | string, options?: WriteOptions): void

  /**
   * Check if a file exists.
   * Considers pending changes in the tree.
   */
  exists(filePath: string): boolean

  /**
   * Delete a file or directory.
   */
  delete(filePath: string): void

  /**
   * Rename/move a file or directory.
   */
  rename(from: string, to: string): void

  /**
   * Check if path is a file (not directory).
   */
  isFile(filePath: string): boolean

  /**
   * List children of a directory.
   * @returns Array of child names (not full paths)
   */
  children(dirPath: string): string[]

  /**
   * Get list of pending changes.
   */
  listChanges(): FileChange[]

  /**
   * Change file permissions.
   */
  changePermissions(filePath: string, mode: number): void
}

/**
 * Write options for tree operations.
 */
export interface WriteOptions {
  /** File mode (permissions) */
  mode?: number
  /** Overwrite strategy */
  overwrite?: 'always' | 'never' | 'if-changed'
}

/**
 * Represents a pending file change.
 */
export interface FileChange {
  /** Relative path from tree root */
  path: string
  /** Type of change */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  /** New content (for CREATE/UPDATE) */
  content?: Buffer | null
  /** Previous content (for UPDATE/DELETE) */
  previousContent?: Buffer | null
}

/**
 * Options for creating a tree.
 */
export interface CreateTreeOptions {
  /** Root directory path */
  root: string
  /** Enable change logging */
  logChanges?: boolean
  /** Verbosity level */
  verbosity?: VerbosityLevel
}
```

### Project Analysis Types

```typescript
/**
 * Complete project analysis result.
 */
export interface AnalysisResult {
  /** Detected workspace type */
  workspaceType: WorkspaceType
  /** All detected projects (in monorepo) or single project info */
  projects: ProjectInfo[]
  /** Dependency graph between projects */
  dependencyGraph: DependencyGraph
  /** Detected frameworks */
  frameworks: FrameworkInfo[]
  /** Detected build tools */
  buildTools: BuildToolInfo[]
  /** Detected testing frameworks */
  testingFrameworks: TestingFrameworkInfo[]
  /** Configuration files found */
  configFiles: ConfigFileInfo[]
  /** Entry points discovered */
  entryPoints: EntryPointInfo[]
  /** Analysis metadata */
  meta: AnalysisMeta
}

/**
 * Workspace type classification.
 */
export type WorkspaceType =
  | { type: 'nx'; version: string }
  | { type: 'turborepo'; version: string }
  | { type: 'lerna'; version: string }
  | { type: 'rush' }
  | { type: 'pnpm-workspace' }
  | { type: 'npm-workspace' }
  | { type: 'yarn-workspace'; version: 'classic' | 'berry' }
  | { type: 'standalone' }
  | { type: 'unknown' }

/**
 * Individual project information.
 */
export interface ProjectInfo {
  /** Project name */
  name: string
  /** Root directory relative to workspace */
  root: string
  /** Source root (if different from root) */
  sourceRoot?: string
  /** Project type */
  type: ProjectType
  /** Tags for categorization */
  tags: string[]
  /** Detected entry points */
  entryPoints: string[]
  /** Project-specific configuration */
  config?: ProjectConfig
}

/**
 * Project type classification.
 */
export type ProjectType = 'application' | 'library' | 'e2e' | 'tool' | 'plugin' | 'unknown'

/**
 * Framework detection result.
 */
export interface FrameworkInfo {
  /** Framework identifier */
  id: FrameworkId
  /** Display name */
  name: string
  /** Detected version */
  version?: string
  /** Category */
  category: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'build'
  /** Confidence level (0-100) */
  confidence: number
  /** Detection source */
  detectedFrom: DetectionSource[]
  /** Related meta-frameworks (e.g., Next.js for React) */
  metaFrameworks?: FrameworkInfo[]
}

/**
 * Supported framework identifiers.
 */
export type FrameworkId =
  // Frontend
  | 'react'
  | 'angular'
  | 'vue'
  | 'svelte'
  | 'solid'
  | 'qwik'
  | 'astro'
  // Meta-frameworks
  | 'nextjs'
  | 'remix'
  | 'gatsby'
  | 'nuxt'
  | 'sveltekit'
  // Backend
  | 'express'
  | 'nest'
  | 'fastify'
  | 'koa'
  | 'hapi'
  // Legacy
  | 'backbone'
  | 'ember'
  | 'meteor'
  | 'angularjs'
  | 'jquery'
  // Other
  | 'electron'
  | 'tauri'

/**
 * Build tool detection result.
 */
export interface BuildToolInfo {
  /** Tool identifier */
  id: BuildToolId
  /** Display name */
  name: string
  /** Detected version */
  version?: string
  /** Configuration file path */
  configPath?: string
  /** Parsed configuration (if available) */
  config?: Record<string, unknown>
}

/**
 * Supported build tool identifiers.
 */
export type BuildToolId =
  | 'webpack'
  | 'rollup'
  | 'vite'
  | 'esbuild'
  | 'parcel'
  | 'swc'
  | 'babel'
  | 'tsc'
  | 'nx-js-tsc'
  | 'nx-webpack'
  | 'nx-vite'

/**
 * Testing framework detection result.
 */
export interface TestingFrameworkInfo {
  /** Framework identifier */
  id: TestingFrameworkId
  /** Display name */
  name: string
  /** Detected version */
  version?: string
  /** Type of testing */
  testType: 'unit' | 'integration' | 'e2e' | 'component'
  /** Configuration file path */
  configPath?: string
}

/**
 * Supported testing framework identifiers.
 */
export type TestingFrameworkId =
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'jasmine'
  | 'ava'
  | 'tap'
  | 'cypress'
  | 'playwright'
  | 'puppeteer'
  | 'webdriverio'
  | 'testing-library'
  | 'storybook'
```

### Configuration Types

```typescript
/**
 * Generic project configuration.
 */
export interface ProjectConfig {
  /** Configuration source path */
  path: string
  /** Configuration format */
  format: 'json' | 'jsonc' | 'yaml' | 'toml' | 'js' | 'ts'
  /** Parsed configuration data */
  data: Record<string, unknown>
  /** Extends from other configs */
  extends?: string[]
}

/**
 * Package.json representation.
 */
export interface PackageJson {
  name: string
  version: string
  description?: string
  main?: string
  module?: string
  types?: string
  exports?: Record<string, unknown>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  workspaces?: string[] | { packages: string[] }
  engines?: Record<string, string>
  [key: string]: unknown
}

/**
 * TSConfig representation.
 */
export interface TsConfig {
  compilerOptions?: {
    target?: string
    module?: string
    moduleResolution?: string
    lib?: string[]
    outDir?: string
    rootDir?: string
    baseUrl?: string
    paths?: Record<string, string[]>
    [key: string]: unknown
  }
  include?: string[]
  exclude?: string[]
  extends?: string
  references?: Array<{ path: string }>
  files?: string[]
}

/**
 * NX workspace configuration (nx.json).
 */
export interface NxJson {
  $schema?: string
  npmScope?: string
  affected?: {
    defaultBase?: string
  }
  tasksRunnerOptions?: Record<string, unknown>
  targetDefaults?: Record<string, unknown>
  namedInputs?: Record<string, unknown[]>
  plugins?: Array<string | { plugin: string; options?: Record<string, unknown> }>
  generators?: Record<string, unknown>
  workspaceLayout?: {
    appsDir?: string
    libsDir?: string
  }
  [key: string]: unknown
}

/**
 * NX project configuration (project.json).
 */
export interface NxProjectConfig {
  $schema?: string
  name: string
  sourceRoot?: string
  projectType?: 'library' | 'application'
  tags?: string[]
  targets?: Record<string, NxTargetConfig>
  implicitDependencies?: string[]
  [key: string]: unknown
}

/**
 * NX target configuration.
 */
export interface NxTargetConfig {
  executor?: string
  command?: string
  options?: Record<string, unknown>
  configurations?: Record<string, Record<string, unknown>>
  defaultConfiguration?: string
  dependsOn?: Array<string | { target: string; projects: string | string[] }>
  inputs?: Array<string | { input: string; projects: string | string[] }>
  outputs?: string[]
  cache?: boolean
}
```

### Dependency Graph Types

```typescript
/**
 * Complete dependency graph.
 */
export interface DependencyGraph {
  /** All nodes (projects) in the graph */
  nodes: Record<string, DependencyNode>
  /** All edges (dependencies) */
  edges: DependencyEdge[]
  /** Root nodes (no dependents) */
  roots: string[]
  /** Leaf nodes (no dependencies) */
  leaves: string[]
  /** Circular dependency chains */
  cycles: CircularDependency[]
}

/**
 * Node in the dependency graph.
 */
export interface DependencyNode {
  /** Project name */
  name: string
  /** Project root path */
  root: string
  /** Project type */
  type: ProjectType
  /** Direct dependencies */
  dependencies: string[]
  /** Direct dependents */
  dependents: string[]
  /** External npm dependencies */
  externalDependencies: ExternalDependency[]
}

/**
 * Edge in the dependency graph.
 */
export interface DependencyEdge {
  /** Source project */
  source: string
  /** Target project */
  target: string
  /** Dependency type */
  type: DependencyType
  /** Files where dependency is declared */
  sources: DependencySource[]
}

/**
 * Dependency type classification.
 */
export type DependencyType =
  | 'static' // Direct import/require
  | 'dynamic' // Dynamic import()
  | 'implicit' // Configured/implied dependency
  | 'peer' // Peer dependency
  | 'dev' // Dev dependency

/**
 * Source of a dependency.
 */
export interface DependencySource {
  /** File path where dependency is used */
  filePath: string
  /** Line number (if known) */
  line?: number
  /** Column number (if known) */
  column?: number
  /** Import statement or reference */
  reference: string
}

/**
 * External (npm) dependency.
 */
export interface ExternalDependency {
  /** Package name */
  name: string
  /** Version specifier */
  version: string
  /** Dependency classification */
  type: 'production' | 'development' | 'peer' | 'optional'
}

/**
 * Circular dependency chain.
 */
export interface CircularDependency {
  /** Projects involved in the cycle */
  chain: string[]
  /** Severity assessment */
  severity: 'error' | 'warning'
}
```

### Git Types

```typescript
/**
 * Git repository information.
 */
export interface GitRepoInfo {
  /** Repository root path */
  root: string
  /** Current branch */
  currentBranch: string
  /** Is repository clean (no uncommitted changes) */
  isClean: boolean
  /** Remote URLs */
  remotes: GitRemote[]
  /** HEAD commit hash */
  headCommit: string
}

/**
 * Git remote configuration.
 */
export interface GitRemote {
  /** Remote name */
  name: string
  /** Fetch URL */
  fetchUrl: string
  /** Push URL */
  pushUrl: string
}

/**
 * Changed file information.
 */
export interface ChangedFile {
  /** File path relative to repo root */
  path: string
  /** Change status */
  status: GitFileStatus
  /** Original path (for renames) */
  originalPath?: string
}

/**
 * Git file status.
 */
export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored'

/**
 * Git log entry.
 */
export interface GitCommit {
  /** Commit hash */
  hash: string
  /** Short hash (7 chars) */
  shortHash: string
  /** Author name */
  author: string
  /** Author email */
  email: string
  /** Commit date */
  date: Date
  /** Commit message */
  message: string
  /** Parent commits */
  parents: string[]
}
```

### Platform Types

```typescript
/**
 * Platform information.
 */
export interface PlatformInfo {
  /** Operating system */
  os: 'darwin' | 'linux' | 'win32' | 'freebsd' | 'sunos' | 'aix'
  /** CPU architecture */
  arch: 'x64' | 'arm64' | 'arm' | 'ia32' | 's390x' | 'ppc64'
  /** Node.js version */
  nodeVersion: string
  /** Is Windows */
  isWindows: boolean
  /** Is macOS */
  isMac: boolean
  /** Is Linux */
  isLinux: boolean
  /** File system case sensitive */
  caseSensitive: boolean
  /** Path separator */
  pathSeparator: '/' | '\\'
  /** Line ending style */
  lineEnding: '\n' | '\r\n'
}

/**
 * Path normalization options.
 */
export interface PathOptions {
  /** Use forward slashes on all platforms */
  forwardSlashes?: boolean
  /** Resolve to absolute path */
  absolute?: boolean
  /** Remove trailing slash */
  removeTrailingSlash?: boolean
  /** Preserve symlinks (don't resolve) */
  preserveSymlinks?: boolean
}
```

### Logging Types

```typescript
/**
 * Verbosity levels.
 */
export type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug' | 'trace'

/**
 * Logger interface.
 */
export interface Logger {
  /** Error logging (always shown) */
  error(message: string, ...args: unknown[]): void
  /** Warning logging (shown at normal+) */
  warn(message: string, ...args: unknown[]): void
  /** Info logging (shown at normal+) */
  info(message: string, ...args: unknown[]): void
  /** Debug logging (shown at verbose+) */
  debug(message: string, ...args: unknown[]): void
  /** Trace logging (shown at trace) */
  trace(message: string, ...args: unknown[]): void
  /** Set verbosity level */
  setVerbosity(level: VerbosityLevel): void
  /** Get current verbosity level */
  getVerbosity(): VerbosityLevel
}
```

---

## Function Signatures

### Virtual File System Functions

```typescript
/**
 * Create an empty in-memory tree.
 */
export function createTree(options?: CreateTreeOptions): Tree

/**
 * Create a tree backed by disk contents.
 */
export function createTreeFromDisk(root: string, options?: CreateTreeOptions): Tree

/**
 * Commit all pending changes to disk.
 * @param dryRun If true, return what would be changed without writing
 */
export function commitChanges(tree: Tree, options?: { dryRun?: boolean }): FileChange[]

/**
 * Discard all pending changes.
 */
export function rollbackChanges(tree: Tree): void

/**
 * Get list of pending changes.
 */
export function listChanges(tree: Tree): FileChange[]

/**
 * Generate a diff view of pending changes.
 */
export function diffChanges(tree: Tree): string
```

### Project Analysis Functions

```typescript
/**
 * Perform complete project analysis.
 */
export function analyzeProject(path: string, options?: AnalyzeOptions): AnalysisResult
export function analyzeProject(tree: Tree, options?: AnalyzeOptions): AnalysisResult

/**
 * Detect workspace type.
 */
export function detectWorkspaceType(path: string): WorkspaceType
export function detectWorkspaceType(tree: Tree): WorkspaceType

/**
 * Detect frameworks in use.
 */
export function detectFrameworks(path: string, options?: DetectOptions): FrameworkInfo[]
export function detectFrameworks(tree: Tree, options?: DetectOptions): FrameworkInfo[]

/**
 * Detect build tools in use.
 */
export function detectBuildTools(path: string): BuildToolInfo[]
export function detectBuildTools(tree: Tree): BuildToolInfo[]

/**
 * Detect testing frameworks in use.
 */
export function detectTestingFrameworks(path: string): TestingFrameworkInfo[]
export function detectTestingFrameworks(tree: Tree): TestingFrameworkInfo[]

/**
 * Analysis options.
 */
export interface AnalyzeOptions {
  /** Include dependency analysis */
  includeDependencies?: boolean
  /** Include AST-based detection */
  includeAst?: boolean
  /** Maximum depth for detection */
  maxDepth?: number
  /** Patterns to ignore */
  ignorePatterns?: string[]
}

/**
 * Detection options.
 */
export interface DetectOptions {
  /** Minimum confidence threshold (0-100) */
  minConfidence?: number
  /** Include legacy frameworks */
  includeLegacy?: boolean
}
```

### Configuration Functions

```typescript
/**
 * Read project configuration.
 * Returns null if not found.
 */
export function readProjectConfig(path: string): ProjectConfig | null
export function readProjectConfig(tree: Tree, path: string): ProjectConfig | null

/**
 * Read package.json.
 * Throws if not found or invalid.
 */
export function readPackageJson(path: string): PackageJson
export function readPackageJson(tree: Tree, path: string): PackageJson

/**
 * Read tsconfig.json (with extends resolution).
 */
export function readTsConfig(path: string): TsConfig
export function readTsConfig(tree: Tree, path: string): TsConfig

/**
 * Read nx.json.
 */
export function readNxJson(path: string): NxJson | null
export function readNxJson(tree: Tree): NxJson | null

/**
 * Parse any supported configuration file.
 */
export function parseConfig(filePath: string): ProjectConfig
export function parseConfig(tree: Tree, filePath: string): ProjectConfig
export function parseConfig(content: string, format: ConfigFormat): ProjectConfig
```

### Traversal Functions

```typescript
/**
 * Walk a directory tree, calling visitor for each entry.
 */
export function walkDirectory(path: string, visitor: (entry: DirectoryEntry) => void | 'skip', options?: WalkOptions): void
export function walkDirectory(tree: Tree, path: string, visitor: (entry: DirectoryEntry) => void | 'skip', options?: WalkOptions): void

/**
 * Find files matching patterns.
 */
export function findFiles(path: string, patterns: string | string[], options?: FindOptions): string[]
export function findFiles(tree: Tree, patterns: string | string[], options?: FindOptions): string[]

/**
 * Find configuration files.
 */
export function findConfigs(path: string, types?: ConfigType[]): ConfigFileInfo[]
export function findConfigs(tree: Tree, types?: ConfigType[]): ConfigFileInfo[]

/**
 * Search for content within files.
 */
export function searchContent(path: string, pattern: string | RegExp, options?: SearchOptions): SearchResult[]
export function searchContent(tree: Tree, pattern: string | RegExp, options?: SearchOptions): SearchResult[]

/**
 * Directory entry during traversal.
 */
export interface DirectoryEntry {
  /** Entry name */
  name: string
  /** Full path */
  path: string
  /** Is directory */
  isDirectory: boolean
  /** Is file */
  isFile: boolean
  /** Is symbolic link */
  isSymlink: boolean
  /** Depth from start path */
  depth: number
}

/**
 * Walk options.
 */
export interface WalkOptions {
  /** Maximum depth to traverse */
  maxDepth?: number
  /** Follow symbolic links */
  followSymlinks?: boolean
  /** Include hidden files/dirs */
  includeHidden?: boolean
  /** Patterns to ignore */
  ignorePatterns?: string[]
  /** Respect .gitignore */
  respectGitignore?: boolean
}

/**
 * Find options.
 */
export interface FindOptions extends WalkOptions {
  /** Only files (not directories) */
  filesOnly?: boolean
  /** Only directories (not files) */
  directoriesOnly?: boolean
  /** Absolute paths in results */
  absolutePaths?: boolean
}

/**
 * Search result.
 */
export interface SearchResult {
  /** File path */
  filePath: string
  /** Line number (1-indexed) */
  line: number
  /** Column number (1-indexed) */
  column: number
  /** Matched text */
  match: string
  /** Line content */
  lineContent: string
}
```

### Dependency Functions

```typescript
/**
 * Build complete dependency graph.
 */
export function getDependencyGraph(path: string, options?: GraphOptions): DependencyGraph
export function getDependencyGraph(tree: Tree, options?: GraphOptions): DependencyGraph

/**
 * Find circular dependencies.
 */
export function findCircularDependencies(path: string): CircularDependency[]
export function findCircularDependencies(tree: Tree): CircularDependency[]
export function findCircularDependencies(graph: DependencyGraph): CircularDependency[]

/**
 * Get dependencies for a specific project.
 */
export function getProjectDependencies(projectName: string, graph: DependencyGraph, options?: { transitive?: boolean }): string[]

/**
 * Get dependents for a specific project.
 */
export function getProjectDependents(projectName: string, graph: DependencyGraph, options?: { transitive?: boolean }): string[]

/**
 * Graph building options.
 */
export interface GraphOptions {
  /** Include external npm dependencies */
  includeExternal?: boolean
  /** Include dev dependencies */
  includeDevDependencies?: boolean
  /** Source files to analyze */
  analyzeSourceFiles?: boolean
}
```

### Root Detection Functions

```typescript
/**
 * Find project root (nearest package.json with source files).
 */
export function findProjectRoot(startPath: string): string | null

/**
 * Find workspace root (monorepo root or project root).
 */
export function findWorkspaceRoot(startPath: string): string | null

/**
 * Find nearest package.json.
 */
export function findNearestPackageJson(startPath: string): string | null

/**
 * Find nearest config file of given types.
 */
export function findNearestConfig(startPath: string, configTypes: ConfigType[]): string | null
```

### Git Functions

```typescript
/**
 * Get Git repository root.
 */
export function getGitRoot(startPath: string): string | null

/**
 * Get current branch name.
 */
export function getGitBranch(repoPath: string): string | null

/**
 * Get Git repository information.
 */
export function getGitInfo(repoPath: string): GitRepoInfo | null

/**
 * Get changed files.
 */
export function getChangedFiles(repoPath: string, options?: ChangedFilesOptions): ChangedFile[]

/**
 * Check if a path is gitignored.
 */
export function isGitIgnored(repoPath: string, filePath: string): boolean

/**
 * Get commit history.
 */
export function getGitHistory(repoPath: string, options?: HistoryOptions): GitCommit[]

/**
 * Changed files options.
 */
export interface ChangedFilesOptions {
  /** Base reference (branch/commit) */
  base?: string
  /** Include untracked files */
  includeUntracked?: boolean
  /** Include ignored files */
  includeIgnored?: boolean
  /** Only staged changes */
  stagedOnly?: boolean
}

/**
 * History options.
 */
export interface HistoryOptions {
  /** Maximum number of commits */
  maxCount?: number
  /** Start from reference */
  since?: string
  /** End at reference */
  until?: string
  /** Filter by path */
  path?: string
}
```

### AST Functions

```typescript
/**
 * Parse a TypeScript/JavaScript source file.
 */
export function parseSourceFile(path: string, options?: ParseOptions): SourceFile
export function parseSourceFile(tree: Tree, path: string, options?: ParseOptions): SourceFile
export function parseSourceFile(content: string, fileName: string, options?: ParseOptions): SourceFile

/**
 * Query code using selectors.
 */
export function queryCode<T = unknown>(source: SourceFile, selector: CodeSelector): QueryResult<T>[]

/**
 * Transform code safely.
 */
export function transformCode(source: SourceFile, transforms: CodeTransform[]): TransformResult

/**
 * Code selector types.
 */
export type CodeSelector =
  | { kind: 'import'; module?: string }
  | { kind: 'export'; name?: string }
  | { kind: 'function'; name?: string }
  | { kind: 'class'; name?: string }
  | { kind: 'variable'; name?: string }
  | { kind: 'call'; functionName?: string }
  | { kind: 'jsx-element'; tagName?: string }
  | { kind: 'decorator'; name?: string }
  | { kind: 'custom'; visitor: AstVisitor }

/**
 * Query result.
 */
export interface QueryResult<T> {
  /** Node data */
  data: T
  /** Source location */
  location: SourceLocation
  /** Original AST node (for advanced use) */
  node: unknown
}

/**
 * Source location.
 */
export interface SourceLocation {
  /** Start line (1-indexed) */
  startLine: number
  /** Start column (1-indexed) */
  startColumn: number
  /** End line (1-indexed) */
  endLine: number
  /** End column (1-indexed) */
  endColumn: number
  /** File path */
  filePath: string
}

/**
 * Code transformation.
 */
export interface CodeTransform {
  /** Selector to find nodes */
  selector: CodeSelector
  /** Transform function */
  transform: (match: QueryResult<unknown>) => string | null
}

/**
 * Transform result.
 */
export interface TransformResult {
  /** Transformed source code */
  code: string
  /** Changes made */
  changes: TransformChange[]
  /** Any errors during transformation */
  errors: TransformError[]
}
```

### Platform Functions

```typescript
/**
 * Get current platform information.
 */
export function getPlatformInfo(): PlatformInfo

/**
 * Normalize a path for current platform.
 */
export function normalizePath(path: string, options?: PathOptions): string

/**
 * Convert path to posix style (forward slashes).
 */
export function toPosixPath(path: string): string

/**
 * Convert path to native style.
 */
export function toNativePath(path: string): string

/**
 * Check if path is absolute.
 */
export function isAbsolutePath(path: string): boolean

/**
 * Get relative path from one path to another.
 */
export function getRelativePath(from: string, to: string): string
```

### Logging Functions

```typescript
/**
 * Set global verbosity level.
 */
export function setVerbosity(level: VerbosityLevel): void

/**
 * Get the library logger.
 */
export function getLogger(): Logger

/**
 * Create a child logger with prefix.
 */
export function createLogger(prefix: string): Logger
```

---

## Error Types

```typescript
/**
 * Base error for all project-scope errors.
 */
export class ProjectScopeError extends Error {
  readonly code: ProjectScopeErrorCode
  readonly context: Record<string, unknown>

  constructor(message: string, code: ProjectScopeErrorCode, context?: Record<string, unknown>)
}

/**
 * Error codes.
 */
export type ProjectScopeErrorCode =
  // File system errors
  | 'FS_READ_ERROR'
  | 'FS_WRITE_ERROR'
  | 'FS_NOT_FOUND'
  | 'FS_PERMISSION_DENIED'
  | 'FS_NOT_A_DIRECTORY'
  | 'FS_NOT_A_FILE'
  // Configuration errors
  | 'CONFIG_PARSE_ERROR'
  | 'CONFIG_INVALID'
  | 'CONFIG_NOT_FOUND'
  // VFS errors
  | 'VFS_TRANSACTION_ERROR'
  | 'VFS_COMMIT_ERROR'
  | 'VFS_CONFLICT'
  // Analysis errors
  | 'ANALYSIS_ERROR'
  | 'DETECTION_ERROR'
  // Git errors
  | 'GIT_NOT_FOUND'
  | 'GIT_ERROR'
  // AST errors
  | 'PARSE_ERROR'
  | 'TRANSFORM_ERROR'
  // General errors
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'

/**
 * File system specific error.
 */
export class FileSystemError extends ProjectScopeError {
  readonly path: string
  readonly operation: 'read' | 'write' | 'delete' | 'stat' | 'mkdir'
}

/**
 * Configuration parsing error.
 */
export class ConfigParseError extends ProjectScopeError {
  readonly filePath: string
  readonly format: string
  readonly parseError?: Error
}

/**
 * VFS transaction error.
 */
export class TransactionError extends ProjectScopeError {
  readonly failedChanges: FileChange[]
  readonly successfulChanges: FileChange[]
}
```

---

## Related Documents

- [Architecture](./01-architecture.md)
- [Layer 1: Core Utilities](./03-layers-core-utilities.md)
- [Virtual File System](./07-virtual-filesystem.md)
- [CLI Design](./10-cli-design.md)
