# Layer 2: Project Utilities

> **Document**: 04-layers-project-utilities.md
> **Library**: `@hyperfrontend/project-scope`
> **Layer**: Generic Project Operations

---

## Overview

Layer 2 provides technology-agnostic utilities for working with Node.js/web projects. These utilities build upon Layer 1 and handle:

- File/folder tree traversal and search
- Configuration file detection and parsing
- Package.json utilities
- Project root detection
- Content extraction and parsing

---

## Design Principles

1. **Technology Agnostic**: No framework-specific logic
2. **Composable Functions**: Small functions that combine well
3. **Pattern-Based Detection**: Use file patterns, not assumptions
4. **Graceful Fallbacks**: Handle missing files/configs gracefully

---

## Module: `project/traversal`

### Tree Walking

```typescript
// project/traversal/index.ts
export { walkDirectory, walkTree } from './walk'
export { filterEntries, createFilter } from './filter'
export { findFiles, findDirectories, findByPattern } from './search'
```

### Walk Implementation

```typescript
// project/traversal/walk.ts
import { readDirectory } from '../../core/fs'
import { join } from 'node:path'
import type { Tree } from '../../vfs'
import type { Logger } from '../../logging'

/**
 * Walk options for directory traversal.
 */
export interface WalkOptions {
  /** Maximum depth to traverse (-1 for unlimited) */
  maxDepth?: number
  /** Include hidden files/directories */
  includeHidden?: boolean
  /** Follow symbolic links */
  followSymlinks?: boolean
  /** Patterns to ignore (glob) */
  ignorePatterns?: string[]
  /** Respect .gitignore files */
  respectGitignore?: boolean
  /** Logger instance */
  logger?: Logger
}

/**
 * Entry passed to visitor function.
 */
export interface WalkEntry {
  /** Entry name (basename) */
  name: string
  /** Full path */
  path: string
  /** Relative path from start */
  relativePath: string
  /** Is a file */
  isFile: boolean
  /** Is a directory */
  isDirectory: boolean
  /** Is a symbolic link */
  isSymlink: boolean
  /** Current depth from start */
  depth: number
}

/**
 * Visitor return value.
 */
export type VisitorResult = void | 'skip' | 'stop'

/**
 * Walk directory tree, calling visitor for each entry.
 */
export function walkDirectory(startPath: string, visitor: (entry: WalkEntry) => VisitorResult, options?: WalkOptions): void {
  const maxDepth = options?.maxDepth ?? -1
  const includeHidden = options?.includeHidden ?? false
  const ignorePatterns = options?.ignorePatterns ?? []
  const respectGitignore = options?.respectGitignore ?? true

  // Load gitignore patterns if needed
  const gitignorePatterns = respectGitignore ? loadGitignorePatterns(startPath) : []

  const allIgnorePatterns = [...ignorePatterns, ...gitignorePatterns]

  function walk(currentPath: string, relativePath: string, depth: number): boolean {
    // Check depth limit
    if (maxDepth !== -1 && depth > maxDepth) {
      return true // Continue
    }

    const entries = readDirectory(currentPath)

    for (const entry of entries) {
      // Skip hidden files if not included
      if (!includeHidden && entry.name.startsWith('.')) {
        continue
      }

      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      // Check ignore patterns
      if (matchesIgnorePattern(entryRelativePath, allIgnorePatterns)) {
        continue
      }

      const walkEntry: WalkEntry = {
        name: entry.name,
        path: entry.path,
        relativePath: entryRelativePath,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        isSymlink: entry.isSymlink,
        depth,
      }

      const result = visitor(walkEntry)

      if (result === 'stop') {
        return false // Stop entirely
      }

      if (result === 'skip') {
        continue // Skip this entry's children
      }

      // Recurse into directories
      if (entry.isDirectory) {
        const shouldContinue = walk(entry.path, entryRelativePath, depth + 1)
        if (!shouldContinue) {
          return false
        }
      }
    }

    return true
  }

  walk(startPath, '', 0)
}

/**
 * Walk using a Tree (VFS).
 */
export function walkTree(tree: Tree, startPath: string, visitor: (entry: WalkEntry) => VisitorResult, options?: WalkOptions): void {
  const maxDepth = options?.maxDepth ?? -1
  const includeHidden = options?.includeHidden ?? false

  function walk(currentPath: string, relativePath: string, depth: number): boolean {
    if (maxDepth !== -1 && depth > maxDepth) {
      return true
    }

    const children = tree.children(currentPath)

    for (const name of children) {
      if (!includeHidden && name.startsWith('.')) {
        continue
      }

      const childPath = currentPath ? `${currentPath}/${name}` : name
      const entryRelativePath = relativePath ? `${relativePath}/${name}` : name

      const isFile = tree.isFile(childPath)

      const walkEntry: WalkEntry = {
        name,
        path: childPath,
        relativePath: entryRelativePath,
        isFile,
        isDirectory: !isFile,
        isSymlink: false, // VFS doesn't track symlinks
        depth,
      }

      const result = visitor(walkEntry)

      if (result === 'stop') {
        return false
      }

      if (result === 'skip') {
        continue
      }

      if (!isFile) {
        const shouldContinue = walk(childPath, entryRelativePath, depth + 1)
        if (!shouldContinue) {
          return false
        }
      }
    }

    return true
  }

  walk(startPath, '', 0)
}
```

