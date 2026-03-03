# Architecture

> **Document**: 01-architecture.md
> **Library**: `@hyperfrontend/project-scope`

---

## Overview

The `project-scope` library implements a **four-layer architecture** with clear separation of concerns. Each layer builds upon the previous, creating a composable and testable system for codebase analysis and manipulation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 4: HEURISTICS ENGINE                        │
│  Intelligent Detection • Framework Identification • Entry Point Discovery  │
├─────────────────────────────────────────────────────────────────────────────┤
│                       LAYER 3: TECH STACK UTILITIES                         │
│  Build Tools • Monorepo Tools • Frameworks • Testing • Type Systems        │
├─────────────────────────────────────────────────────────────────────────────┤
│                      LAYER 2: PROJECT UTILITIES                             │
│  Tree Traversal • Config Detection • Package.json • Project Root           │
├─────────────────────────────────────────────────────────────────────────────┤
│                       LAYER 1: CORE UTILITIES                               │
│  FS Primitives • Path Handling • Encoding • Platform Compat                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │      FOUNDATION SERVICES        │
                    │  Logging • VFS • Git Utilities  │
                    └─────────────────────────────────┘
```

---

## Design Principles

### 1. Synchronous Execution Model

All operations execute synchronously. This design choice:

- Simplifies control flow and error handling
- Enables deterministic execution order
- Aligns with CLI usage patterns
- Complies with workspace ESLint rules

### 2. Immutability by Default

- Configuration objects are read-only after creation
- VFS changes are accumulated, not immediately applied
- Original data structures are never mutated

### 3. Pure Functions Where Possible

- Functions with side effects are clearly identified
- Pure functions enable easier testing and composition
- Side effects isolated to VFS commit operations

### 4. Fail-Fast with Graceful Degradation

- Invalid inputs cause immediate failure with descriptive errors
- Missing optional features degrade gracefully
- NX integration unavailable? Fall back to native detection

### 5. Comprehensive Logging

- All significant operations are logged
- Verbosity levels control output detail
- Secret values are automatically sanitized

---

## Module Organization

```
libs/project-scope/
├── CHANGELOG.md
├── README.md
├── eslint.config.cjs
├── jest.config.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
└── src/
    ├── index.ts                          # Public API exports
    │
    ├── core/                             # Layer 1: Core Utilities
    │   ├── index.ts
    │   ├── fs/                           # File system primitives
    │   │   ├── index.ts
    │   │   ├── read.ts
    │   │   ├── write.ts
    │   │   ├── stat.ts
    │   │   ├── directory.ts
    │   │   └── permissions.ts
    │   ├── path/                         # Path manipulation
    │   │   ├── index.ts
    │   │   ├── normalize.ts
    │   │   ├── resolve.ts
    │   │   ├── relative.ts
    │   │   └── segments.ts
    │   ├── encoding/                     # Buffer/encoding handling
    │   │   ├── index.ts
    │   │   ├── detect.ts
    │   │   └── convert.ts
    │   └── platform/                     # Cross-platform helpers
    │       ├── index.ts
    │       ├── detect.ts
    │       ├── line-endings.ts
    │       └── case-sensitivity.ts
    │
    ├── project/                          # Layer 2: Project Utilities
    │   ├── index.ts
    │   ├── traversal/                    # Tree walking
    │   │   ├── index.ts
    │   │   ├── walk.ts
    │   │   ├── filter.ts
    │   │   └── search.ts
    │   ├── config/                       # Configuration detection
    │   │   ├── index.ts
    │   │   ├── detect.ts
    │   │   ├── parse.ts
    │   │   └── patterns.ts
    │   ├── package/                      # Package.json utilities
    │   │   ├── index.ts
    │   │   ├── read.ts
    │   │   ├── write.ts
    │   │   ├── dependencies.ts
    │   │   └── scripts.ts
    │   ├── root/                         # Project root detection
    │   │   ├── index.ts
    │   │   └── detect.ts
    │   └── content/                      # Content extraction
    │       ├── index.ts
    │       ├── parse.ts
    │       └── extract.ts
    │
    ├── tech/                             # Layer 3: Tech Stack Utilities
    │   ├── index.ts
    │   ├── build/                        # Build tool configs
    │   │   ├── index.ts
    │   │   ├── webpack.ts
    │   │   ├── rollup.ts
    │   │   ├── vite.ts
    │   │   ├── esbuild.ts
    │   │   ├── babel.ts
    │   │   ├── swc.ts
    │   │   └── parcel.ts
    │   ├── monorepo/                     # Monorepo tool configs
    │   │   ├── index.ts
    │   │   ├── nx.ts
    │   │   ├── turborepo.ts
    │   │   ├── lerna.ts
    │   │   ├── rush.ts
    │   │   └── workspaces.ts
    │   ├── frontend/                     # Frontend framework configs
    │   │   ├── index.ts
    │   │   ├── react.ts
    │   │   ├── angular.ts
    │   │   ├── vue.ts
    │   │   ├── svelte.ts
    │   │   ├── solid.ts
    │   │   ├── qwik.ts
    │   │   └── astro.ts
    │   ├── backend/                      # Backend framework configs
    │   │   ├── index.ts
    │   │   ├── express.ts
    │   │   ├── nest.ts
    │   │   ├── fastify.ts
    │   │   └── koa.ts
    │   ├── testing/                      # Testing framework configs
    │   │   ├── index.ts
    │   │   ├── jest.ts
    │   │   ├── vitest.ts
    │   │   ├── mocha.ts
    │   │   ├── cypress.ts
    │   │   └── playwright.ts
    │   ├── types/                        # Type system configs
    │   │   ├── index.ts
    │   │   ├── typescript.ts
    │   │   ├── flow.ts
    │   │   └── jsdoc.ts
    │   ├── linting/                      # Linting configs
    │   │   ├── index.ts
    │   │   ├── eslint.ts
    │   │   └── prettier.ts
    │   └── legacy/                       # Legacy framework detection
    │       ├── index.ts
    │       ├── backbone.ts
    │       ├── ember.ts
    │       ├── meteor.ts
    │       └── jquery.ts
    │
    ├── heuristics/                       # Layer 4: Heuristics Engine
    │   ├── index.ts
    │   ├── project-type/                 # Project type detection
    │   │   ├── index.ts
    │   │   ├── detect.ts
    │   │   └── classify.ts
    │   ├── framework/                    # Framework identification
    │   │   ├── index.ts
    │   │   └── identify.ts
    │   ├── entry-points/                 # Entry point discovery
    │   │   ├── index.ts
    │   │   └── discover.ts
    │   ├── dependencies/                 # Dependency mapping
    │   │   ├── index.ts
    │   │   ├── graph.ts
    │   │   └── circular.ts
    │   └── inference/                    # Configuration inference
    │       ├── index.ts
    │       └── infer.ts
    │
    ├── vfs/                              # Virtual File System
    │   ├── index.ts
    │   ├── tree.ts                       # Tree interface implementation
    │   ├── changes.ts                    # Change tracking
    │   ├── transaction.ts                # Transaction management
    │   ├── commit.ts                     # Commit/rollback operations
    │   └── diff.ts                       # Change diffing
    │
    ├── git/                              # Git Utilities
    │   ├── index.ts
    │   ├── detect.ts                     # Repository detection
    │   ├── branch.ts                     # Branch information
    │   ├── changes.ts                    # Changed files
    │   ├── history.ts                    # Commit history
    │   ├── ignore.ts                     # .gitignore handling
    │   └── status.ts                     # File status
    │
    ├── ast/                              # AST Operations
    │   ├── index.ts
    │   ├── parse.ts                      # Parsing utilities
    │   ├── query.ts                      # Code query/selectors
    │   ├── transform.ts                  # Safe transformations
    │   └── generate.ts                   # Code generation
    │
    ├── nx/                               # NX Integration
    │   ├── index.ts
    │   ├── detect.ts                     # NX detection
    │   ├── adapter.ts                    # Devkit adapter
    │   ├── project-graph.ts              # Project graph utilities
    │   └── fallback.ts                   # Native fallback implementations
    │
    ├── cli/                              # CLI Support
    │   ├── index.ts
    │   ├── args.ts                       # Argument parsing
    │   ├── env.ts                        # Environment variables
    │   ├── output.ts                     # Output formatting
    │   └── commands/                     # Command implementations
    │       ├── index.ts
    │       ├── analyze.ts
    │       ├── detect.ts
    │       └── graph.ts
    │
    ├── logging/                          # Logging Integration
    │   ├── index.ts
    │   ├── logger.ts                     # Logger instance
    │   ├── verbosity.ts                  # Verbosity levels
    │   └── sanitize.ts                   # Secret sanitization
    │
    └── models/                           # Shared Type Definitions
        ├── index.ts
        ├── project.ts
        ├── config.ts
        ├── dependency.ts
        ├── vfs.ts
        ├── platform.ts
        └── result.ts
