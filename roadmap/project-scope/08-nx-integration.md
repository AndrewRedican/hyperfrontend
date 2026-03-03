# NX Integration Strategy

> **Document**: 08-nx-integration.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Optional @nx/devkit integration

---

## Overview

The library supports **optional** integration with `@nx/devkit`. When running inside an NX workspace with @nx/devkit available:

- Use NX's Tree implementation when provided
- Access NX project graph APIs
- Leverage NX's workspace detection

When @nx/devkit is NOT available:

- Use our standalone `FsTree` implementation
- Detect NX via config file presence
- Parse `nx.json` and `project.json` files directly

---

## Design Principles

1. **Optional peer dependency**: @nx/devkit is NOT required
2. **Graceful fallback**: All features work without NX
3. **API compatibility**: Our Tree matches NX Tree interface
4. **No import failures**: Check availability at runtime

---

## Detection Strategy

### Detecting NX Workspace

```typescript
// nx/detect.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonIfExists } from '../core/fs'
import { findRootDirectory } from '../project/root'
import type { NxWorkspaceInfo } from './types'

/**
 * Patterns indicating NX workspace.
 */
const NX_CONFIG_FILES = ['nx.json', 'workspace.json'] as const

/**
 * NX-specific project file.
 */
const NX_PROJECT_FILE = 'project.json'

/**
 * Check if directory is an NX workspace root.
 */
export function isNxWorkspace(path: string): boolean {
  for (const configFile of NX_CONFIG_FILES) {
    if (existsSync(join(path, configFile))) {
      return true
    }
  }
  return false
}

/**
 * Check if directory is an NX project.
 */
export function isNxProject(path: string): boolean {
  return existsSync(join(path, NX_PROJECT_FILE))
}

/**
 * Find NX workspace root from any path.
 */
export function findNxWorkspaceRoot(startPath: string): string | null {
  return findRootDirectory(startPath, NX_CONFIG_FILES)
}

/**
 * Get NX workspace information.
 */
export function getNxWorkspaceInfo(workspacePath: string): NxWorkspaceInfo | null {
  if (!isNxWorkspace(workspacePath)) {
    return null
  }

  const nxJson = readJsonIfExists<NxJson>(join(workspacePath, 'nx.json'))

  if (!nxJson) {
    return null
  }

  return {
    root: workspacePath,
    version: detectNxVersion(workspacePath, nxJson),
    nxJson,
    isIntegrated: isIntegratedRepo(nxJson),
    defaultProject: nxJson.defaultProject,
    workspaceLayout: nxJson.workspaceLayout ?? {
      appsDir: 'apps',
      libsDir: 'libs',
    },
  }
}

/**
 * Detect NX version from package.json or nxJson.
 */
function detectNxVersion(workspacePath: string, nxJson: NxJson): string | null {
  // Check package.json devDependencies
  const packageJson = readJsonIfExists<PackageJson>(join(workspacePath, 'package.json'))

  if (packageJson) {
    const nxVersion = packageJson.devDependencies?.['nx'] ?? packageJson.dependencies?.['nx']

    if (nxVersion) {
      // Strip semver range characters
      return nxVersion.replace(/^[\^~]/, '')
    }
  }

  return null
}

/**
 * Check if workspace is integrated (not standalone).
 */
function isIntegratedRepo(nxJson: NxJson): boolean {
  // Integrated repos typically have workspaceLayout
  // Standalone repos often have "$schema" only
  return nxJson.workspaceLayout !== undefined || nxJson.namedInputs !== undefined || nxJson.targetDefaults !== undefined
}
```

---

## Runtime Detection of @nx/devkit

```typescript
// nx/devkit-loader.ts

/**
 * Result of attempting to load @nx/devkit.
 */
export interface DevkitLoadResult {
  available: boolean
  devkit?: typeof import('@nx/devkit')
  error?: Error
}

/**
 * Cached load result.
 */
let cachedResult: DevkitLoadResult | null = null

/**
 * Try to load @nx/devkit at runtime.
 * Returns cached result on subsequent calls.
 */
export function tryLoadDevkit(): DevkitLoadResult {
  if (cachedResult !== null) {
    return cachedResult
  }

  try {
    // Dynamic import to avoid bundling @nx/devkit
    const devkit = require('@nx/devkit')

    cachedResult = {
      available: true,
      devkit,
    }
  } catch (error) {
    cachedResult = {
      available: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  return cachedResult
}

/**
 * Check if @nx/devkit is available.
 */
export function isDevkitAvailable(): boolean {
  return tryLoadDevkit().available
}

/**
 * Get @nx/devkit module if available.
 * Throws if not available.
 */
export function getDevkit(): typeof import('@nx/devkit') {
  const result = tryLoadDevkit()

  if (!result.available) {
    throw new Error('@nx/devkit is not available. Install it as a dependency or use standalone mode.')
  }

  return result.devkit!
}

/**
 * Execute function with @nx/devkit if available,
 * otherwise execute fallback.
 */
export function withDevkit<T>(ifAvailable: (devkit: typeof import('@nx/devkit')) => T, fallback: () => T): T {
  const result = tryLoadDevkit()

  if (result.available) {
    return ifAvailable(result.devkit!)
  }

  return fallback()
}
```