### Search Implementation

```typescript
// project/traversal/search.ts
import { walkDirectory, walkTree, WalkOptions, WalkEntry } from './walk'
import type { Tree } from '../../vfs'

/**
 * Find options.
 */
export interface FindOptions extends WalkOptions {
  /** Return absolute paths */
  absolutePaths?: boolean
  /** Maximum results to return */
  maxResults?: number
}

/**
 * Find files matching glob patterns.
 */
export function findFiles(startPath: string, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = Array.isArray(patterns) ? patterns : [patterns]
  const results: string[] = []
  const maxResults = options?.maxResults ?? Infinity

  walkDirectory(
    startPath,
    (entry) => {
      if (results.length >= maxResults) {
        return 'stop'
      }

      if (!entry.isFile) {
        return
      }

      if (matchesPatterns(entry.relativePath, normalizedPatterns)) {
        results.push(options?.absolutePaths ? entry.path : entry.relativePath)
      }
    },
    options
  )

  return results
}

/**
 * Find files using Tree (VFS).
 */
export function findFilesInTree(tree: Tree, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = Array.isArray(patterns) ? patterns : [patterns]
  const results: string[] = []
  const maxResults = options?.maxResults ?? Infinity

  walkTree(
    tree,
    '',
    (entry) => {
      if (results.length >= maxResults) {
        return 'stop'
      }

      if (!entry.isFile) {
        return
      }

      if (matchesPatterns(entry.relativePath, normalizedPatterns)) {
        results.push(entry.relativePath)
      }
    },
    options
  )

  return results
}

/**
 * Find directories matching patterns.
 */
export function findDirectories(startPath: string, patterns: string | string[], options?: FindOptions): string[] {
  const normalizedPatterns = Array.isArray(patterns) ? patterns : [patterns]
  const results: string[] = []

  walkDirectory(
    startPath,
    (entry) => {
      if (!entry.isDirectory) {
        return
      }

      if (matchesPatterns(entry.relativePath, normalizedPatterns)) {
        results.push(options?.absolutePaths ? entry.path : entry.relativePath)
      }
    },
    options
  )

  return results
}

/**
 * Internal: Check if path matches any pattern.
 */
function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchGlob(path, pattern))
}

/**
 * Internal: Simple glob matching implementation.
 */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(path)
}
```

---

## Module: `project/config`

### Configuration Detection

```typescript
// project/config/index.ts
export { detectConfigs, findConfigFile, getConfigPaths } from './detect'
export { parseConfig, parseJsonConfig, parseYamlConfig } from './parse'
export { CONFIG_PATTERNS, getConfigPatternsByType } from './patterns'
```

### Configuration Patterns