```

---

## Data Flow

### Read Operations

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              READ OPERATION FLOW                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   User Request          Heuristics           Tech Layer       Core Layer     │
│       │                     │                    │                │          │
│       ▼                     │                    │                │          │
│   ┌───────────┐             │                    │                │          │
│   │ detectAll │─────────────┼────────────────────┼────────────────┼──────┐   │
│   └───────────┘             │                    │                │      │   │
│       │                     ▼                    │                │      │   │
│       │              ┌─────────────┐             │                │      │   │
│       │              │ classifyPrj │─────────────┼────────────────┼──────┤   │
│       │              └─────────────┘             │                │      │   │
│       │                     │                    ▼                │      │   │
│       │                     │             ┌─────────────┐         │      │   │
│       │                     │             │ parseConfig │─────────┼──────┤   │
│       │                     │             └─────────────┘         │      │   │
│       │                     │                    │                ▼      │   │
│       │                     │                    │         ┌─────────┐   │   │
│       │                     │                    │         │readFile │◀──┘   │
│       │                     │                    │         └─────────┘       │
│       │                     │                    │                │          │
│       ▼                     ▼                    ▼                ▼          │
│   ┌───────────────────────────────────────────────────────────────┐          │
│   │                      PROJECT ANALYSIS RESULT                   │          │
│   │  { type, frameworks, configs, dependencies, entryPoints }     │          │
│   └───────────────────────────────────────────────────────────────┘          │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Write Operations (VFS)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              WRITE OPERATION FLOW                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   User Request         VFS Layer           Transaction            Commit     │
│       │                    │                   │                    │        │
│       ▼                    │                   │                    │        │
│   ┌───────────┐            │                   │                    │        │
│   │startTrans │────────────┼───────────────────┼────────────────────┤        │
│   └───────────┘            │                   │                    │        │
│       │                    ▼                   │                    │        │
│       │             ┌─────────────┐            │                    │        │
│       │             │ tree.write  │────────────┼────────────────────┤        │
│       │             └─────────────┘            │                    │        │
│       │                    │                   ▼                    │        │
│       │                    │           ┌─────────────┐              │        │
│       │                    │           │ trackChange │──────────────┤        │
│       │                    │           └─────────────┘              │        │
│       │                    │                   │                    │        │
│       ▼                    │                   │                    │        │
│   ┌───────────┐            │                   │                    │        │
│   │  commit   │────────────┼───────────────────┼────────────────────┤        │
│   └───────────┘            │                   │                    ▼        │
│       │                    │                   │           ┌─────────────┐   │
│       │                    │                   │           │ applyToDisk │   │
│       │                    │                   │           └─────────────┘   │
│       │                    │                   │                    │        │
│       ▼                    ▼                   ▼                    ▼        │
│   ┌───────────────────────────────────────────────────────────────┐          │
│   │                      COMMITTED / ROLLED BACK                   │          │
│   └───────────────────────────────────────────────────────────────┘          │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Internal @hyperfrontend Dependencies

| Library                         | Integration Point         | Usage                                          |
| ------------------------------- | ------------------------- | ---------------------------------------------- |
| `@hyperfrontend/logging`        | `logging/`                | Structured logging, verbosity, sanitization    |
| `@hyperfrontend/data-utils`     | `project/`, `heuristics/` | Tree traversal, value extraction, key location |
| `@hyperfrontend/function-utils` | Throughout                | Caching, error handling, conditional execution |
| `@hyperfrontend/json-utils`     | `core/`, `tech/`          | JSON parsing, validation, schema generation    |
| `@hyperfrontend/list-utils`     | `project/`, `heuristics/` | Collection operations                          |
| `@hyperfrontend/string-utils`   | `core/`, `ast/`           | Text processing, template handling             |

### External Dependencies (Bundled)

| Package         | Purpose                    | Notes                                 |
| --------------- | -------------------------- | ------------------------------------- |
| TypeScript      | AST parsing, type checking | Compiler APIs only, no CLI dependency |
| (none required) | -                          | Design goal: minimize external deps   |

### Optional Peer Dependencies

| Package      | Purpose                       | Detection                                   |
| ------------ | ----------------------------- | ------------------------------------------- |
| `@nx/devkit` | Enhanced NX workspace support | Check `node_modules`, version compatibility |

---

## Error Handling Strategy

### Error Categories

```typescript
// Base error for all project-scope errors
export class ProjectScopeError extends Error {
  readonly code: string
  readonly context: Record<string, unknown>
}

