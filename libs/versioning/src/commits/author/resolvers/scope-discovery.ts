import type { ScopeFilterContext } from '../models/session-config'
import { isAbsolute, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { findProjectRoot } from '@hyperfrontend/project-scope/project/root'

/** Options controlling `discoverScopes`. */
export interface DiscoverScopesOptions {
  /** Optional caller-provided filter; applied after built-in exclusions */
  readonly scopeFilter?: (context: ScopeFilterContext) => boolean

  /** Working directory that staged paths are resolved against */
  readonly cwd: string
}

/** Single discovered scope with the project root it came from. */
export interface DiscoveredScope {
  /** Scope identifier (the project's `name` field) */
  readonly name: string

  /** Absolute path to the owning project root */
  readonly path: string
}

/** Minimal project.json shape used by the discovery walk. */
interface ProjectManifest {
  /** Project name as declared in `project.json` / `package.json` */
  readonly name?: string
}

const EXCLUDED_PATH_SEGMENTS = ['/node_modules/', '/.git/'] as const

/**
 * Resolves each staged path to its owning project by walking upward to the
 * nearest `project.json` / `package.json`, reads the `name` field, and returns
 * the unique set as `DiscoveredScope` entries. Entries inside `node_modules`
 * or `.git` are dropped before walking; the caller's `scopeFilter` is applied
 * after collection.
 *
 * @param stagedPaths - Paths emitted by the staged-paths provider (relative or absolute)
 * @param options - Filter + cwd configuration
 * @returns Unique scopes in staging order (first appearance wins)
 *
 * @example Discovering scopes for a set of staged files
 * ```typescript
 * discoverScopes(['libs/versioning/src/a.ts', 'libs/questions/src/b.ts'], { cwd: '/repo' })
 * // => [
 * //   { name: '@hyperfrontend/versioning', path: '/repo/libs/versioning' },
 * //   { name: '@hyperfrontend/questions', path: '/repo/libs/questions' },
 * // ]
 * ```
 */
export function discoverScopes(stagedPaths: readonly string[], options: DiscoverScopesOptions): readonly DiscoveredScope[] {
  const seenPaths = createSet<string>()
  const discovered: DiscoveredScope[] = []

  for (const stagedPath of stagedPaths) {
    if (isExcluded(stagedPath)) continue

    const absolutePath = isAbsolute(stagedPath) ? stagedPath : join(options.cwd, stagedPath)
    const projectRoot = findProjectRoot(absolutePath)
    if (projectRoot === null) continue
    if (seenPaths.has(projectRoot)) continue
    seenPaths.add(projectRoot)

    const name = readProjectName(projectRoot)
    if (name === null) continue

    if (options.scopeFilter && !options.scopeFilter({ path: projectRoot, name })) continue

    discovered.push({ name, path: projectRoot })
  }

  return discovered
}

/**
 * Reads the `name` field from `project.json` (preferred) or `package.json`
 * located at the given project root.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Project name or null when neither manifest declares one
 */
function readProjectName(projectRoot: string): string | null {
  const fromProjectJson = readManifestName(join(projectRoot, 'project.json'))
  if (fromProjectJson !== null) return fromProjectJson
  return readManifestName(join(projectRoot, 'package.json'))
}

/**
 * Reads and parses a manifest file, returning its `name` field when present.
 *
 * @param manifestPath - Absolute path to a JSON manifest
 * @returns Parsed name or null when the file is missing or lacks a name
 */
function readManifestName(manifestPath: string): string | null {
  const content = readFileIfExists(manifestPath)
  if (content === null) return null
  try {
    const manifest = parse(content) as ProjectManifest
    return manifest.name ?? null
  } catch {
    return null
  }
}

/**
 * Returns true when the staged path falls inside a built-in excluded segment.
 *
 * @param stagedPath - Raw staged path from git
 * @returns True to drop the path from discovery
 */
function isExcluded(stagedPath: string): boolean {
  const normalized = `/${stagedPath}/`
  for (const segment of EXCLUDED_PATH_SEGMENTS) {
    if (normalized.includes(segment)) return true
  }
  return false
}