```typescript
// project/config/patterns.ts

/**
 * Known configuration file patterns organized by type.
 */
export const CONFIG_PATTERNS: Record<ConfigType, ConfigPatternInfo> = {
  // Package Management
  'package.json': {
    patterns: ['package.json'],
    format: 'json',
    description: 'NPM package manifest',
  },
  'package-lock.json': {
    patterns: ['package-lock.json'],
    format: 'json',
    description: 'NPM lockfile',
  },
  'pnpm-lock.yaml': {
    patterns: ['pnpm-lock.yaml'],
    format: 'yaml',
    description: 'PNPM lockfile',
  },
  'yarn.lock': {
    patterns: ['yarn.lock'],
    format: 'text',
    description: 'Yarn lockfile',
  },
  '.npmrc': {
    patterns: ['.npmrc'],
    format: 'ini',
    description: 'NPM configuration',
    sensitive: true,
  },

  // TypeScript
  tsconfig: {
    patterns: ['tsconfig.json', 'tsconfig.*.json'],
    format: 'jsonc',
    description: 'TypeScript configuration',
    canExtend: true,
  },

  // Monorepo
  nx: {
    patterns: ['nx.json'],
    format: 'json',
    description: 'NX workspace configuration',
  },
  'project.json': {
    patterns: ['project.json', '**/project.json'],
    format: 'json',
    description: 'NX project configuration',
  },
  'workspace.json': {
    patterns: ['workspace.json'],
    format: 'json',
    description: 'NX workspace projects (deprecated)',
  },
  turbo: {
    patterns: ['turbo.json'],
    format: 'jsonc',
    description: 'TurboRepo configuration',
  },
  lerna: {
    patterns: ['lerna.json'],
    format: 'json',
    description: 'Lerna configuration',
  },

  // Build Tools
  webpack: {
    patterns: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.cjs', 'webpack.config.mjs'],
    format: 'js',
    description: 'Webpack configuration',
  },
  rollup: {
    patterns: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
    format: 'js',
    description: 'Rollup configuration',
  },
  vite: {
    patterns: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    format: 'js',
    description: 'Vite configuration',
  },
  esbuild: {
    patterns: ['esbuild.config.js', 'esbuild.config.ts', 'esbuild.config.mjs'],
    format: 'js',
    description: 'esbuild configuration',
  },
  babel: {
    patterns: ['babel.config.js', 'babel.config.json', '.babelrc', '.babelrc.js', '.babelrc.json'],
    format: 'json', // Primary format
    description: 'Babel configuration',
  },
  swc: {
    patterns: ['.swcrc'],
    format: 'json',
    description: 'SWC configuration',
  },

  // Testing
  jest: {
    patterns: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'],
    format: 'js',
    description: 'Jest configuration',
  },
  vitest: {
    patterns: ['vitest.config.js', 'vitest.config.ts'],
    format: 'js',
    description: 'Vitest configuration',
  },
  cypress: {
    patterns: ['cypress.config.js', 'cypress.config.ts'],
    format: 'js',
    description: 'Cypress configuration',
  },
  playwright: {
    patterns: ['playwright.config.js', 'playwright.config.ts'],
    format: 'js',
    description: 'Playwright configuration',
  },

  // Framework configs
  next: {
    patterns: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    format: 'js',
    description: 'Next.js configuration',
  },
  angular: {
    patterns: ['angular.json'],
    format: 'json',
    description: 'Angular CLI configuration',
  },
  nuxt: {
    patterns: ['nuxt.config.js', 'nuxt.config.ts'],
    format: 'js',
    description: 'Nuxt.js configuration',
  },
  svelte: {
    patterns: ['svelte.config.js', 'svelte.config.ts'],
    format: 'js',
    description: 'SvelteKit configuration',
  },
  astro: {
    patterns: ['astro.config.js', 'astro.config.ts', 'astro.config.mjs'],
    format: 'js',
    description: 'Astro configuration',
  },

  // Linting & Formatting
  eslint: {
    patterns: [
      'eslint.config.js',
      'eslint.config.cjs',
      'eslint.config.mjs',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yml',
    ],
    format: 'js', // Primary modern format
    description: 'ESLint configuration',
  },
  prettier: {
    patterns: ['prettier.config.js', 'prettier.config.cjs', '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml'],
    format: 'json', // Primary format
    description: 'Prettier configuration',
  },

  // Environment (sensitive)
  env: {
    patterns: ['.env', '.env.*', '*.env'],
    format: 'dotenv',
    description: 'Environment variables',
    sensitive: true,
  },

  // Git
  '.gitignore': {
    patterns: ['.gitignore'],
    format: 'text',
    description: 'Git ignore patterns',
  },
  '.gitattributes': {
    patterns: ['.gitattributes'],
    format: 'text',
    description: 'Git attributes',
  },
}

/**
 * Configuration type identifier.
 */
export type ConfigType = keyof typeof CONFIG_PATTERNS

/**
 * Configuration pattern information.
 */
export interface ConfigPatternInfo {
  /** File patterns to match */
  patterns: string[]
  /** Primary format */
  format: 'json' | 'jsonc' | 'yaml' | 'js' | 'ts' | 'ini' | 'dotenv' | 'text'
  /** Human-readable description */
  description: string
  /** Whether config can extend others */
  canExtend?: boolean
  /** Whether file may contain secrets */
  sensitive?: boolean
}

/**
 * Get patterns for specific config types.
 */
export function getConfigPatternsByType(types: ConfigType[]): string[] {
  return types.flatMap((type) => CONFIG_PATTERNS[type]?.patterns ?? [])
}
```

