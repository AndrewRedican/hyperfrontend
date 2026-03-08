# Models Module

The `models` module defines the core TypeScript types and interfaces used throughout the library. These types provide a consistent, well-documented structure for all analysis results and data exchanges.

## Core Types

### Project Classification

```typescript
/**
 * Project type classification.
 */
type ProjectType = 'application' | 'library' | 'e2e' | 'tool' | 'plugin' | 'unknown'

/**
 * Workspace type (monorepo vs standalone).
 */
type WorkspaceType = 'nx' | 'turborepo' | 'lerna' | 'pnpm' | 'npm' | 'yarn' | 'standalone' | 'unknown'
```

### Analysis Result

The main output type from `analyzeProject()`:

```typescript
interface AnalysisResult {
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
```

### Framework Information

```typescript
interface FrameworkInfo {
  /** Framework identifier (e.g., 'react', 'angular') */
  id: string
  /** Human-readable name (e.g., 'React', 'Angular') */
  name: string
  /** Detected version */
  version?: string
  /** Detection confidence (0-100) */
  confidence: number
  /** Meta-frameworks (e.g., 'nextjs' for React) */
  metaFrameworks?: string[]
  /** Category */
  category: 'frontend' | 'backend' | 'fullstack'
}
```

### Build Tool Information

```typescript
interface BuildToolInfo {
  /** Tool identifier (e.g., 'webpack', 'vite') */
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
```

### Testing Framework Information

```typescript
interface TestingInfo {
  /** Framework identifier (e.g., 'jest', 'vitest') */
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
```

### Entry Point Information

```typescript
interface EntryPointInfo {
  /** File path relative to project root */
  path: string
  /** Entry point type */
  type: 'main' | 'app' | 'server' | 'cli' | 'test'
  /** Detection confidence (0-100) */
  confidence: number
}
```

### Configuration File Information

```typescript
interface ConfigFileInfo {
  /** File path relative to project root */
  path: string
  /** File name */
  name: string
  /** Config format */
  format: 'json' | 'yaml' | 'js' | 'ts' | 'toml' | 'env'
  /** Associated tool (e.g., 'typescript', 'eslint') */
  tool?: string
}
```

### Dependency Summary

```typescript
interface DependencySummary {
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
```

### Dependency Graph

```typescript
interface DependencyNode {
  /** Node identifier (file path) */
  id: string
  /** File path */
  path: string
  /** Files this node imports */
  dependencies: string[]
  /** Files that import this node */
  dependents: string[]
}

interface DependencyGraph {
  /** All nodes in the graph */
  nodes: Map<string, DependencyNode>
  /** Root files (not imported by anything) */
  roots: string[]
  /** Leaf files (don't import anything) */
  leaves: string[]
}
```

### Analysis Metadata

```typescript
interface AnalysisMetadata {
  /** When the analysis was performed */
  timestamp: Date
  /** Analysis duration in milliseconds */
  durationMs: number
  /** Library version used */
  version: string
}
```

### Project Configuration

```typescript
interface ProjectConfig {
  /** Project name */
  name: string
  /** Version */
  version?: string
  /** Description */
  description?: string
  /** Project type (for NX projects) */
  projectType?: 'application' | 'library'
  /** Source root directory */
  sourceRoot?: string
  /** Tags for filtering */
  tags?: string[]
}
```

## Usage

Import types for use in your own code:

```typescript
import type {
  AnalysisResult,
  ProjectType,
  WorkspaceType,
  FrameworkInfo,
  BuildToolInfo,
  TestingInfo,
  EntryPointInfo,
  ConfigFileInfo,
  DependencySummary,
  DependencyGraph,
} from '@hyperfrontend/project-scope'

function processAnalysis(result: AnalysisResult): void {
  if (result.projectType === 'library') {
    // Handle library-specific logic
  }
}
```

## Design Principles

1. **Type safety**: All interfaces are strictly typed
2. **Optional fields**: Only truly optional fields are marked as such
3. **Consistent naming**: IDs are lowercase, names are human-readable
4. **Confidence scores**: All detections include confidence (0-100)
5. **Extensibility**: Interfaces use string literals with sensible defaults
