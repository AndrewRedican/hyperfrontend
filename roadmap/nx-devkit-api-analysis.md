# @nx/devkit API Deep Analysis

> **Purpose**: This document provides a comprehensive analysis of the `@nx/devkit` package APIs, their purposes, usage patterns, Node.js API equivalents they replace, and practical examples.

---

## Table of Contents

1. [Overview](#overview)
2. [Virtual File System (Tree) APIs](#virtual-file-system-tree-apis)
3. [Generator Utilities](#generator-utilities)
4. [Project Configuration APIs](#project-configuration-apis)
5. [Executor Utilities](#executor-utilities)
6. [Package Management APIs](#package-management-apis)
7. [JSON Utilities](#json-utilities)
8. [Logger & Output Utilities](#logger--output-utilities)
9. [Path & Workspace Utilities](#path--workspace-utilities)
10. [Project Graph APIs](#project-graph-apis)
11. [Plugin APIs](#plugin-apis)
12. [Hashing Utilities](#hashing-utilities)
13. [Testing Utilities](#testing-utilities)
14. [Conversion Utilities](#conversion-utilities)
15. [Usage Likelihood Summary](#usage-likelihood-summary)

---

## Overview

`@nx/devkit` is the underlying technology used to customize Nx to support different technologies and custom use-cases. It provides:

- **Virtual File System**: A `Tree` abstraction that allows atomic file operations
- **Generator Utilities**: Functions to scaffold and transform code
- **Executor Utilities**: Functions to run and compose build tasks
- **Project Graph APIs**: Functions to analyze and manipulate workspace dependencies
- **Plugin APIs**: Interfaces for extending Nx functionality

### Import Pattern

All APIs can be imported from the main entry point:

```typescript
import {
  Tree,
  generateFiles,
  formatFiles,
  /* ... */
} from '@nx/devkit'
```

Testing utilities are imported separately:

```typescript
import { createTreeWithEmptyWorkspace, createTree } from '@nx/devkit/testing'
```

---

## Virtual File System (Tree) APIs

The `Tree` interface is the core abstraction representing a virtual file system. Changes are accumulated in memory and can be committed atomically.

| API                                  | Purpose                                                  | Node.js Equivalent       | Usage Likelihood | Import                                            |
| ------------------------------------ | -------------------------------------------------------- | ------------------------ | ---------------- | ------------------------------------------------- |
| `Tree`                               | Virtual file system interface for atomic file operations | `fs` module operations   | 🔴 **Essential** | `import { Tree } from '@nx/devkit'`               |
| `Tree.read(filePath)`                | Read file contents                                       | `fs.readFileSync()`      | 🔴 **Essential** | Instance method                                   |
| `Tree.write(filePath, content)`      | Write/update file                                        | `fs.writeFileSync()`     | 🔴 **Essential** | Instance method                                   |
| `Tree.exists(filePath)`              | Check file existence                                     | `fs.existsSync()`        | 🔴 **Essential** | Instance method                                   |
| `Tree.delete(filePath)`              | Delete file                                              | `fs.unlinkSync()`        | 🟡 High          | Instance method                                   |
| `Tree.rename(from, to)`              | Rename/move file                                         | `fs.renameSync()`        | 🟡 High          | Instance method                                   |
| `Tree.isFile(filePath)`              | Check if path is file                                    | `fs.statSync().isFile()` | 🟡 High          | Instance method                                   |
| `Tree.children(dirPath)`             | List directory contents                                  | `fs.readdirSync()`       | 🟡 High          | Instance method                                   |
| `Tree.listChanges()`                 | Get pending changes                                      | N/A (Nx-specific)        | 🟢 Medium        | Instance method                                   |
| `Tree.changePermissions(path, mode)` | Change file permissions                                  | `fs.chmodSync()`         | 🔵 Low           | Instance method                                   |
| `FsTree`                             | Concrete Tree implementation                             | N/A                      | 🔵 Low           | `import { FsTree } from 'nx/src/generators/tree'` |
| `FileChange`                         | Describes a pending file change                          | N/A                      | 🟢 Medium        | `import { FileChange } from '@nx/devkit'`         |

### Tree Interface Signature

```typescript
interface Tree {
  root: string
  read(filePath: string): Buffer | null
  read(filePath: string, encoding: BufferEncoding): string | null
  write(filePath: string, content: Buffer | string, options?: TreeWriteOptions): void
  exists(filePath: string): boolean
  delete(filePath: string): void
  rename(from: string, to: string): void
  isFile(filePath: string): boolean
  children(dirPath: string): string[]
  listChanges(): FileChange[]
  changePermissions(filePath: string, mode: Mode): void
}
```

### Example: Reading and Writing Files

```typescript
import { Tree } from '@nx/devkit'

export function myGenerator(tree: Tree, options: MyOptions) {
  // Read a file as string
  const content = tree.read('package.json', 'utf-8')

  // Check existence
  if (tree.exists('src/index.ts')) {
    // Update it
    tree.write('src/index.ts', 'export const foo = "bar";')
  }

  // List directory contents
  const files = tree.children('src')

  // Get all pending changes
  const changes = tree.listChanges()
  console.log(`${changes.length} files will be modified`)
}
```

### Why Use Tree Over Node.js fs?

| Benefit               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| **Atomic Operations** | All changes are batched and committed together       |
| **Dry-Run Support**   | Can preview changes without writing to disk          |
| **Testability**       | Easy to mock and test in isolation                   |
| **Rollback**          | Changes can be discarded if generator fails          |
| **Virtual Changes**   | Built-in tracking of CREATE/UPDATE/DELETE operations |

---

## Generator Utilities

| API                    | Purpose                               | Node.js Equivalent                          | Usage Likelihood | Import                                              |
| ---------------------- | ------------------------------------- | ------------------------------------------- | ---------------- | --------------------------------------------------- |
| `generateFiles`        | Generate files from templates         | Manual file templating + `fs.writeFileSync` | 🔴 **Essential** | `import { generateFiles } from '@nx/devkit'`        |
| `formatFiles`          | Format files with Prettier            | Manual Prettier integration                 | 🔴 **Essential** | `import { formatFiles } from '@nx/devkit'`          |
| `visitNotIgnoredFiles` | Iterate non-gitignored files          | `glob` + custom gitignore logic             | 🟡 High          | `import { visitNotIgnoredFiles } from '@nx/devkit'` |
| `runTasksInSerial`     | Chain generator callbacks             | Manual Promise chaining                     | 🟡 High          | `import { runTasksInSerial } from '@nx/devkit'`     |
| `toJS`                 | Convert TypeScript to JavaScript      | TypeScript compiler API                     | 🟢 Medium        | `import { toJS } from '@nx/devkit'`                 |
| `updateTsConfigsToJs`  | Update tsconfig for JS                | Manual JSON updates                         | 🔵 Low           | `import { updateTsConfigsToJs } from '@nx/devkit'`  |
| `OverwriteStrategy`    | Control file overwrite behavior       | N/A                                         | 🟡 High          | `import { OverwriteStrategy } from '@nx/devkit'`    |
| `glob`                 | Tree-aware glob matching (deprecated) | `glob` package                              | 🟢 Medium        | `import { glob } from '@nx/devkit'`                 |
| `globAsync`            | Async tree-aware glob matching        | `glob` package                              | 🟡 High          | `import { globAsync } from '@nx/devkit'`            |

### generateFiles Signature

```typescript
function generateFiles(
  tree: Tree,
  srcFolder: string, // Absolute path to template folder
  target: string, // Relative target path in tree
  substitutions: { [k: string]: any },
  options?: GenerateFilesOptions
): void

enum OverwriteStrategy {
  Overwrite = 'overwrite',
  KeepExisting = 'keepExisting',
  ThrowIfExisting = 'throwIfExisting',
}
```

### Example: Generating Files from Templates

```typescript
import { generateFiles, formatFiles, Tree, names } from '@nx/devkit'
import * as path from 'path'

export async function libraryGenerator(tree: Tree, options: { name: string }) {
  const { className, fileName, propertyName } = names(options.name)

  generateFiles(
    tree,
    path.join(__dirname, 'files'), // Template folder
    `libs/${fileName}`, // Target directory
    {
      tmpl: '', // Remove __tmpl__ from filenames
      className,
      fileName,
      propertyName,
      name: options.name,
    }
  )

  await formatFiles(tree)
}
```

### Example: Template File Structure

```
files/
├── src/
│   ├── index.ts__tmpl__
│   └── lib/
│       └── __fileName__.ts__tmpl__
├── project.json__tmpl__
└── README.md__tmpl__
```

Template content (`__fileName__.ts__tmpl__`):

```typescript
export class <%= className %> {
  constructor(public name: string = '<%= name %>') {}
}
```

### formatFiles Signature

```typescript
function formatFiles(tree: Tree, options?: { sortRootTsconfigPaths?: boolean }): Promise<void>
```

### runTasksInSerial Signature

```typescript
function runTasksInSerial(...tasks: GeneratorCallback[]): GeneratorCallback

// Usage
return runTasksInSerial(
  () => installPackagesTask(tree),
  () => console.log('Installation complete!')
)
```

### visitNotIgnoredFiles Signature

```typescript
function visitNotIgnoredFiles(tree: Tree, dirPath: string, visitor: (path: string) => void): void

// Example: Find all TypeScript files
visitNotIgnoredFiles(tree, 'libs/my-lib', (filePath) => {
  if (filePath.endsWith('.ts')) {
    const content = tree.read(filePath, 'utf-8')
    // Process file...
  }
})
```

---

## Project Configuration APIs

| API                          | Purpose                      | Node.js Equivalent                       | Usage Likelihood | Import                                                    |
| ---------------------------- | ---------------------------- | ---------------------------------------- | ---------------- | --------------------------------------------------------- |
| `addProjectConfiguration`    | Add new project to workspace | Manual project.json creation             | 🔴 **Essential** | `import { addProjectConfiguration } from '@nx/devkit'`    |
| `readProjectConfiguration`   | Read project config          | Manual JSON reading                      | 🔴 **Essential** | `import { readProjectConfiguration } from '@nx/devkit'`   |
| `updateProjectConfiguration` | Update project config        | Manual JSON modification                 | 🔴 **Essential** | `import { updateProjectConfiguration } from '@nx/devkit'` |
| `removeProjectConfiguration` | Remove project               | Manual file deletion                     | 🟡 High          | `import { removeProjectConfiguration } from '@nx/devkit'` |
| `getProjects`                | Get all projects map         | Manual workspace iteration               | 🔴 **Essential** | `import { getProjects } from '@nx/devkit'`                |
| `readNxJson`                 | Read nx.json configuration   | `JSON.parse(fs.readFileSync('nx.json'))` | 🔴 **Essential** | `import { readNxJson } from '@nx/devkit'`                 |
| `updateNxJson`               | Update nx.json               | Manual JSON modification                 | 🟡 High          | `import { updateNxJson } from '@nx/devkit'`               |
| `getWorkspaceLayout`         | Get apps/libs directories    | Manual nx.json parsing                   | 🟢 Medium        | `import { getWorkspaceLayout } from '@nx/devkit'`         |

### ProjectConfiguration Type

```typescript
interface ProjectConfiguration {
  root: string
  sourceRoot?: string
  projectType?: 'library' | 'application'
  targets?: Record<string, TargetConfiguration>
  tags?: string[]
  implicitDependencies?: string[]
  generators?: Record<string, unknown>
  namedInputs?: Record<string, (string | InputDefinition)[]>
  metadata?: Record<string, unknown>
}

interface TargetConfiguration {
  executor?: string
  command?: string
  options?: Record<string, unknown>
  configurations?: Record<string, Record<string, unknown>>
  defaultConfiguration?: string
  dependsOn?: TargetDependencyConfig[]
  inputs?: (string | InputDefinition)[]
  outputs?: string[]
  cache?: boolean
}
```

### Example: Adding a Project

```typescript
import { Tree, addProjectConfiguration, TargetConfiguration } from '@nx/devkit'

export function addNewLibrary(tree: Tree, name: string) {
  const buildTarget: TargetConfiguration = {
    executor: '@nx/js:tsc',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath: `dist/libs/${name}`,
      main: `libs/${name}/src/index.ts`,
      tsConfig: `libs/${name}/tsconfig.lib.json`,
    },
  }

  addProjectConfiguration(tree, name, {
    root: `libs/${name}`,
    sourceRoot: `libs/${name}/src`,
    projectType: 'library',
    tags: ['type:util'],
    targets: {
      build: buildTarget,
      test: {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: `libs/${name}/jest.config.ts`,
        },
      },
    },
  })
}
```

### Example: Updating a Project

```typescript
import { Tree, readProjectConfiguration, updateProjectConfiguration } from '@nx/devkit'

export function addLintTarget(tree: Tree, projectName: string) {
  const project = readProjectConfiguration(tree, projectName)

  project.targets = {
    ...project.targets,
    lint: {
      executor: '@nx/eslint:lint',
      options: {
        lintFilePatterns: [`${project.root}/**/*.ts`],
      },
    },
  }

  updateProjectConfiguration(tree, projectName, project)
}
```

### Example: Iterating All Projects

```typescript
import { Tree, getProjects } from '@nx/devkit'

export function addTagToAllLibraries(tree: Tree, tag: string) {
  const projects = getProjects(tree)

  for (const [name, config] of projects) {
    if (config.projectType === 'library') {
      config.tags = [...(config.tags || []), tag]
      updateProjectConfiguration(tree, name, config)
    }
  }
}
```

### getWorkspaceLayout Signature

```typescript
function getWorkspaceLayout(tree: Tree): {
  appsDir: string // Default: 'apps'
  libsDir: string // Default: 'libs'
  standaloneAsDefault: boolean
}

// Usage
const { appsDir, libsDir } = getWorkspaceLayout(tree)
const projectRoot = `${libsDir}/${projectName}`
```

---

## Executor Utilities

| API                    | Purpose                          | Node.js Equivalent                | Usage Likelihood | Import                                              |
| ---------------------- | -------------------------------- | --------------------------------- | ---------------- | --------------------------------------------------- |
| `runExecutor`          | Programmatically run an executor | `child_process.spawn` with Nx CLI | 🟡 High          | `import { runExecutor } from '@nx/devkit'`          |
| `parseTargetString`    | Parse target string to object    | String parsing                    | 🟡 High          | `import { parseTargetString } from '@nx/devkit'`    |
| `targetToTargetString` | Convert target to string         | String concatenation              | 🟡 High          | `import { targetToTargetString } from '@nx/devkit'` |
| `readTargetOptions`    | Read merged target options       | Manual config merging             | 🟢 Medium        | `import { readTargetOptions } from '@nx/devkit'`    |

### ExecutorContext Type

```typescript
interface ExecutorContext {
  root: string // Workspace root
  projectName?: string // Current project
  targetName?: string // Current target
  configurationName?: string // Current configuration
  target?: TargetConfiguration // Target configuration
  projectsConfigurations: ProjectsConfigurations
  nxJsonConfiguration: NxJsonConfiguration
  cwd: string // Current working directory
  isVerbose: boolean // Verbose logging enabled
  projectGraph: ProjectGraph // Project dependency graph
  taskGraph?: TaskGraph // Task execution graph
}
```

### runExecutor Signature

```typescript
async function runExecutor<T extends { success: boolean }>(
  targetDescription: Target,
  overrides: { [k: string]: any },
  context: ExecutorContext
): Promise<AsyncIterableIterator<T>>

interface Target {
  project: string
  target: string
  configuration?: string
}
```

### Example: Running an Executor Programmatically

```typescript
import { runExecutor, ExecutorContext, Target } from '@nx/devkit'

async function buildAndServe(target: Target, context: ExecutorContext) {
  // Build the project first
  const buildResult = await runExecutor({ project: target.project, target: 'build' }, { watch: false }, context)

  for await (const output of buildResult) {
    if (!output.success) {
      throw new Error('Build failed')
    }
  }

  // Then serve it
  const serveResult = await runExecutor({ project: target.project, target: 'serve' }, { port: 4200 }, context)

  for await (const output of serveResult) {
    console.log('Server running:', output.success)
  }
}
```

### parseTargetString / targetToTargetString

```typescript
import { parseTargetString, targetToTargetString, ProjectGraph } from '@nx/devkit'

// Parse target string
const target = parseTargetString('my-app:build:production', projectGraph)
// { project: 'my-app', target: 'build', configuration: 'production' }

// Convert back to string
const targetStr = targetToTargetString(target)
// 'my-app:build:production'
```

---

## Package Management APIs

| API                                   | Purpose                      | Node.js Equivalent                      | Usage Likelihood | Import                                                             |
| ------------------------------------- | ---------------------------- | --------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `addDependenciesToPackageJson`        | Add npm deps to package.json | Manual JSON editing                     | 🔴 **Essential** | `import { addDependenciesToPackageJson } from '@nx/devkit'`        |
| `removeDependenciesFromPackageJson`   | Remove npm deps              | Manual JSON editing                     | 🟡 High          | `import { removeDependenciesFromPackageJson } from '@nx/devkit'`   |
| `ensurePackage`                       | Ensure package is installed  | `require.resolve` + `npm install`       | 🟡 High          | `import { ensurePackage } from '@nx/devkit'`                       |
| `getDependencyVersionFromPackageJson` | Get installed version        | Manual JSON reading                     | 🟢 Medium        | `import { getDependencyVersionFromPackageJson } from '@nx/devkit'` |
| `installPackagesTask`                 | Run package install          | `child_process.execSync('npm install')` | 🔴 **Essential** | `import { installPackagesTask } from '@nx/devkit'`                 |
| `getPackageManagerCommand`            | Get PM commands              | Custom PM detection                     | 🟡 High          | `import { getPackageManagerCommand } from '@nx/devkit'`            |
| `detectPackageManager`                | Detect npm/yarn/pnpm         | Lock file detection                     | 🟡 High          | `import { detectPackageManager } from '@nx/devkit'`                |
| `getPackageManagerVersion`            | Get PM version               | `npm --version`                         | 🟢 Medium        | `import { getPackageManagerVersion } from '@nx/devkit'`            |
| `isWorkspacesEnabled`                 | Check if workspaces enabled  | Manual package.json check               | 🔵 Low           | `import { isWorkspacesEnabled } from '@nx/devkit'`                 |
| `NX_VERSION`                          | Current Nx version           | N/A                                     | 🟢 Medium        | `import { NX_VERSION } from '@nx/devkit'`                          |

### addDependenciesToPackageJson Signature

```typescript
function addDependenciesToPackageJson(
  tree: Tree,
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
  packageJsonPath?: string,
  keepExistingVersions?: boolean
): GeneratorCallback
```

### Example: Managing Dependencies

```typescript
import { Tree, addDependenciesToPackageJson, installPackagesTask, ensurePackage, NX_VERSION } from '@nx/devkit'

export async function setupGenerator(tree: Tree) {
  // Add dependencies
  const installTask = addDependenciesToPackageJson(
    tree,
    {
      lodash: '^4.17.21',
      axios: '^1.6.0',
    },
    {
      '@types/lodash': '^4.14.202',
      jest: '^29.7.0',
    }
  )

  // Ensure a package exists (useful for optional features)
  // Returns the module if already installed, installs if not
  const prettier = ensurePackage('prettier', '3.0.0')

  // Return install task for post-generation
  return () => {
    installPackagesTask(tree)
    // Or call the returned task
    installTask()
  }
}
```

### getPackageManagerCommand Usage

```typescript
import { getPackageManagerCommand, detectPackageManager } from '@nx/devkit'

const pm = detectPackageManager()
// 'npm' | 'yarn' | 'pnpm' | 'bun'

const pmc = getPackageManagerCommand(pm)
console.log(pmc.install) // 'npm install' or 'yarn install' etc.
console.log(pmc.add) // 'npm install' or 'yarn add'
console.log(pmc.addDev) // 'npm install -D' or 'yarn add -D'
console.log(pmc.exec) // 'npx' or 'yarn' or 'pnpm exec'
console.log(pmc.run('test')) // 'npm run test' or 'yarn test'
```

---

## JSON Utilities

| API                 | Purpose                   | Node.js Equivalent                   | Usage Likelihood | Import                                           |
| ------------------- | ------------------------- | ------------------------------------ | ---------------- | ------------------------------------------------ |
| `readJson`          | Read JSON from tree       | `JSON.parse(tree.read(path))`        | 🔴 **Essential** | `import { readJson } from '@nx/devkit'`          |
| `writeJson`         | Write JSON to tree        | `tree.write(path, JSON.stringify())` | 🔴 **Essential** | `import { writeJson } from '@nx/devkit'`         |
| `updateJson`        | Update JSON in tree       | Read + modify + write                | 🔴 **Essential** | `import { updateJson } from '@nx/devkit'`        |
| `parseJson`         | Parse JSON string         | `JSON.parse()` with JSONC support    | 🟡 High          | `import { parseJson } from '@nx/devkit'`         |
| `serializeJson`     | Stringify JSON            | `JSON.stringify()` with formatting   | 🟡 High          | `import { serializeJson } from '@nx/devkit'`     |
| `stripJsonComments` | Remove JSON comments      | `jsonc-parser`                       | 🟢 Medium        | `import { stripJsonComments } from '@nx/devkit'` |
| `readJsonFile`      | Read JSON from filesystem | `JSON.parse(fs.readFileSync())`      | 🟡 High          | `import { readJsonFile } from '@nx/devkit'`      |
| `writeJsonFile`     | Write JSON to filesystem  | `fs.writeFileSync(JSON.stringify())` | 🟡 High          | `import { writeJsonFile } from '@nx/devkit'`     |

### Signatures

```typescript
// Tree-based (for generators)
function readJson<T extends object = any>(tree: Tree, path: string, options?: JsonParseOptions): T

function writeJson<T extends object = object>(tree: Tree, path: string, value: T, options?: JsonSerializeOptions): void

function updateJson<T extends object = any, U extends object = T>(
  tree: Tree,
  path: string,
  updater: (value: T) => U,
  options?: JsonParseOptions & JsonSerializeOptions
): void

// Direct parsing (for both generators and executors)
function parseJson<T extends object = any>(input: string, options?: JsonParseOptions): T

function serializeJson<T extends object = object>(input: T, options?: JsonSerializeOptions): string

// File system based (for executors or scripts)
function readJsonFile<T extends object = any>(path: string, options?: JsonReadOptions): T

function writeJsonFile<T extends object = object>(path: string, data: T, options?: JsonWriteOptions): void

// Options
interface JsonParseOptions {
  expectComments?: boolean // Allow JS-style comments
  disallowComments?: boolean // Throw on comments
  allowTrailingComma?: boolean // Allow trailing commas
}

interface JsonSerializeOptions {
  spaces?: number // Indentation (default: 2)
}
```

### Example: Working with JSON

```typescript
import { Tree, readJson, writeJson, updateJson } from '@nx/devkit'

interface PackageJson {
  name: string
  version: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
}

export function updatePackageJson(tree: Tree, projectRoot: string) {
  const packageJsonPath = `${projectRoot}/package.json`

  // Read JSON
  const packageJson = readJson<PackageJson>(tree, packageJsonPath)

  // Modify
  packageJson.scripts = {
    ...packageJson.scripts,
    'test:ci': 'jest --ci',
  }

  // Write back
  writeJson(tree, packageJsonPath, packageJson)

  // Or use updateJson for atomic update
  updateJson<PackageJson>(tree, packageJsonPath, (json) => {
    json.scripts = {
      ...json.scripts,
      lint: 'eslint .',
    }
    return json
  })
}
```

---

## Logger & Output Utilities

| API      | Purpose              | Node.js Equivalent       | Usage Likelihood | Import                                |
| -------- | -------------------- | ------------------------ | ---------------- | ------------------------------------- |
| `logger` | Consistent logging   | `console.log/warn/error` | 🔴 **Essential** | `import { logger } from '@nx/devkit'` |
| `output` | Formatted CLI output | Custom chalk formatting  | 🟡 High          | `import { output } from '@nx/devkit'` |

### logger Signature

```typescript
const logger: {
  warn: (s: any) => void
  error: (s: any) => void
  info: (s: any) => void
  log: (...s: any[]) => void
  debug: (...s: any[]) => void
  fatal: (...s: any[]) => void
  verbose: (...s: any[]) => void
}
```

### output Object

```typescript
class CLIOutput {
  colors: {
    gray: chalk.Chalk
    green: chalk.Chalk
    red: chalk.Chalk
    cyan: chalk.Chalk
    white: chalk.Chalk
  }
  bold: chalk.Chalk
  underline: chalk.Chalk
  dim: chalk.Chalk

  error({ title, bodyLines, slug }: CLIErrorMessageConfig): void
  warn({ title, bodyLines, slug }: CLIWarnMessageConfig): void
  note({ title, bodyLines }: CLINoteMessageConfig): void
  success({ title, bodyLines }: CLISuccessMessageConfig): void
  log({ title, bodyLines, color }: CLIWarnMessageConfig & { color?: string }): void
  logSingleLine(message: string): void
}
```

### Example: Logging

```typescript
import { logger, output } from '@nx/devkit'

export function myExecutor(options: any) {
  // Simple logging
  logger.info('Starting build...')
  logger.warn('Deprecated option used')
  logger.error('Build failed')
  logger.debug('Config:', options)

  // Formatted output
  output.success({
    title: 'Build Complete',
    bodyLines: ['Output: dist/my-app', `Time: ${Date.now()}ms`],
  })

  output.error({
    title: 'Build Failed',
    bodyLines: ['Error: Module not found', 'Check your imports'],
    slug: 'module-not-found',
  })

  // Colored output
  console.log(output.colors.green('Success!'))
  console.log(output.bold('Important'))
}
```

---

## Path & Workspace Utilities

| API                       | Purpose                         | Node.js Equivalent                        | Usage Likelihood | Import                                                 |
| ------------------------- | ------------------------------- | ----------------------------------------- | ---------------- | ------------------------------------------------------ |
| `workspaceRoot`           | Workspace root path             | `process.cwd()` (unreliable)              | 🔴 **Essential** | `import { workspaceRoot } from '@nx/devkit'`           |
| `joinPathFragments`       | Join paths (unix-style)         | `path.join()`                             | 🔴 **Essential** | `import { joinPathFragments } from '@nx/devkit'`       |
| `normalizePath`           | Normalize to unix paths         | `path.normalize()` with platform handling | 🟡 High          | `import { normalizePath } from '@nx/devkit'`           |
| `offsetFromRoot`          | Calculate relative path to root | `path.relative()` calculation             | 🟡 High          | `import { offsetFromRoot } from '@nx/devkit'`          |
| `names`                   | Generate name variants          | Custom string transformations             | 🔴 **Essential** | `import { names } from '@nx/devkit'`                   |
| `stripIndents`            | Remove indentation              | Template literal processing               | 🟢 Medium        | `import { stripIndents } from '@nx/devkit'`            |
| `applyChangesToString`    | Apply string modifications      | Manual string manipulation                | 🟢 Medium        | `import { applyChangesToString } from '@nx/devkit'`    |
| `moveFilesToNewDirectory` | Move files in tree              | `fs.rename` operations                    | 🟡 High          | `import { moveFilesToNewDirectory } from '@nx/devkit'` |
| `cacheDir`                | Nx cache directory              | Environment variable handling             | 🔵 Low           | `import { cacheDir } from '@nx/devkit'`                |

### names Signature

```typescript
function names(name: string): {
  name: string // Original: 'my-component'
  className: string // PascalCase: 'MyComponent'
  propertyName: string // camelCase: 'myComponent'
  constantName: string // UPPER_SNAKE: 'MY_COMPONENT'
  fileName: string // kebab-case: 'my-component'
}

// Example
const n = names('myComponent')
// {
//   name: 'myComponent',
//   className: 'MyComponent',
//   propertyName: 'myComponent',
//   constantName: 'MY_COMPONENT',
//   fileName: 'my-component'
// }
```

### offsetFromRoot

```typescript
function offsetFromRoot(fullPathToDir: string): string

// Examples
offsetFromRoot('apps/my-app/src') // '../../../'
offsetFromRoot('libs/shared') // '../../'
offsetFromRoot('') // ''
```

### joinPathFragments vs path.join

```typescript
import { joinPathFragments, normalizePath } from '@nx/devkit'
import * as path from 'path'

// Always produces unix-style paths (good for config files)
joinPathFragments('libs', 'my-lib', 'src') // 'libs/my-lib/src'

// Normalizes Windows paths
normalizePath('libs\\my-lib\\src') // 'libs/my-lib/src'

// path.join is OS-specific (avoid in config files)
path.join('libs', 'my-lib', 'src') // 'libs\my-lib\src' on Windows
```

### stripIndents Usage

```typescript
import { stripIndents } from '@nx/devkit'

const message = stripIndents`
  This is a multi-line message.
  The leading indentation will be removed.
    Relative indentation preserved.
`
// "This is a multi-line message.\nThe leading indentation will be removed.\n  Relative indentation preserved."
```

### applyChangesToString

```typescript
import { applyChangesToString, ChangeType } from '@nx/devkit'

const original = 'const name = "old";'

const updated = applyChangesToString(original, [
  { type: ChangeType.Delete, start: 14, length: 3 }, // Delete 'old'
  { type: ChangeType.Insert, index: 14, text: 'new' }, // Insert 'new'
])
// 'const name = "new";'
```

---

## Project Graph APIs

| API                                         | Purpose                    | Node.js Equivalent | Usage Likelihood | Import                                                                   |
| ------------------------------------------- | -------------------------- | ------------------ | ---------------- | ------------------------------------------------------------------------ |
| `createProjectGraphAsync`                   | Build project graph        | N/A (Nx-specific)  | 🔴 **Essential** | `import { createProjectGraphAsync } from '@nx/devkit'`                   |
| `readCachedProjectGraph`                    | Read cached graph          | N/A                | 🟡 High          | `import { readCachedProjectGraph } from '@nx/devkit'`                    |
| `readProjectsConfigurationFromProjectGraph` | Extract configs from graph | N/A                | 🟢 Medium        | `import { readProjectsConfigurationFromProjectGraph } from '@nx/devkit'` |
| `reverse`                                   | Reverse graph edges        | N/A                | 🟢 Medium        | `import { reverse } from '@nx/devkit'`                                   |
| `DependencyType`                            | Dependency type enum       | N/A                | 🟡 High          | `import { DependencyType } from '@nx/devkit'`                            |
| `createProjectFileMapUsingProjectGraph`     | Create file map            | N/A                | 🔵 Low           | `import { createProjectFileMapUsingProjectGraph } from '@nx/devkit'`     |

### ProjectGraph Type

```typescript
interface ProjectGraph {
  nodes: Record<string, ProjectGraphProjectNode>
  externalNodes?: Record<string, ProjectGraphExternalNode>
  dependencies: Record<string, ProjectGraphDependency[]>
  version?: string
}

interface ProjectGraphProjectNode {
  type: 'app' | 'e2e' | 'lib'
  name: string
  data: ProjectConfiguration
}

interface ProjectGraphDependency {
  source: string
  target: string
  type: DependencyType
}

enum DependencyType {
  static = 'static', // Always loaded (imports)
  dynamic = 'dynamic', // Conditionally loaded (dynamic imports)
  implicit = 'implicit', // Configured dependencies
}
```

### Example: Working with Project Graph

```typescript
import { createProjectGraphAsync, readCachedProjectGraph, reverse, DependencyType } from '@nx/devkit'

export async function analyzeProjectDependencies(projectName: string) {
  // Get the project graph (async, ensures up-to-date)
  const graph = await createProjectGraphAsync()

  // Or read from cache (sync, may be stale)
  // const graph = readCachedProjectGraph();

  // Find all projects that depend on this project
  const reversedGraph = reverse(graph)
  const dependents = reversedGraph.dependencies[projectName] || []

  console.log(`Projects depending on ${projectName}:`)
  dependents.forEach((dep) => {
    console.log(`  - ${dep.target} (${dep.type})`)
  })

  // Find all dependencies of this project
  const deps = graph.dependencies[projectName] || []

  console.log(`\nDependencies of ${projectName}:`)
  deps.forEach((dep) => {
    console.log(`  - ${dep.target} (${dep.type})`)
  })

  // Get project configuration
  const projectNode = graph.nodes[projectName]
  console.log(`\nProject type: ${projectNode.type}`)
  console.log(`Project root: ${projectNode.data.root}`)
}
```

---

## Plugin APIs

| API                         | Purpose                  | Node.js Equivalent | Usage Likelihood           | Import                                                   |
| --------------------------- | ------------------------ | ------------------ | -------------------------- | -------------------------------------------------------- |
| `NxPlugin` / `NxPluginV2`   | Plugin interface         | N/A                | 🟡 High (plugin authors)   | `import type { NxPlugin } from '@nx/devkit'`             |
| `CreateNodesV2`             | Create project nodes     | N/A                | 🟡 High (plugin authors)   | `import type { CreateNodesV2 } from '@nx/devkit'`        |
| `CreateDependencies`        | Create dependencies      | N/A                | 🟢 Medium (plugin authors) | `import type { CreateDependencies } from '@nx/devkit'`   |
| `CreateMetadata`            | Create metadata          | N/A                | 🔵 Low                     | `import type { CreateMetadata } from '@nx/devkit'`       |
| `createNodesFromFiles`      | Helper for node creation | N/A                | 🟡 High (plugin authors)   | `import { createNodesFromFiles } from '@nx/devkit'`      |
| `AggregateCreateNodesError` | Error aggregation        | N/A                | 🔵 Low                     | `import { AggregateCreateNodesError } from '@nx/devkit'` |

### NxPlugin Type

```typescript
type NxPlugin<TOptions = unknown> = {
  name: string
  createNodes?: CreateNodesV2<TOptions>
  createNodesV2?: CreateNodesV2<TOptions>
  createDependencies?: CreateDependencies<TOptions>
  createMetadata?: CreateMetadata<TOptions>
  preTasksExecution?: PreTasksExecution<TOptions>
  postTasksExecution?: PostTasksExecution<TOptions>
}

type CreateNodesV2<T = unknown> = readonly [projectFilePattern: string, createNodesFunction: CreateNodesFunctionV2<T>]
```

### Example: Creating a Custom Plugin

```typescript
import { CreateNodesV2, CreateNodesContextV2, CreateNodesResult, createNodesFromFiles, TargetConfiguration } from '@nx/devkit'
import { dirname } from 'path'

interface MyPluginOptions {
  buildTargetName?: string
}

export const createNodesV2: CreateNodesV2<MyPluginOptions> = [
  '**/my-config.json',
  async (configFiles, options, context) => {
    return createNodesFromFiles(
      (configFile, options, context) => createNodesForConfigFile(configFile, options, context),
      configFiles,
      options,
      context
    )
  },
]

function createNodesForConfigFile(
  configFile: string,
  options: MyPluginOptions | undefined,
  context: CreateNodesContextV2
): CreateNodesResult {
  const projectRoot = dirname(configFile)
  const buildTargetName = options?.buildTargetName ?? 'build'

  const buildTarget: TargetConfiguration = {
    executor: '@my-org/my-executor:build',
    options: {
      configFile,
    },
    cache: true,
    inputs: ['default', '^default'],
    outputs: [`{projectRoot}/dist`],
  }

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: {
          [buildTargetName]: buildTarget,
        },
      },
    },
  }
}

// Export the plugin
export default {
  name: '@my-org/my-plugin',
  createNodesV2,
}
```

---

## Hashing Utilities

| API                                   | Purpose               | Node.js Equivalent    | Usage Likelihood | Import                                                             |
| ------------------------------------- | --------------------- | --------------------- | ---------------- | ------------------------------------------------------------------ |
| `hashArray`                           | Hash string array     | `crypto.createHash()` | 🟢 Medium        | `import { hashArray } from '@nx/devkit'`                           |
| `Hash`                                | Hash result type      | N/A                   | 🟢 Medium        | `import type { Hash } from '@nx/devkit'`                           |
| `TaskHasher` / `Hasher`               | Task hasher interface | N/A                   | 🔵 Low           | `import type { TaskHasher } from '@nx/devkit'`                     |
| `getOutputsForTargetAndConfiguration` | Get target outputs    | N/A                   | 🟢 Medium        | `import { getOutputsForTargetAndConfiguration } from '@nx/devkit'` |

### Signatures

```typescript
function hashArray(content: string[]): string

interface Hash {
  value: string
  details: {
    command: string
    nodes: { [name: string]: string }
    implicitDeps?: { [fileName: string]: string }
    runtime?: { [input: string]: string }
  }
}
```

### Example: Custom Hashing

```typescript
import { hashArray, readJsonFile } from '@nx/devkit'

function getConfigHash(configPath: string): string {
  const config = readJsonFile(configPath)
  return hashArray([JSON.stringify(config), process.env.NODE_ENV || 'development'])
}
```

---

## Testing Utilities

Import from `@nx/devkit/testing`:

| API                            | Purpose                       | Node.js Equivalent | Usage Likelihood           | Import                                                              |
| ------------------------------ | ----------------------------- | ------------------ | -------------------------- | ------------------------------------------------------------------- |
| `createTreeWithEmptyWorkspace` | Create test tree with nx.json | N/A                | 🔴 **Essential** (testing) | `import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing'` |
| `createTree`                   | Create empty test tree        | N/A                | 🟡 High (testing)          | `import { createTree } from '@nx/devkit/testing'`                   |

### Signatures

```typescript
function createTreeWithEmptyWorkspace(opts?: { layout?: 'apps-libs' }): Tree

function createTree(): Tree
```

### Example: Testing a Generator

```typescript
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing'
import { Tree, readProjectConfiguration, readJson } from '@nx/devkit'
import { libraryGenerator } from './library-generator'

describe('library generator', () => {
  let tree: Tree

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace()
  })

  it('should create library files', async () => {
    await libraryGenerator(tree, { name: 'my-lib' })

    // Check project configuration
    const config = readProjectConfiguration(tree, 'my-lib')
    expect(config.root).toBe('libs/my-lib')
    expect(config.projectType).toBe('library')

    // Check files exist
    expect(tree.exists('libs/my-lib/src/index.ts')).toBe(true)
    expect(tree.exists('libs/my-lib/project.json')).toBe(true)

    // Check file contents
    const indexContent = tree.read('libs/my-lib/src/index.ts', 'utf-8')
    expect(indexContent).toContain('export')

    // Check JSON files
    const packageJson = readJson(tree, 'libs/my-lib/package.json')
    expect(packageJson.name).toBe('@proj/my-lib')
  })

  it('should update tsconfig.base.json', async () => {
    await libraryGenerator(tree, { name: 'my-lib' })

    const tsConfig = readJson(tree, 'tsconfig.base.json')
    expect(tsConfig.compilerOptions.paths['@proj/my-lib']).toBeDefined()
  })
})
```

---

## Conversion Utilities

| API                  | Purpose                                   | Node.js Equivalent | Usage Likelihood        | Import                                            |
| -------------------- | ----------------------------------------- | ------------------ | ----------------------- | ------------------------------------------------- |
| `convertNxGenerator` | Convert Nx generator to Angular schematic | N/A                | 🔵 Low (Angular compat) | `import { convertNxGenerator } from '@nx/devkit'` |
| `convertNxExecutor`  | Convert Nx executor to Angular builder    | N/A                | 🔵 Low (Angular compat) | `import { convertNxExecutor } from '@nx/devkit'`  |

### Signatures

```typescript
function convertNxGenerator<T = any>(
  generator: Generator<T>,
  skipWritingConfigInOldFormat?: boolean
): (generatorOptions: T) => (tree: any, context: any) => Promise<any>

function convertNxExecutor(executor: Executor): any
```

### Example: Angular Compatibility

```typescript
// generators/library/generator.ts
import { Tree, formatFiles, generateFiles } from '@nx/devkit'

export async function libraryGenerator(tree: Tree, options: LibraryOptions) {
  // Implementation
  generateFiles(tree, __dirname + '/files', options.directory, options)
  await formatFiles(tree)
}

export default libraryGenerator

// generators/library/generator.compat.ts
import { convertNxGenerator } from '@nx/devkit'
import { libraryGenerator } from './generator'

export default convertNxGenerator(libraryGenerator)
```

---

## Usage Likelihood Summary

### 🔴 Essential (Use in almost every generator/executor)

| API                                     | Category              |
| --------------------------------------- | --------------------- |
| `Tree`                                  | Virtual File System   |
| `generateFiles`                         | Generator Utilities   |
| `formatFiles`                           | Generator Utilities   |
| `addProjectConfiguration`               | Project Configuration |
| `readProjectConfiguration`              | Project Configuration |
| `updateProjectConfiguration`            | Project Configuration |
| `getProjects`                           | Project Configuration |
| `readNxJson`                            | Project Configuration |
| `addDependenciesToPackageJson`          | Package Management    |
| `installPackagesTask`                   | Package Management    |
| `readJson` / `writeJson` / `updateJson` | JSON Utilities        |
| `logger`                                | Logger & Output       |
| `workspaceRoot`                         | Path Utilities        |
| `joinPathFragments`                     | Path Utilities        |
| `names`                                 | Path Utilities        |
| `createProjectGraphAsync`               | Project Graph         |
| `createTreeWithEmptyWorkspace`          | Testing               |

### 🟡 High (Frequently used)

| API                                          | Category              |
| -------------------------------------------- | --------------------- |
| `Tree.delete` / `Tree.rename`                | Virtual File System   |
| `visitNotIgnoredFiles`                       | Generator Utilities   |
| `runTasksInSerial`                           | Generator Utilities   |
| `globAsync`                                  | Generator Utilities   |
| `removeProjectConfiguration`                 | Project Configuration |
| `updateNxJson`                               | Project Configuration |
| `runExecutor`                                | Executor Utilities    |
| `parseTargetString` / `targetToTargetString` | Executor Utilities    |
| `getPackageManagerCommand`                   | Package Management    |
| `detectPackageManager`                       | Package Management    |
| `ensurePackage`                              | Package Management    |
| `removeDependenciesFromPackageJson`          | Package Management    |
| `parseJson` / `serializeJson`                | JSON Utilities        |
| `readJsonFile` / `writeJsonFile`             | JSON Utilities        |
| `output`                                     | Logger & Output       |
| `normalizePath`                              | Path Utilities        |
| `offsetFromRoot`                             | Path Utilities        |
| `moveFilesToNewDirectory`                    | Path Utilities        |
| `readCachedProjectGraph`                     | Project Graph         |
| `DependencyType`                             | Project Graph         |
| `NxPlugin` / `CreateNodesV2`                 | Plugin APIs           |
| `createNodesFromFiles`                       | Plugin APIs           |
| `createTree`                                 | Testing               |

### 🟢 Medium (Occasionally used)

| API                                         | Category              |
| ------------------------------------------- | --------------------- |
| `Tree.listChanges`                          | Virtual File System   |
| `toJS`                                      | Generator Utilities   |
| `glob` (deprecated)                         | Generator Utilities   |
| `getWorkspaceLayout`                        | Project Configuration |
| `readTargetOptions`                         | Executor Utilities    |
| `getDependencyVersionFromPackageJson`       | Package Management    |
| `getPackageManagerVersion`                  | Package Management    |
| `NX_VERSION`                                | Package Management    |
| `stripJsonComments`                         | JSON Utilities        |
| `stripIndents`                              | Path Utilities        |
| `applyChangesToString`                      | Path Utilities        |
| `readProjectsConfigurationFromProjectGraph` | Project Graph         |
| `reverse`                                   | Project Graph         |
| `hashArray`                                 | Hashing               |
| `getOutputsForTargetAndConfiguration`       | Hashing               |
| `CreateDependencies`                        | Plugin APIs           |

### 🔵 Low (Rarely used / specialized)

| API                                     | Category            |
| --------------------------------------- | ------------------- |
| `Tree.changePermissions`                | Virtual File System |
| `FsTree`                                | Virtual File System |
| `updateTsConfigsToJs`                   | Generator Utilities |
| `isWorkspacesEnabled`                   | Package Management  |
| `cacheDir`                              | Path Utilities      |
| `createProjectFileMapUsingProjectGraph` | Project Graph       |
| `CreateMetadata`                        | Plugin APIs         |
| `AggregateCreateNodesError`             | Plugin APIs         |
| `TaskHasher` / `Hasher`                 | Hashing             |
| `convertNxGenerator`                    | Conversion          |
| `convertNxExecutor`                     | Conversion          |

---

## Node.js API Replacement Summary

| Node.js API              | @nx/devkit Replacement | Why Use Devkit                 |
| ------------------------ | ---------------------- | ------------------------------ |
| `fs.readFileSync()`      | `tree.read()`          | Virtual, atomic, testable      |
| `fs.writeFileSync()`     | `tree.write()`         | Virtual, atomic, testable      |
| `fs.existsSync()`        | `tree.exists()`        | Works with pending changes     |
| `fs.unlinkSync()`        | `tree.delete()`        | Tracked in change list         |
| `fs.renameSync()`        | `tree.rename()`        | Tracked in change list         |
| `fs.readdirSync()`       | `tree.children()`      | Includes pending changes       |
| `fs.statSync().isFile()` | `tree.isFile()`        | Includes pending changes       |
| `JSON.parse()`           | `parseJson()`          | JSONC support, better errors   |
| `JSON.stringify()`       | `serializeJson()`      | Consistent formatting          |
| `path.join()`            | `joinPathFragments()`  | Always unix-style              |
| `path.normalize()`       | `normalizePath()`      | Always unix-style              |
| `console.log/warn/error` | `logger.*`             | Consistent Nx formatting       |
| `process.cwd()`          | `workspaceRoot`        | Reliable workspace root        |
| `child_process.spawn`    | `runExecutor()`        | Integrated with Nx             |
| `glob` package           | `globAsync()`          | Tree-aware, respects gitignore |
| `crypto.createHash()`    | `hashArray()`          | Consistent hashing strategy    |

---

## Quick Reference: Common Patterns

### Generator Template

```typescript
import {
  Tree,
  formatFiles,
  generateFiles,
  addProjectConfiguration,
  names,
  offsetFromRoot,
  joinPathFragments,
  getWorkspaceLayout,
} from '@nx/devkit'
import * as path from 'path'

interface GeneratorOptions {
  name: string
  directory?: string
}

export async function myGenerator(tree: Tree, options: GeneratorOptions) {
  const { libsDir } = getWorkspaceLayout(tree)
  const { fileName, className, propertyName } = names(options.name)
  const projectRoot = joinPathFragments(libsDir, options.directory ?? fileName)

  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    sourceRoot: `${projectRoot}/src`,
    projectType: 'library',
    targets: {
      build: {
        executor: '@nx/js:tsc',
        options: {
          /* ... */
        },
      },
    },
  })

  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, {
    ...options,
    fileName,
    className,
    propertyName,
    offsetFromRoot: offsetFromRoot(projectRoot),
    tmpl: '',
  })

  await formatFiles(tree)
}

export default myGenerator
```

### Executor Template

```typescript
import { ExecutorContext, logger, readProjectConfiguration, joinPathFragments } from '@nx/devkit'

interface ExecutorOptions {
  outputPath: string
  watch?: boolean
}

export async function* myExecutor(options: ExecutorOptions, context: ExecutorContext): AsyncGenerator<{ success: boolean }> {
  const project = readProjectConfiguration(context.projectsConfigurations, context.projectName)

  logger.info(`Building ${context.projectName}...`)

  try {
    // Build logic here
    yield { success: true }
  } catch (error) {
    logger.error(`Build failed: ${error.message}`)
    yield { success: false }
  }
}

export default myExecutor
```

---

## Resources

- [Nx Devkit Documentation](https://nx.dev/nx-api/devkit)
- [Creating a Plugin](https://nx.dev/extending-nx/intro/getting-started)
- [Generators Reference](https://nx.dev/extending-nx/recipes/generators)
- [Executors Reference](https://nx.dev/extending-nx/recipes/executors)