### Configuration Detection

```typescript
// project/config/detect.ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CONFIG_PATTERNS, ConfigType, ConfigPatternInfo } from './patterns'
import { findFiles } from '../traversal'
import type { Tree } from '../../vfs'

/**
 * Detected configuration file.
 */
export interface DetectedConfig {
  /** Config type */
  type: ConfigType
  /** File path */
  path: string
  /** Pattern that matched */
  matchedPattern: string
  /** Pattern info */
  info: ConfigPatternInfo
}

/**
 * Detect all configuration files in a directory.
 */
export function detectConfigs(rootPath: string, types?: ConfigType[], options?: { maxDepth?: number }): DetectedConfig[] {
  const typesToCheck = types ?? (Object.keys(CONFIG_PATTERNS) as ConfigType[])
  const results: DetectedConfig[] = []

  for (const type of typesToCheck) {
    const info = CONFIG_PATTERNS[type]
    if (!info) continue

    for (const pattern of info.patterns) {
      // Check if pattern is root-level or recursive
      const isRecursive = pattern.includes('**')

      if (isRecursive) {
        const files = findFiles(rootPath, pattern, {
          maxDepth: options?.maxDepth ?? 10,
        })

        for (const file of files) {
          results.push({
            type,
            path: file,
            matchedPattern: pattern,
            info,
          })
        }
      } else {
        // Direct file check
        const fullPath = join(rootPath, pattern)
        if (existsSync(fullPath)) {
          results.push({
            type,
            path: pattern,
            matchedPattern: pattern,
            info,
          })
        }
      }
    }
  }

  return results
}

/**
 * Find specific configuration file, checking multiple patterns.
 */
export function findConfigFile(rootPath: string, type: ConfigType): string | null {
  const info = CONFIG_PATTERNS[type]
  if (!info) return null

  for (const pattern of info.patterns) {
    // Simple patterns only (no globs)
    if (!pattern.includes('*')) {
      const fullPath = join(rootPath, pattern)
      if (existsSync(fullPath)) {
        return fullPath
      }
    }
  }

  return null
}

/**
 * Get all known config paths for a type.
 */
export function getConfigPaths(type: ConfigType): string[] {
  const info = CONFIG_PATTERNS[type]
  return info?.patterns ?? []
}
```

### Configuration Parsing