// File system operation failures
export class FileSystemError extends ProjectScopeError {}

// Configuration parsing failures
export class ConfigParseError extends ProjectScopeError {}

// Validation failures
export class ValidationError extends ProjectScopeError {}

// VFS transaction failures
export class TransactionError extends ProjectScopeError {}

// NX integration failures (non-fatal)
export class NxIntegrationError extends ProjectScopeError {}
```

### Error Propagation

1. **Core Layer**: Throws base `FileSystemError` or `ConfigParseError`
2. **Project Layer**: Catches and enriches with context, re-throws
3. **Tech Layer**: Handles tech-specific failures gracefully
4. **Heuristics Layer**: Accumulates partial results, reports failures
5. **API Surface**: Returns `Result<T, E>` types or throws with full context

---

## Caching Strategy

### In-Memory Caching

```typescript
// Cache structure
interface ScopeCache {
  // File content cache (cleared on VFS changes)
  fileContents: Map<string, Buffer | string>

  // Parsed configuration cache
  parsedConfigs: Map<string, ParsedConfig>

  // Detection result cache
  detectionResults: Map<string, DetectionResult>

  // Project graph cache
  projectGraph: ProjectGraph | null
}
```

### Cache Invalidation

- Manual invalidation via API
- Automatic invalidation on VFS write operations
- Scope-limited invalidation (per directory tree)

---

## Security Considerations

### Secret Sanitization

Files and paths containing sensitive data are automatically detected and sanitized in logs:

```typescript
const SENSITIVE_PATTERNS = [
  /\.env(\.[a-zA-Z]+)?$/, // .env files
  /credentials?\.(json|ya?ml|ts)$/, // credential files
  /secrets?\.(json|ya?ml|ts)$/, // secret files
  /\.npmrc$/, // npm config (tokens)
  /\.netrc$/, // network credentials
  /\.aws\/credentials$/, // AWS credentials
  /\.(pem|key|p12|pfx)$/, // Certificate/key files
]

