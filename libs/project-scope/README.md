# @hyperfrontend/project-scope

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-project-scope.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-project-scope.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=project-scope">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=project-scope" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/project-scope">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/project-scope?style=flat-square" alt="npm version">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/project-scope">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/project-scope?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Comprehensive project analysis, technology stack detection, and transactional virtual file system for Node.js tooling.

## What is @hyperfrontend/project-scope?

@hyperfrontend/project-scope provides intelligent codebase analysis for JavaScript/TypeScript projects. It uses multi-signal heuristics to classify project types, detect frameworks and build tools, discover entry points, and map dependency graphs - all with confidence scoring and explainable evidence. The library also includes a virtual file system (VFS) for safe, atomic file modifications.

Designed for tooling authors building code generators, IDE extensions, CI/CD pipelines, and monorepo tooling. Optional `@nx/devkit` integration enables seamless operation within NX workspaces with graceful fallback for standalone projects.

### Key Features

- **Project Classification** - Detect application, library, e2e, tool, or plugin with confidence scoring and evidence tracking
- **Technology Detection** - Identify 20+ frameworks (React, Vue, Angular, Svelte), build tools (Vite, Webpack, esbuild), and testing frameworks (Jest, Vitest, Cypress)
- **Virtual File System** - Transaction-aware file operations with atomic commit/rollback, following NX devkit's Tree interface
- **Monorepo Intelligence** - Detect NX, Turborepo, Lerna, pnpm/npm/Yarn workspaces; read project configurations
- **Dependency Graph** - Build internal import graphs from source code with root/leaf node identification
- **Entry Point Discovery** - Find application entries from package.json exports, bin fields, and convention patterns
- **CLI Interface** - Command-line access to all features with JSON/YAML output
- **Zero Runtime Dependencies** - All dependencies bundled for minimal footprint

### Architecture Highlights

Four-layer architecture: core (fs, path, encoding, platform), project (config detection, package.json, root finding), tech (framework/tool detectors with consistent interfaces), and heuristics (multi-signal classification with evidence). Detectors use function-scoped caching (30-60s TTL). VFS buffers changes in memory until explicit commit, with path traversal prevention and symlink validation.

## Why Use @hyperfrontend/project-scope?

### Accurate Framework Detection for Code Generators

Simple `package.json` parsing misses meta-frameworks, optional dependencies, and configuration-based setups. A project with `next` installed might be Next.js, but could also be a library that exports Next.js components. This library's multi-signal heuristics analyze dependencies, directory structure (`pages/`, `app/`), and config files (`next.config.js`) together, returning confidence-scored results. Your generator knows _with certainty_ whether to scaffold Next.js pages or React components.

### Safe File Modifications with Rollback

Code generators that write directly to disk risk leaving projects in broken states when errors occur mid-generation. The VFS buffers all changes in memory - write 50 files, validate the result, then `commitChanges()` atomically or `rollbackChanges()` to discard everything. Path traversal attacks are blocked at the VFS layer, making generators safe to run on untrusted input.

### Adaptive Tooling in Heterogeneous Monorepos

Monorepos contain React apps, Vue libraries, Node.js services, and Cypress suites - each requiring different lint rules, build configs, and CI pipelines. Use `detectAll()` per project to get technology detection with version info, then conditionally apply configurations. Cached results (30-60s TTL) ensure repeated analysis during builds stays fast.

### IDE Extensions Without Manual Configuration

IDE features that adapt to frameworks typically require users to configure their project type manually. This library provides runtime detection - determine React vs Vue for component snippets, identify Jest vs Vitest for test runners, detect Vite vs Webpack for build task integration. The CLI enables integration with shell-based tooling and editor extensions.

### Migration Planning with Evidence

Modernizing legacy codebases requires understanding current technology stack before planning migrations. `analyzeProject()` detects legacy frameworks (jQuery, AngularJS, Backbone), maps internal dependency graphs, and provides confidence-scored evidence for each detection. Generate reports that explain _why_ each technology was detected, enabling data-driven migration decisions.

## Installation

```bash
npm install @hyperfrontend/project-scope
```

## Requirements

- **Node.js:** 18.0.0 or higher
- **npm:** 8.0.0 or higher

> **Note:** This library is designed for Node.js environments only (no browser support). All file system operations use synchronous Node.js APIs.

## Quick Start

### Project Analysis