```typescript
// project/config/parse.ts
import { readFileContent } from '../../core/fs'
import { CONFIG_PATTERNS, ConfigType } from './patterns'
import type { Logger } from '../../logging'

/**
 * Parsed configuration result.
 */
export interface ParsedConfig {
  /** Config type */
  type: ConfigType
  /** Source file path */
  path: string
  /** File format */
  format: string
  /** Parsed data (for JSON/YAML formats) */
  data?: Record<string, unknown>
  /** Raw content (for text formats) */
  raw?: string
  /** Extended config paths (if any) */
  extends?: string[]
}

/**
 * Parse configuration file.
 */
export function parseConfig(
  filePath: string,
  type?: ConfigType,
  logger?: Logger
): ParsedConfig {
  const content = readFileContent(filePath)

  // Determine type from file name if not provided
  const detectedType = type ?? detectConfigType(filePath)
  const info = detectedType ? CONFIG_PATTERNS[detectedType] : null
  const format = info?.format ?? detectFormat(filePath)

  logger?.debug(`Parsing config ${filePath} as ${format}`)

  switch (format) {
    case 'json':
    case 'jsonc':
      return parseJsonConfig(filePath, content, detectedType, format)

    case 'yaml':
      return parseYamlConfig(filePath, content, detectedType)

    case 'ini':
      return parseIniConfig(filePath, content, detectedType)

    case 'dotenv':
      return parseDotenvConfig(filePath, content, detectedType)

    case 'js':
    case 'ts':
      // JS/TS configs cannot be parsed statically
      return {
        type: detectedType ?? 'unknown' as ConfigType,
        path: filePath,
        format,
        raw: content,
      }

    default:
      return {
        type: detectedType ?? 'unknown' as ConfigType,
        path: filePath,
        format: 'text',
        raw: content,
      }
  }
}

/**
 * Parse JSON/JSONC configuration.
 */
export function parseJsonConfig(
  filePath: string,
  content: string,
  type?: ConfigType,
  format: 'json' | 'jsonc' = 'json'
): ParsedConfig {
  // Strip comments for JSONC
  const cleanContent = format === 'jsonc' ? stripJsonComments(content) : content

  try {
    const data = JSON.parse(cleanContent)

    // Check for extends
    let extendsPath: string[] | undefined
    if (typeof data.extends === 'string') {
      extendsPath = [data.extends]
    } else if (Array.isArray(data.extends)) {
      extendsPath = data.extends
    }

    return {
      type: type ?? 'unknown' as ConfigType,
      path: filePath,
      format,
      data,
      extends: extendsPath,
    }
  } catch (error) {
    throw new ConfigParseError(
      `Failed to parse JSON config: ${filePath}`,
      'CONFIG_PARSE_ERROR',
      { filePath, format, cause: error }
    )
  }
}

/**
 * Parse YAML configuration.
 */
export function parseYamlConfig(
  filePath: string,
  content: string,
  type?: ConfigType
): ParsedConfig {
  // Simple YAML parsing for common cases
  // Full YAML parsing would require a library
  const data = parseSimpleYaml(content)

  return {
    type: type ?? 'unknown' as ConfigType,
    path: filePath,
    format: 'yaml',
    data,
  }
}

/**
 * Strip JSON comments (// and /* */).
 */
function stripJsonComments(content: string): string {
  let result = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false
  let stringChar = ''

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        result += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false
        i++ // Skip /
      }
      continue
    }

    if (inString) {
      result += char
      if (char === stringChar && content[i - 1] !== '\\') {
        inString = false
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringChar = char
      result += char
      continue
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true
      i++ // Skip second /
      continue
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true
      i++ // Skip *
      continue
    }

    result += char
  }

  return result
}

/**
 * Simple YAML parser for common config structures.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  // This is a simplified implementation
  // For full YAML support, consider using a proper parser
  const lines = content.split('\n')
  const result: Record<string, unknown> = {}

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.includes(':')) {
      continue
    }

    const colonIndex = line.indexOf(':')
    const key = line.substring(0, colonIndex).trim()
    const value = line.substring(colonIndex + 1).trim()

    if (key && value) {
      // Parse basic types
      if (value === 'true') {
        result[key] = true
      } else if (value === 'false') {
        result[key] = false
      } else if (value === 'null') {
        result[key] = null
      } else if (/^-?\d+$/.test(value)) {
        result[key] = parseInt(value, 10)
      } else if (/^-?\d+\.\d+$/.test(value)) {
        result[key] = parseFloat(value)
      } else {
        // Remove quotes if present
        result[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  }

  return result
}
```

---

## Module: `project/package`

### Package.json Utilities

```typescript
// project/package/index.ts
export { readPackageJson, readPackageJsonSync } from './read'
export { writePackageJson } from './write'
export { getDependencies, getDevDependencies, getAllDependencies, hasDependency, getDependencyVersion } from './dependencies'
export { getScripts, hasScript, getScript } from './scripts'
```

### Package.json Reading

