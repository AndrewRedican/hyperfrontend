# @hyperfrontend/project-scope Implementation Plan

> **Status**: Implementation Planning
> **Target Library**: `libs/project-scope`
> **Package Name**: `@hyperfrontend/project-scope`

---

## Executive Summary

This implementation plan defines a comprehensive library for codebase analysis, project topology detection, file structure navigation, dependency resolution, and safe file modification through a virtual file system abstraction. The library is designed as a Node.js-only utility with first-class NX workspace support and CLI compatibility architecture.

---

## Project Naming Analysis

### Working Name Evaluation

The name **`project-scope`** was evaluated against:

1. **Existing Workspace Conventions**: Libraries use descriptive, action-oriented names (`logging`, `data-utils`, `function-utils`, `network-protocol`)
2. **Capability Scope**: The library covers analysis, navigation, modification, and detection
3. **Intent Inference**: Primary purpose is understanding and operating on project structures

### Recommendation: **Retain `project-scope`**

**Justification**:

- Semantically accurate: "scoping" a project implies understanding its boundaries, structure, and relationships
- Consistent with `-utils` suffix pattern for utility libraries, but this library is more than utilities—it's a comprehensive toolkit
- Alternative considered: `workspace-analyzer`, `project-toolkit`, `codebase-utils`
- `project-scope` best captures the dual nature: examining (scoping out) and operating within (scope of) projects

---

## Document Index

| Document                                                           | Description                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| [01-architecture.md](./01-architecture.md)                         | Layered architecture overview and design principles  |
| [02-api-design.md](./02-api-design.md)                             | Public API specifications and type definitions       |
| [03-layers-core-utilities.md](./03-layers-core-utilities.md)       | Layer 1: Core internal utilities specification       |
| [04-layers-project-utilities.md](./04-layers-project-utilities.md) | Layer 2: Generic project utilities specification     |
| [05-layers-tech-stack.md](./05-layers-tech-stack.md)               | Layer 3: Technology-specific utilities specification |
| [06-layers-heuristics.md](./06-layers-heuristics.md)               | Layer 4: Heuristics engine specification             |
| [07-virtual-filesystem.md](./07-virtual-filesystem.md)             | Virtual file system and transaction system           |
| [08-nx-integration.md](./08-nx-integration.md)                     | NX devkit integration strategy                       |
| [09-testing-strategy.md](./09-testing-strategy.md)                 | Testing approach and patterns                        |
| [10-cli-design.md](./10-cli-design.md)                             | CLI design and implementation                        |
| [11-build-configuration.md](./11-build-configuration.md)           | Build, bundle, and packaging configuration           |
| [12-dependencies.md](./12-dependencies.md)                         | Dependency management strategy                       |
| [13-implementation-phases.md](./13-implementation-phases.md)       | Phased implementation roadmap                        |

---

## Core Constraints

### Synchronous File System Operations

All file system operations **MUST** use synchronous Node.js `fs` APIs per ESLint rule `no-async-fs-api`:

```typescript
// ✅ Allowed
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'

// ❌ Prohibited
import { readFile, writeFile } from 'node:fs/promises'
import fs from 'node:fs'
fs.readFile() // callback-based
```

**Complete sync method mapping from ESLint rule**:

| Async Method | Sync Equivalent  |
| ------------ | ---------------- |
| `readFile`   | `readFileSync`   |
| `writeFile`  | `writeFileSync`  |
| `appendFile` | `appendFileSync` |
| `copyFile`   | `copyFileSync`   |
| `rename`     | `renameSync`     |
| `unlink`     | `unlinkSync`     |
| `rm`         | `rmSync`         |
| `rmdir`      | `rmdirSync`      |
| `mkdir`      | `mkdirSync`      |
| `readdir`    | `readdirSync`    |
| `stat`       | `statSync`       |
| `lstat`      | `lstatSync`      |
| `access`     | `accessSync`     |
| `exists`     | `existsSync`     |
| `chmod`      | `chmodSync`      |
| `chown`      | `chownSync`      |
| `symlink`    | `symlinkSync`    |
| `readlink`   | `readlinkSync`   |
| `realpath`   | `realpathSync`   |
| `open`       | `openSync`       |
| `close`      | `closeSync`      |
| `mkdtemp`    | `mkdtempSync`    |
| `cp`         | `cpSync`         |
| `glob`       | `globSync`       |

### Module Format Requirements

| Format | Required | Notes                         |
| ------ | -------- | ----------------------------- |
| ESM    | ✅       | Primary module format         |
| CJS    | ✅       | CommonJS compatibility        |
| IIFE   | ❌       | Not applicable (Node.js only) |
| UMD    | ❌       | Not applicable (Node.js only) |

### Bundle Strategy

- All dependencies **bundled** in compiled output
- Zero runtime dependencies for end users
- Source maps for debugging

---

## Technology Stack

| Category        | Technology | Version |
| --------------- | ---------- | ------- |
| Runtime         | Node.js    | 24.13.0 |
| Language        | TypeScript | 5.9.3   |
| Build System    | NX         | 22.3.3  |
| Testing         | Jest       | 30.2.0  |
| Package Manager | npm        | 10.x    |

---

## Key Design Decisions

### 1. Virtual File System First

All file operations go through a virtual file system (VFS) abstraction:

- Enables dry-run capabilities
- Supports atomic batch operations
- Facilitates testing without disk I/O
- Allows rollback on failure

### 2. Opportunistic NX Integration

- `@nx/devkit` is an **optional peer dependency**, not a direct dependency
- Library functions independently without NX
- When NX is detected, leverage APIs for enhanced functionality
- Graceful degradation to native implementations

### 3. Logging-First Development

- Every significant operation logs appropriately
- Secret sanitization built into logging layer
- Verbosity levels support deep debugging
- Structured logging for machine consumption

### 4. Platform Agnosticism

- Cross-platform path handling (Windows/Linux/macOS)
- Consistent line ending handling
- Case sensitivity awareness
- Symbolic link support

---

## Success Criteria

The implementation is validated when it can:

1. ✅ Inspect the `@hyperfrontend` workspace
2. ✅ Detect NX monorepo structure
3. ✅ Read all project configurations
4. ✅ Identify inter-project dependencies
5. ✅ Parse and understand build configurations
6. ✅ Execute in both CJS and ESM contexts
7. ✅ Provide CLI access to all major features
8. ✅ Support dry-run operations

---

## Related Documents

- [ESLint Rule: no-async-fs-api](../../tools/eslint-rules/src/rules/no-async-fs-api.ts)
- [NX Devkit API Analysis](../../_/nx-devkit-api-analysis.md)
- [Package Build Executor](../../tools/package/README.md)

---

## Revision History

| Version | Date       | Description                 |
| ------- | ---------- | --------------------------- |
| 1.0.0   | 2026-03-03 | Initial implementation plan |