---

## NX Project Configuration Parsing

```typescript
// nx/project-config.ts
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readJsonIfExists } from '../core/fs'
import { walkDirectory } from '../project/traversal'
import type { NxProjectConfig, NxTargetConfig, NxProjectGraph } from './types'

/**
 * Read project.json for an NX project.
 */
export function readProjectJson(projectPath: string): NxProjectConfig | null {
  const projectJsonPath = join(projectPath, 'project.json')
  return readJsonIfExists<NxProjectConfig>(projectJsonPath)
}

/**
 * Read project configuration from project.json or infer from package.json.
 */
export function getProjectConfig(projectPath: string, workspacePath: string): NxProjectConfig | null {
  // Try project.json first
  const projectJson = readProjectJson(projectPath)

  if (projectJson) {
    return {
      ...projectJson,
      root: relative(workspacePath, projectPath),
    }
  }

  // Try to infer from package.json
  const packageJson = readJsonIfExists<PackageJson>(join(projectPath, 'package.json'))

  if (packageJson?.nx) {
    // NX config embedded in package.json
    return {
      name: packageJson.name,
      root: relative(workspacePath, projectPath),
      ...packageJson.nx,
    }
  }

  return null
}

/**
 * Discover all NX projects in workspace.
 */
export function discoverNxProjects(workspacePath: string): Map<string, NxProjectConfig> {
  const projects = new Map<string, NxProjectConfig>()

  // Check for workspace.json (older NX format)
  const workspaceJson = readJsonIfExists<{ projects: Record<string, unknown> }>(join(workspacePath, 'workspace.json'))

  if (workspaceJson?.projects) {
    for (const [name, config] of Object.entries(workspaceJson.projects)) {
      if (typeof config === 'string') {
        // Path reference
        const projectConfig = getProjectConfig(join(workspacePath, config), workspacePath)
        if (projectConfig) {
          projects.set(name, { ...projectConfig, name })
        }
      } else if (typeof config === 'object' && config !== null) {
        // Inline config
        projects.set(name, { name, ...(config as NxProjectConfig) })
      }
    }

    return projects
  }

  // Scan for project.json files (newer NX format)
  const nxJson = readJsonIfExists<NxJson>(join(workspacePath, 'nx.json'))
  const appsDir = nxJson?.workspaceLayout?.appsDir ?? 'apps'
  const libsDir = nxJson?.workspaceLayout?.libsDir ?? 'libs'

  const searchDirs = [appsDir, libsDir]

  // Also check for plugins that identify projects
  if (nxJson?.plugins) {
    // Would need to handle plugin-based project inference
    // For now, just scan standard directories
  }

  for (const dir of searchDirs) {
    const dirPath = join(workspacePath, dir)

    if (!existsSync(dirPath)) {
      continue
    }

    walkDirectory(dirPath, {
      maxDepth: 3,
      onFile: (filePath) => {
        if (filePath.endsWith('project.json')) {
          const projectPath = join(filePath, '..')
          const config = readProjectJson(projectPath)

          if (config) {
            const name = config.name || relative(workspacePath, projectPath).replace(/\//g, '-')
            projects.set(name, {
              ...config,
              name,
              root: relative(workspacePath, projectPath),
            })
          }
        }
      },
    })
  }

  return projects
}

/**
 * Build project graph (dependency relationships).
 * Simple implementation - use NX devkit for full graph.
 */
export function buildSimpleProjectGraph(workspacePath: string, projects: Map<string, NxProjectConfig>): NxProjectGraph {
  const nodes: Record<string, { name: string; type: string; data: NxProjectConfig }> = {}
  const dependencies: Record<string, Array<{ target: string; type: string }>> = {}

  for (const [name, config] of projects) {
    nodes[name] = {
      name,
      type: config.projectType ?? 'library',
      data: config,
    }

    dependencies[name] = []

    // Add implicit dependencies
    if (config.implicitDependencies) {
      for (const dep of config.implicitDependencies) {
        dependencies[name].push({
          target: dep,
          type: 'implicit',
        })
      }
    }
  }

  return { nodes, dependencies }
}
```