const SENSITIVE_KEYS = [/password/i, /secret/i, /token/i, /api[_-]?key/i, /private[_-]?key/i, /auth/i, /credential/i]
```

### Path Validation

- All paths normalized and validated before operations
- Path traversal attacks prevented
- Symlink resolution with cycle detection

---

## Performance Considerations

### Lazy Loading

- Tech-specific modules loaded on demand
- AST parsing deferred until necessary
- Project graph built incrementally

### Memory Efficiency

- Large file streaming where applicable
- VFS changes stored as diffs, not full copies
- Weak references for cached parsed configs

### Parallelization (Future)

- Architecture supports future parallel file reading
- Current implementation remains synchronous per ESLint rules
- Worker thread support designed into VFS layer

---

## Extensibility

### Plugin Points

1. **Config Parsers**: Register custom configuration file parsers
2. **Framework Detectors**: Add new framework detection logic
3. **VFS Adapters**: Custom storage backends for VFS

### Extension API (Future)

```typescript
interface ProjectScopePlugin {
  name: string
  configPatterns?: string[]
  frameworkDetector?: FrameworkDetector
  configParser?: ConfigParser
}
```

---

## Related Documents

- [API Design](./02-api-design.md)
- [Layer 1: Core Utilities](./03-layers-core-utilities.md)
- [Virtual File System](./07-virtual-filesystem.md)
- [NX Integration](./08-nx-integration.md)