```typescript
import { analyzeProject, detectAll } from '@hyperfrontend/project-scope'

// Full project analysis
const analysis = analyzeProject('./my-project')
console.log(analysis.projectType) // 'library' | 'application' | 'e2e' | 'tool'
console.log(analysis.frameworks.map((f) => `${f.name} (${f.confidence}%)`))

// Technology stack detection
const tech = detectAll('./my-project')
console.log(
  'Frontend:',
  tech.frontendFrameworks.map((f) => f.name)
)
console.log(
  'Build:',
  tech.buildTools.map((t) => t.name)
)
console.log(
  'Testing:',
  tech.testingFrameworks.map((t) => t.name)
)
```

### Virtual File System

```typescript
import { createTree, Mode } from '@hyperfrontend/project-scope'

const tree = createTree('./my-project')

tree.write('src/new-file.ts', 'export const hello = "world"')
tree.rename('src/old.ts', 'src/renamed.ts')
tree.delete('src/deprecated.ts')

tree.commitChanges() // Atomic commit, or rollbackChanges() to discard
```

### CLI

```bash
project-scope analyze ./my-project --format json
project-scope config ./my-project --type typescript,eslint
project-scope tree ./my-project --depth 3
```

## API Overview

### Analysis

- **`analyzeProject(path, options?): AnalysisResult`** - Comprehensive project analysis
- **`detectProjectType(path): ProjectTypeDetection`** - Classify project type with evidence
- **`identifyFrameworks(path): FrameworkIdentification`** - Detect frameworks with confidence scores
- **`discoverEntryPoints(path): EntryPointInfo[]`** - Find application entry points
- **`buildDependencyGraph(path): DependencyGraph`** - Build internal dependency graph

### Technology Detection

- **`detectAll(path): AllDetections`** - Run all technology detectors
- **`frameworkDetectors`** - Individual framework detectors (React, Vue, Angular, etc.)
- **`backendDetectors`** - Backend framework detectors (Express, NestJS, Fastify, etc.)
- **`buildToolDetectors`** - Build tool detectors (Webpack, Vite, Rollup, etc.)
- **`testingDetectors`** - Testing framework detectors (Jest, Vitest, Cypress, etc.)

### Project Utilities

- **`readPackageJson(path): PackageJson`** - Parse package.json
- **`findProjectRoot(path): string`** - Find nearest project root
- **`findWorkspaceRoot(path): string`** - Find monorepo/workspace root
- **`detectConfigs(path, types?): ConfigFileInfo[]`** - Find configuration files

### Virtual File System

- **`createTree(path, options?): Tree`** - Create transactional file tree
- **`Mode`** - Write modes: `Overwrite`, `ExclusiveCreate`, `SkipIfExists`
- Tree methods: `read()`, `write()`, `exists()`, `delete()`, `rename()`, `commitChanges()`, `rollbackChanges()`

### NX Integration

- **`isNxWorkspace(path): boolean`** - Check if directory is NX workspace
- **`getNxWorkspaceInfo(path): NxWorkspaceInfo`** - Get workspace details
- **`findNxProjects(path): NxProjectConfig[]`** - Find all projects
- **`isDevkitAvailable(): boolean`** - Check if `@nx/devkit` is available

### Core Utilities

- **File System:** `readFileContent()`, `writeFileContent()`, `readJsonFile()`, `exists()`, `isFile()`, `isDirectory()`
- **Path:** `normalizePath()`, `joinPath()`, `resolvePath()`, `relativePath()`
- **Encoding:** `detectEncoding()`, `convertEncoding()`
- **Platform:** `detectPlatform()`, `isWindows()`, `isMacOS()`, `isLinux()`

## Secondary Entry Points

Import specific modules for tree-shaking optimization:

```typescript
// Core utilities
import { readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core/fs'
import { normalizePath, joinPath } from '@hyperfrontend/project-scope/core/path'

// Heuristics
import { detectProjectType } from '@hyperfrontend/project-scope/heuristics/project-type'
import { discoverEntryPoints } from '@hyperfrontend/project-scope/heuristics/entry-points'

// Technology detection
import { detectAll } from '@hyperfrontend/project-scope/tech'
import { reactDetector } from '@hyperfrontend/project-scope/tech/frontend'

// Project utilities
import { readPackageJson } from '@hyperfrontend/project-scope/project/package'
import { detectConfigs } from '@hyperfrontend/project-scope/project/config'

// Virtual file system
import { createTree, Mode } from '@hyperfrontend/project-scope/vfs'

// NX integration
import { isNxWorkspace, findNxProjects } from '@hyperfrontend/project-scope/nx'
```

## License

MIT
