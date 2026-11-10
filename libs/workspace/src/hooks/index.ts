/**
 * The resolution hook that loads a workspace's TypeScript from source: the path aliases of
 * `tsconfig.base.json`, and extensionless relative imports completed the way the compiler does.
 *
 * @remarks
 * Importing this module installs the hook for the workspace this file lives in and for the
 * workspace above the working directory. It runs before the aliases exist, so it imports nothing
 * but Node's own modules and reads `tsconfig.base.json` through Node's JSON loading.
 *
 * @module @hyperfrontend/workspace/hooks
 */

/* lint-disable workspace/lib-require-jsdoc-example */

import { existsSync, statSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The compiler options this module reads. */
interface BaseCompilerOptions {
  /** The path aliases, each mapped to the source files it names. */
  readonly paths?: Readonly<Record<string, readonly string[]>>
}

/** The shape of `tsconfig.base.json` this module reads. */
interface BaseTsconfig {
  /** The compiler options, which hold the aliases. */
  readonly compilerOptions?: BaseCompilerOptions
}

/** The sources of one workspace, as the hook resolves them. */
export interface WorkspaceSources {
  /** The workspace root, absolute. */
  readonly root: string
  /** The path aliases, each mapped to the source files it names, workspace-relative. */
  readonly aliases: Readonly<Record<string, readonly string[]>>
}

/** The file that marks a workspace root. */
const WORKSPACE_FILE = 'hf.json'

/** The file that holds the path aliases. */
const BASE_TSCONFIG = 'tsconfig.base.json'

/** The suffixes tried, in order, for a relative import that names no file as written. */
const COMPLETIONS = ['.ts', '.tsx', `${sep}index.ts`] as const

/**
 * The workspace root above a directory.
 *
 * @param directory - Where to start, absolute
 * @returns The nearest directory at or above it that holds the workspace file, or null when none does
 */
export function workspaceRootFrom(directory: string): string | null {
  if (existsSync(join(directory, WORKSPACE_FILE))) return directory
  const parent = dirname(directory)
  return parent === directory ? null : workspaceRootFrom(parent)
}

/**
 * The sources of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns The root with the path aliases of its base tsconfig, none when it has no such file or the file declares none
 */
export function readSources(root: string): WorkspaceSources {
  const file = join(root, BASE_TSCONFIG)
  const tsconfig = existsSync(file) ? (createRequire(import.meta.url)(/* hf-graph: opaque */ file) as BaseTsconfig) : {}
  return { root, aliases: tsconfig.compilerOptions?.paths ?? {} }
}

/**
 * The file an alias names.
 *
 * @param sources - The workspace whose aliases are read
 * @param specifier - An import specifier
 * @returns The absolute file the alias maps to, or null when the specifier is no alias
 */
export function aliasTarget(sources: WorkspaceSources, specifier: string): string | null {
  const first = sources.aliases[specifier]?.[0]
  return first === undefined ? null : resolve(sources.root, first)
}

/**
 * Whether a file is workspace TypeScript whose relative imports are completed.
 *
 * @param root - The workspace root, absolute
 * @param file - An absolute path
 * @returns True for `.ts` and `.tsx` files inside the workspace and outside `node_modules`
 */
export function isWorkspaceSource(root: string, file: string): boolean {
  return file.startsWith(`${root}${sep}`) && !file.includes(`${sep}node_modules${sep}`) && (file.endsWith('.ts') || file.endsWith('.tsx'))
}

/**
 * Whether a path is an existing regular file.
 *
 * @param path - An absolute path
 * @returns True for a file
 */
function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

/**
 * Completes an extensionless relative import the way the compiler does: the file with `.ts` or
 * `.tsx` appended, or the directory's `index.ts`.
 *
 * @param specifier - The import specifier
 * @param parentFile - The absolute path of the importing file
 * @returns The completed absolute path, or null when the specifier is not relative, names a file as written, or completes to nothing
 *
 * @example The three completions, and the cases the hook leaves to Node
 * ```typescript
 * const parent = '/repo/libs/features/src/index.ts'
 * completeRelative('./host/open', parent) // => '/repo/libs/features/src/host/open.ts'
 * completeRelative('./host', parent) // => '/repo/libs/features/src/host/index.ts', when host/ is a directory
 * completeRelative('./host/open.ts', parent) // => null, the file exists as written
 * completeRelative('@hyperfrontend/nexus', parent) // => null, not relative
 * ```
 */
export function completeRelative(specifier: string, parentFile: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null
  const base = resolve(dirname(parentFile), specifier)
  if (isFile(base)) return null
  return COMPLETIONS.map((suffix) => `${base}${suffix}`).find(isFile) ?? null
}

/**
 * Resolves one specifier the way the hook does.
 *
 * @param sources - The workspace whose sources are resolved
 * @param specifier - The import specifier
 * @param parentURL - The importing module's URL, when there is one
 * @returns The file URL to load, or null when the hook has nothing to say
 *
 * @example An alias resolves from anywhere, a relative import only from workspace TypeScript
 * ```typescript
 * const sources = readSources('/repo')
 * resolveWorkspace(sources, '@hyperfrontend/nexus', undefined) // => 'file:///repo/libs/nexus/src/index.ts'
 * resolveWorkspace(sources, './host', 'file:///repo/libs/features/src/index.ts') // => 'file:///repo/libs/features/src/host/index.ts'
 * resolveWorkspace(sources, './host', 'file:///repo/node_modules/pkg/index.js') // => null
 * resolveWorkspace(sources, 'typescript', 'file:///repo/libs/features/src/index.ts') // => null, Node resolves it
 * ```
 */
export function resolveWorkspace(sources: WorkspaceSources, specifier: string, parentURL: string | undefined): string | null {
  const target = aliasTarget(sources, specifier)
  if (target !== null) return pathToFileURL(target).href
  if (parentURL === undefined || !parentURL.startsWith('file:')) return null
  const parentFile = fileURLToPath(parentURL)
  if (!isWorkspaceSource(sources.root, parentFile)) return null
  const completed = completeRelative(specifier, parentFile)
  return completed === null ? null : pathToFileURL(completed).href
}

/**
 * The module format of a URL, when this module knows it: workspace TypeScript is always an ES
 * module, which saves Node from parsing each file twice to find out.
 *
 * @param root - The workspace root, absolute
 * @param url - The module's URL
 * @returns `module-typescript` for workspace sources, null otherwise
 */
export function formatOf(root: string, url: string): string | null {
  return url.startsWith('file:') && isWorkspaceSource(root, fileURLToPath(url)) ? 'module-typescript' : null
}

/** The workspaces the hooks resolve, in the order they were installed. */
const installed: WorkspaceSources[] = []

/**
 * Installs the hooks for a workspace. A workspace installed twice is resolved once, and one
 * installed after another is asked after it.
 *
 * @param root - The workspace root, absolute
 *
 * @example Running a workspace's TypeScript from source
 * ```bash
 * node --import @hyperfrontend/workspace/hooks tools/scripts/report.ts
 * ```
 * Importing the module installs the hooks for the workspace above the working directory; call
 * `installAliases` only for a second workspace, which is asked after the first.
 *
 * @example Lending a script the aliases of another workspace
 * ```typescript
 * import { installAliases } from '@hyperfrontend/workspace/hooks'
 *
 * installAliases('/repos/other-workspace')
 * installAliases('/repos/other-workspace') // a second call for the same root changes nothing
 * const { buildGraph } = await import('@other/graph') // an alias of the other workspace's tsconfig.base.json
 * ```
 */
export function installAliases(root: string): void {
  if (installed.some((sources) => sources.root === root)) return
  installed.push(readSources(root))
  if (installed.length > 1) return
  registerHooks({
    resolve(specifier, context, nextResolve) {
      for (const sources of installed) {
        const url = resolveWorkspace(sources, specifier, context.parentURL)
        if (url !== null) return { url, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
      const format = installed.map((sources) => formatOf(sources.root, url)).find((found) => found !== null)
      return format === undefined ? nextLoad(url, context) : nextLoad(url, { ...context, format })
    },
  })
}

/**
 * Installs the hooks for the workspace above a directory, when there is one.
 *
 * @param directory - Where to look from, absolute
 *
 * @example Installing for the workspace a file belongs to
 * ```typescript
 * installFrom(dirname(fileURLToPath(import.meta.url))) // finds the nearest hf.json above this file
 * installFrom('/tmp') // does nothing: no workspace above
 * ```
 */
export function installFrom(directory: string): void {
  const root = workspaceRootFrom(directory)
  if (root !== null) installAliases(root)
}

/**
 * The workspace a module of this package lives in as source: the one above its directory, unless
 * the package is installed, when it belongs to no workspace's sources.
 *
 * @param directory - The directory of the module, absolute
 * @returns The workspace root, or null for an installed package or a directory with no workspace above it
 */
export function homeOf(directory: string): string | null {
  return directory.split(sep).includes('node_modules') ? null : workspaceRootFrom(directory)
}

// why: the workspace these sources live in comes first, so a command line run from source in another workspace still finds its own libraries; then the workspace it was started in, whose executors, generators and configurations it loads
// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const home = homeOf(typeof __dirname === 'string' ? __dirname : import.meta.dirname)
if (home !== null) installAliases(home)
installFrom(process.cwd())