```typescript
// project/package/read.ts
import { readFileContent, readFileIfExists } from '../../core/fs'
import { join } from 'node:path'
import type { PackageJson } from '../../models'

/**
 * Read and parse package.json.
 * @throws ConfigParseError if file doesn't exist or is invalid
 */
export function readPackageJson(projectPath: string): PackageJson {
  const packageJsonPath = projectPath.endsWith('package.json') ? projectPath : join(projectPath, 'package.json')

  const content = readFileContent(packageJsonPath)

  try {
    const data = JSON.parse(content)
    return validatePackageJson(data)
  } catch (error) {
    throw new ConfigParseError(`Failed to parse package.json: ${packageJsonPath}`, 'CONFIG_PARSE_ERROR', {
      filePath: packageJsonPath,
      cause: error,
    })
  }
}

/**
 * Read package.json if it exists, null otherwise.
 */
export function readPackageJsonIfExists(projectPath: string): PackageJson | null {
  const packageJsonPath = projectPath.endsWith('package.json') ? projectPath : join(projectPath, 'package.json')

  const content = readFileIfExists(packageJsonPath)
  if (!content) return null

  try {
    return validatePackageJson(JSON.parse(content))
  } catch {
    return null
  }
}

/**
 * Validate and type package.json data.
 */
function validatePackageJson(data: unknown): PackageJson {
  if (typeof data !== 'object' || data === null) {
    throw new Error('package.json must be an object')
  }

  const pkg = data as Record<string, unknown>

  // Ensure required fields have defaults
  return {
    name: typeof pkg.name === 'string' ? pkg.name : '',
    version: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
    description: typeof pkg.description === 'string' ? pkg.description : undefined,
    main: typeof pkg.main === 'string' ? pkg.main : undefined,
    module: typeof pkg.module === 'string' ? pkg.module : undefined,
    types: typeof pkg.types === 'string' ? pkg.types : undefined,
    exports: typeof pkg.exports === 'object' ? (pkg.exports as Record<string, unknown>) : undefined,
    scripts: isStringRecord(pkg.scripts) ? pkg.scripts : undefined,
    dependencies: isStringRecord(pkg.dependencies) ? pkg.dependencies : undefined,
    devDependencies: isStringRecord(pkg.devDependencies) ? pkg.devDependencies : undefined,
    peerDependencies: isStringRecord(pkg.peerDependencies) ? pkg.peerDependencies : undefined,
    optionalDependencies: isStringRecord(pkg.optionalDependencies) ? pkg.optionalDependencies : undefined,
    workspaces: parseWorkspaces(pkg.workspaces),
    engines: isStringRecord(pkg.engines) ? pkg.engines : undefined,
    ...pkg, // Include all other fields
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

function parseWorkspaces(value: unknown): string[] | { packages: string[] } | undefined {
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.packages)) {
      return { packages: obj.packages as string[] }
    }
  }
  return undefined
}
```

### Dependencies Utilities

```typescript
// project/package/dependencies.ts
import { readPackageJson, readPackageJsonIfExists } from './read'
import type { PackageJson } from '../../models'

/**
 * Get production dependencies.
 */
export function getDependencies(packageJson: PackageJson): Record<string, string> {
  return packageJson.dependencies ?? {}
}

/**
 * Get development dependencies.
 */
export function getDevDependencies(packageJson: PackageJson): Record<string, string> {
  return packageJson.devDependencies ?? {}
}

/**
 * Get peer dependencies.
 */
export function getPeerDependencies(packageJson: PackageJson): Record<string, string> {
  return packageJson.peerDependencies ?? {}
}

/**
 * Get all dependencies merged.
 */
export function getAllDependencies(packageJson: PackageJson): Record<string, string> {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  }
}

/**
 * Check if package has a dependency.
 */
export function hasDependency(
  packageJson: PackageJson,
  depName: string,
  depTypes: ('dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies')[] = ['dependencies']
): boolean {
  for (const depType of depTypes) {
    if (packageJson[depType]?.[depName]) {
      return true
    }
  }
  return false
}

/**
 * Get dependency version.
 */
export function getDependencyVersion(packageJson: PackageJson, depName: string): string | null {
  return (
    packageJson.dependencies?.[depName] ??
    packageJson.devDependencies?.[depName] ??
    packageJson.peerDependencies?.[depName] ??
    packageJson.optionalDependencies?.[depName] ??
    null
  )
}

/**
 * Check if path contains a specific package in node_modules.
 */
export function hasInstalledPackage(projectPath: string, packageName: string): boolean {
  const pkgPath = join(projectPath, 'node_modules', packageName, 'package.json')
  return readPackageJsonIfExists(pkgPath) !== null
}

/**
 * Get installed package version.
 */
export function getInstalledVersion(projectPath: string, packageName: string): string | null {
  const pkg = readPackageJsonIfExists(join(projectPath, 'node_modules', packageName, 'package.json'))
  return pkg?.version ?? null
}
```

---

## Module: `project/root`

### Project Root Detection

