/**
 * Project type classification.
 */
export type ProjectType = 'application' | 'library' | 'e2e' | 'tool' | 'plugin' | 'unknown'

/**
 * Workspace type (monorepo vs standalone).
 */
export type WorkspaceType = 'nx' | 'turborepo' | 'lerna' | 'pnpm' | 'npm' | 'yarn' | 'standalone' | 'unknown'

/**
 * Complete project analysis result.
 */
export interface AnalysisResult {
  /** Project name */
  name: string
  /** Project root path */
  root: string
  /** Project type classification */
  projectType: ProjectType
  /** Workspace type */
  workspaceType: WorkspaceType
  /** Detected frameworks */
  frameworks: FrameworkInfo[]
  /** Detected build tools */
  buildTools: BuildToolInfo[]
  /** Detected testing frameworks */
  testingFrameworks: TestingInfo[]
  /** Entry points */
  entryPoints: EntryPointInfo[]
  /** Configuration files found */
  configFiles: ConfigFileInfo[]
  /** Dependency summary */
  dependencies: DependencySummary
  /** Analysis metadata */
  metadata: AnalysisMetadata
}

/**
 * Detected framework information.
 */
export interface FrameworkInfo {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Meta-frameworks (e.g., Next.js for React) */
  metaFrameworks?: string[]
  /** Category */
  category: 'frontend' | 'backend' | 'fullstack'
}

/**
 * Build tool information.
 */
export interface BuildToolInfo {
  /** Tool identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Config file path */
  configPath?: string
  /** Detection confidence (0-100) */
  confidence: number
}

/**
 * Testing framework information.
 */
export interface TestingInfo {
  /** Framework identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Detected version */
  version?: string
  /** Config file path */
  configPath?: string
  /** Test type */
  type: 'unit' | 'e2e' | 'integration'
  /** Detection confidence (0-100) */
  confidence: number
}

/**
 * Discovered entry point.
 */
export interface EntryPointInfo {
  /** File path */
  path: string
  /** Entry point type */
  type: 'main' | 'app' | 'server' | 'cli' | 'test'
  /** Detection confidence (0-100) */
  confidence: number
}

/**
 * Detected configuration file.
 */
export interface ConfigFileInfo {
  /** File path */
  path: string
  /** File name */
  name: string
  /** Config format */
  format: 'json' | 'yaml' | 'js' | 'ts' | 'toml' | 'env'
  /** Associated tool */
  tool?: string
}

/**
 * Project configuration (from package.json, project.json, etc.)
 */
export interface ProjectConfig {
  /** Project name */
  name: string
  /** Version */
  version?: string
  /** Description */
  description?: string
  /** Project type (if NX project) */
  projectType?: 'application' | 'library'
  /** Source root */
  sourceRoot?: string
  /** Tags */
  tags?: string[]
}

/**
 * Aggregated counts of dependencies by category.
 */
export interface DependencySummary {
  /** Production dependency count */
  production: number
  /** Dev dependency count */
  development: number
  /** Peer dependency count */
  peer: number
  /** Optional dependency count */
  optional: number
  /** Total count */
  total: number
}

/**
 * Dependency graph node.
 */
export interface DependencyNode {
  /** Node identifier (same as path) */
  id: string
  /** File path */
  path: string
  /** Files this node depends on */
  dependencies: string[]
  /** Files that depend on this node */
  dependents: string[]
}

/**
 * Dependency graph structure.
 */
export interface DependencyGraph {
  /** Nodes in the graph */
  nodes: Map<string, DependencyNode>
  /** Root files (not imported by anything) */
  roots: string[]
  /** Leaf files (don't import anything) */
  leaves: string[]
}

/**
 * Information about when and how the analysis was performed.
 */
export interface AnalysisMetadata {
  /** Analysis timestamp */
  timestamp: Date
  /** Analysis duration in ms */
  durationMs: number
  /** Library version */
  version: string
}
