# NX Module

The `nx` module provides utilities for detecting and working with NX workspaces. It supports NX monorepo detection, workspace configuration reading, and project enumeration.

## Capabilities

### Workspace Detection

Detect if a directory is an NX workspace.

```typescript
import { isNxWorkspace, findNxWorkspaceRoot, isNxProject } from '@hyperfrontend/project-scope'

// Check if current directory is NX workspace root
if (isNxWorkspace('./my-monorepo')) {
  console.log('This is an NX workspace')
}

// Find workspace root from any nested path
const root = findNxWorkspaceRoot('./libs/my-lib/src/utils')
console.log('Workspace root:', root) // '/home/user/my-monorepo'

// Check if directory is an NX project (has project.json)
if (isNxProject('./libs/my-lib')) {
  console.log('This is an NX project')
}
```

### Workspace Information

Get comprehensive workspace details.

```typescript
import { getNxWorkspaceInfo } from '@hyperfrontend/project-scope'

const info = getNxWorkspaceInfo('./my-monorepo')

console.log('Root:', info.root)
console.log('NX Version:', info.version) // '17.2.0'
console.log('Integrated:', info.isIntegrated) // true
console.log('Default project:', info.defaultProject)
console.log('Layout:', info.workspaceLayout) // { appsDir: 'apps', libsDir: 'libs' }
console.log('NX JSON:', info.nxJson) // Full nx.json content
```

### Project Configuration

Read and parse NX project configuration.

```typescript
import { readNxProjectConfig, findNxProjects } from '@hyperfrontend/project-scope'

// Read single project config
const config = readNxProjectConfig('./libs/my-lib')
console.log('Name:', config.name)
console.log('Type:', config.projectType) // 'library' | 'application'
console.log('Source root:', config.sourceRoot)
console.log('Tags:', config.tags)
console.log('Targets:', Object.keys(config.targets ?? {}))

// Find all projects in workspace
const projects = findNxProjects('./my-monorepo')
for (const project of projects) {
  console.log(`${project.name} (${project.projectType})`)
}
```

## NX Configuration Files

The module detects these NX configuration files:

| File             | Description                    |
| ---------------- | ------------------------------ |
| `nx.json`        | Main workspace configuration   |
| `workspace.json` | Legacy workspace configuration |
| `project.json`   | Project-specific configuration |

## Interfaces

### NxWorkspaceInfo

```typescript
interface NxWorkspaceInfo {
  /** Workspace root path */
  root: string
  /** NX version from package.json */
  version: string | null
  /** Parsed nx.json content */
  nxJson: NxJson
  /** Whether this is an integrated repo */
  isIntegrated: boolean
  /** Default project name */
  defaultProject?: string
  /** Workspace layout configuration */
  workspaceLayout: NxWorkspaceLayout
}
```

### NxWorkspaceLayout

```typescript
interface NxWorkspaceLayout {
  /** Applications directory (default: 'apps') */
  appsDir: string
  /** Libraries directory (default: 'libs') */
  libsDir: string
}
```

### NxJson

```typescript
interface NxJson {
  defaultProject?: string
  workspaceLayout?: Partial<NxWorkspaceLayout>
  namedInputs?: Record<string, unknown>
  targetDefaults?: Record<string, unknown>
  nxCloudAccessToken?: string
  plugins?: unknown[]
  tasksRunnerOptions?: Record<string, unknown>
  defaultBase?: string
  [key: string]: unknown
}
```

## Design Principles

1. **Caching**: Results are cached appropriately
2. **Version agnostic**: Supports multiple NX versions
3. **Standalone support**: Detects both integrated and standalone repos
4. **Type safety**: Full TypeScript types for all configurations