```typescript
// project/root/index.ts
export { findProjectRoot, findWorkspaceRoot, findNearestPackageJson } from './detect'
```

### Root Detection Implementation

```typescript
// project/root/detect.ts
import { existsSync } from 'node:fs'
import { join, dirname, resolve, parse } from 'node:path'
import { readPackageJsonIfExists } from '../package'
import { findConfigFile } from '../config'

/**
 * Markers for workspace roots (monorepo roots).
 */
const WORKSPACE_MARKERS = ['nx.json', 'turbo.json', 'lerna.json', 'pnpm-workspace.yaml', 'rush.json'] as const

/**
 * Markers that indicate project root (not workspace root).
 */
const PROJECT_MARKERS = ['package.json', 'project.json'] as const

/**
 * Find the project root from a starting path.
 * Project root is the nearest directory containing package.json
 * with source files.
 */
export function findProjectRoot(startPath: string): string | null {
  let currentPath = resolve(startPath)
  const root = parse(currentPath).root

  while (currentPath !== root) {
    // Check for package.json
    if (existsSync(join(currentPath, 'package.json'))) {
      // Verify it looks like a project (has src/ or index.* file)
      if (looksLikeProjectDir(currentPath)) {
        return currentPath
      }
    }

    // Check for project.json (NX project marker)
    if (existsSync(join(currentPath, 'project.json'))) {
      return currentPath
    }

    currentPath = dirname(currentPath)
  }

  return null
}

/**
 * Find workspace root (monorepo root).
 * Searches up for workspace markers like nx.json, turbo.json, etc.
 */
export function findWorkspaceRoot(startPath: string): string | null {
  let currentPath = resolve(startPath)
  const root = parse(currentPath).root

  while (currentPath !== root) {
    // Check for workspace markers
    for (const marker of WORKSPACE_MARKERS) {
      if (existsSync(join(currentPath, marker))) {
        return currentPath
      }
    }

    // Check for package.json with workspaces field
    const pkg = readPackageJsonIfExists(currentPath)
    if (pkg?.workspaces) {
      return currentPath
    }

    currentPath = dirname(currentPath)
  }

  // Fall back to nearest package.json at root level
  return findNearestPackageJson(startPath)
}

/**
 * Find nearest package.json going up.
 */
export function findNearestPackageJson(startPath: string): string | null {
  let currentPath = resolve(startPath)
  const root = parse(currentPath).root

  while (currentPath !== root) {
    if (existsSync(join(currentPath, 'package.json'))) {
      return currentPath
    }
    currentPath = dirname(currentPath)
  }

  return null
}

/**
 * Find nearest config file of given types going up.
 */
export function findNearestConfig(startPath: string, configTypes: ConfigType[]): string | null {
  let currentPath = resolve(startPath)
  const root = parse(currentPath).root

  while (currentPath !== root) {
    for (const type of configTypes) {
      const configPath = findConfigFile(currentPath, type)
      if (configPath) {
        return configPath
      }
    }
    currentPath = dirname(currentPath)
  }

  return null
}

/**
 * Check if directory looks like a project directory.
 */
function looksLikeProjectDir(dirPath: string): boolean {
  // Has src/ directory
  if (existsSync(join(dirPath, 'src'))) {
    return true
  }

  // Has entry point files
  const entryPoints = ['index.ts', 'index.js', 'index.tsx', 'index.jsx', 'main.ts', 'main.js']
  for (const entry of entryPoints) {
    if (existsSync(join(dirPath, entry))) {
      return true
    }
  }

  // Has project.json (NX project)
  if (existsSync(join(dirPath, 'project.json'))) {
    return true
  }

  return false
}
```

---

## Internal Dependencies

Layer 2 **depends on**:

| Library                         | Usage                                    |
| ------------------------------- | ---------------------------------------- |
| Layer 1 (Core Utilities)        | File system, path operations             |
| `@hyperfrontend/data-utils`     | Tree/object traversal for config parsing |
| `@hyperfrontend/json-utils`     | JSON validation and parsing              |
| `@hyperfrontend/function-utils` | Caching, error handling                  |

---

## Related Documents

- [Architecture](./01-architecture.md)
- [Layer 1: Core Utilities](./03-layers-core-utilities.md)
- [Layer 3: Tech Stack Utilities](./05-layers-tech-stack.md)