---

## API Compatibility Layer

### Tree Interface Alignment

```typescript
// nx/compat.ts
import type { Tree } from '../vfs/types'
import { FsTree } from '../vfs/fs-tree'
import { withDevkit } from './devkit-loader'

/**
 * Create tree compatible with NX generators.
 * Uses NX Tree if in NX context, otherwise FsTree.
 */
export function createCompatibleTree(root: string, nxTree?: unknown): Tree {
  // If NX tree provided, wrap it
  if (nxTree && isNxTree(nxTree)) {
    return wrapNxTree(nxTree)
  }

  // Try to use devkit's flushChanges if available
  return new FsTree(root)
}

/**
 * Check if object is NX Tree.
 */
function isNxTree(obj: unknown): obj is NxDevkitTree {
  if (typeof obj !== 'object' || obj === null) {
    return false
  }

  const tree = obj as Record<string, unknown>

  return (
    typeof tree['root'] === 'string' &&
    typeof tree['read'] === 'function' &&
    typeof tree['write'] === 'function' &&
    typeof tree['exists'] === 'function'
  )
}

interface NxDevkitTree {
  root: string
  read(filePath: string, encoding?: BufferEncoding): Buffer | string | null
  write(filePath: string, content: Buffer | string, options?: object): void
  exists(filePath: string): boolean
  delete(filePath: string): void
  rename(from: string, to: string): void
  isFile(filePath: string): boolean
  children(dirPath: string): string[]
  listChanges(): Array<{ path: string; type: string; content: Buffer | null }>
}

/**
 * Wrap NX devkit tree in our Tree interface.
 */
function wrapNxTree(nxTree: NxDevkitTree): Tree {
  return {
    get root() {
      return nxTree.root
    },

    read(filePath: string, encoding?: BufferEncoding): any {
      return nxTree.read(filePath, encoding)
    },

    write(filePath: string, content: Buffer | string, options?: object): void {
      nxTree.write(filePath, content, options)
    },

    delete(filePath: string): void {
      nxTree.delete(filePath)
    },

    exists(filePath: string): boolean {
      return nxTree.exists(filePath)
    },

    isFile(filePath: string): boolean {
      return nxTree.isFile(filePath)
    },

    isDirectory(filePath: string): boolean {
      return nxTree.exists(filePath) && !nxTree.isFile(filePath)
    },

    children(dirPath: string): string[] {
      return nxTree.children(dirPath)
    },

    rename(from: string, to: string): void {
      nxTree.rename(from, to)
    },

    changeFile(filePath: string, transform: (content: Buffer) => Buffer): void {
      const content = nxTree.read(filePath)
      if (content === null) {
        throw new Error(`File not found: ${filePath}`)
      }
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
      nxTree.write(filePath, transform(buffer))
    },

    listChanges(): Array<{ path: string; type: 'CREATE' | 'UPDATE' | 'DELETE'; content?: Buffer }> {
      return nxTree.listChanges().map((c) => ({
        path: c.path,
        type: c.type as 'CREATE' | 'UPDATE' | 'DELETE',
        content: c.content ?? undefined,
      }))
    },
  }
}
```

---

## Fallback Implementations

### JSON Utilities (without @nx/devkit)

```typescript
// nx/json-compat.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Tree } from '../vfs/types'

// These mirror @nx/devkit functions

/**
 * Read JSON file from tree.
 * Compatible with @nx/devkit readJson.
 */
export function readJson<T = object>(tree: Tree, path: string): T {
  const content = tree.read(path, 'utf-8')

  if (content === null) {
    throw new Error(`Cannot find ${path}`)
  }

  try {
    return JSON.parse(content) as T
  } catch (error) {
    throw new Error(`${path} is not valid JSON. ${error}`)
  }
}

/**
 * Write JSON file to tree.
 * Compatible with @nx/devkit writeJson.
 */
export function writeJson<T = object>(tree: Tree, path: string, value: T, options?: JsonWriteOptions): void {
  const indent = options?.indent ?? 2
  const content = JSON.stringify(value, null, indent) + '\n'
  tree.write(path, content)
}

/**
 * Update JSON file in tree.
 * Compatible with @nx/devkit updateJson.
 */
export function updateJson<T = object, U = T>(tree: Tree, path: string, updater: (value: T) => U): void {
  const currentValue = readJson<T>(tree, path)
  const newValue = updater(currentValue)
  writeJson(tree, path, newValue)
}

/**
 * Check if path is JSON file.
 */
export function isJsonFile(path: string): boolean {
  return path.endsWith('.json')
}

interface JsonWriteOptions {
  indent?: number
}
```

### Project Graph (without @nx/devkit)

```typescript
// nx/graph-compat.ts
import type { NxProjectGraph, NxProjectConfig } from './types'
import { discoverNxProjects, buildSimpleProjectGraph } from './project-config'
import { withDevkit } from './devkit-loader'

/**
 * Get project graph.
 * Uses @nx/devkit if available, otherwise builds simple graph.
 */
export function getProjectGraph(workspacePath: string): NxProjectGraph {
  return withDevkit(
    // With @nx/devkit
    (devkit) => {
      // Use NX's full project graph
      return devkit.readCachedProjectGraph()
    },
    // Fallback
    () => {
      const projects = discoverNxProjects(workspacePath)
      return buildSimpleProjectGraph(workspacePath, projects)
    }
  )
}

/**
 * Get project configuration by name.
 */
export function getProjectConfiguration(workspacePath: string, projectName: string): NxProjectConfig | null {
  return withDevkit(
    (devkit) => {
      const graph = devkit.readCachedProjectGraph()
      const node = graph.nodes[projectName]
      return node?.data ?? null
    },
    () => {
      const projects = discoverNxProjects(workspacePath)
      return projects.get(projectName) ?? null
    }
  )
}
```

---

## NX Types

```typescript
// nx/types.ts

/**
 * NX workspace information.
 */
export interface NxWorkspaceInfo {
  root: string
  version: string | null
  nxJson: NxJson
  isIntegrated: boolean
  defaultProject?: string
  workspaceLayout: {
    appsDir: string
    libsDir: string
  }
}

/**
 * nx.json schema (partial).
 */
export interface NxJson {
  $schema?: string
  defaultProject?: string
  workspaceLayout?: {
    appsDir?: string
    libsDir?: string
  }
  namedInputs?: Record<string, string[]>
  targetDefaults?: Record<string, NxTargetConfig>
  plugins?: Array<string | { plugin: string; options?: object }>
  tasksRunnerOptions?: Record<string, unknown>
  generators?: Record<string, object>
}

/**
 * NX project configuration (project.json).
 */
export interface NxProjectConfig {
  name?: string
  root?: string
  sourceRoot?: string
  projectType?: 'application' | 'library'
  targets?: Record<string, NxTargetConfig>
  implicitDependencies?: string[]
  tags?: string[]
  generators?: Record<string, object>
}

/**
 * NX target/executor configuration.
 */
export interface NxTargetConfig {
  executor?: string
  command?: string
  options?: Record<string, unknown>
  configurations?: Record<string, Record<string, unknown>>
  inputs?: Array<string | { input: string; projects: string }>
  outputs?: string[]
  dependsOn?: Array<string | { target: string; projects: string }>
  cache?: boolean
}

/**
 * Simple project graph representation.
 */
export interface NxProjectGraph {
  nodes: Record<
    string,
    {
      name: string
      type: string
      data: NxProjectConfig
    }
  >
  dependencies: Record<
    string,
    Array<{
      target: string
      type: string
    }>
  >
}
```

---

## Usage Examples

### With @nx/devkit (in NX generator)

```typescript
import { Tree } from '@nx/devkit'
import { analyzeProject } from '@hyperfrontend/project-scope'

export default async function myGenerator(tree: Tree, options: MyOptions) {
  // Pass NX tree directly - it will be wrapped
  const analysis = analyzeProject(tree.root, { tree })

  // Use analysis results to make decisions
  if (analysis.buildTool?.id === 'vite') {
    // Add vite-specific config
  }
}
```

### Standalone (without NX)

```typescript
import { analyzeProject, createTree, commitChanges } from '@hyperfrontend/project-scope'

// Create our own tree
const tree = createTree('/path/to/project')

// Analyze
const analysis = analyzeProject(tree.root)

// Make modifications
tree.write('new-file.ts', 'export const foo = 1')

// Preview changes
const changes = tree.listChanges()
console.log(changes)

// Commit when ready
const result = commitChanges(tree)
```

---

## Related Documents

- [Virtual File System](./07-virtual-filesystem.md)
- [Architecture](./01-architecture.md)
- [Dependencies](./12-dependencies.md)
