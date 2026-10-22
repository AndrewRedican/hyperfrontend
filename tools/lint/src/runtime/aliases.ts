/**
 * The one resolution hook a process needs to load workspace libraries from their TypeScript
 * source: the `@hyperfrontend/<name>` aliases of `tsconfig.base.json`, and the extensionless
 * relative imports workspace sources use, completed the way the compiler completes them.
 * Importing this module installs the hook once; import it before anything that imports a
 * workspace library.
 *
 * It runs before the aliases exist, so it imports nothing but Node's own modules and reads
 * `tsconfig.base.json` through Node's JSON loading.
 *
 * @module runtime/aliases
 */

import { existsSync, statSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The compiler options this module reads. */
interface BaseCompilerOptions {
  /** The path aliases, each mapped to the source files it names. */
  readonly paths: Readonly<Record<string, readonly string[]>>
}

/** The shape of `tsconfig.base.json` this module reads. */
interface BaseTsconfig {
  /** The compiler options, which hold the aliases. */
  readonly compilerOptions: BaseCompilerOptions
}

/** The workspace root, four directories above this file. */
export const WORKSPACE_ROOT: string = resolve(import.meta.dirname, '..', '..', '..', '..')

/** The suffixes tried, in order, for a relative import that names no file as written. */
const COMPLETIONS = ['.ts', '.tsx', '/index.ts'] as const

const ALIASES: Readonly<Record<string, readonly string[]>> = (
  createRequire(import.meta.url)(resolve(WORKSPACE_ROOT, 'tsconfig.base.json')) as BaseTsconfig
).compilerOptions.paths

/**
 * The file an alias names.
 *
 * @param specifier - An import specifier
 * @returns The absolute file the alias maps to, or null when the specifier is no alias
 */
export function aliasTarget(specifier: string): string | null {
  const targets = ALIASES[specifier]
  return targets === undefined ? null : resolve(WORKSPACE_ROOT, targets[0])
}

/**
 * Whether a file is workspace TypeScript whose relative imports are completed.
 *
 * @param file - An absolute path
 * @returns True for `.ts` and `.tsx` files inside the workspace and outside `node_modules`
 */
export function isWorkspaceSource(file: string): boolean {
  return (
    file.startsWith(`${WORKSPACE_ROOT}${sep}`) &&
    !file.includes(`${sep}node_modules${sep}`) &&
    (file.endsWith('.ts') || file.endsWith('.tsx'))
  )
}

/**
 * Completes an extensionless relative import the way the compiler does: the file with `.ts` or
 * `.tsx` appended, or the directory's `index.ts`.
 *
 * @param specifier - The import specifier
 * @param parentFile - The absolute path of the importing file
 * @returns The completed absolute path, or null when the specifier is not relative, names a file as written, or completes to nothing
 */
export function completeRelative(specifier: string, parentFile: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null
  const base = resolve(dirname(parentFile), specifier)
  if (isFile(base)) return null
  for (const suffix of COMPLETIONS) {
    const candidate = `${base}${suffix}`
    if (isFile(candidate)) return candidate
  }
  return null
}

/**
 * Resolves one specifier the way the hook does.
 *
 * @param specifier - The import specifier
 * @param parentURL - The importing module's URL, when there is one
 * @returns The file URL to load, or null when the hook has nothing to say
 */
export function resolveWorkspace(specifier: string, parentURL: string | undefined): string | null {
  const target = aliasTarget(specifier)
  if (target !== null) return pathToFileURL(target).href
  if (parentURL === undefined || !parentURL.startsWith('file:')) return null
  const parentFile = fileURLToPath(parentURL)
  if (!isWorkspaceSource(parentFile)) return null
  const completed = completeRelative(specifier, parentFile)
  return completed === null ? null : pathToFileURL(completed).href
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

let installed = false

/**
 * The module format of a URL, when this module knows it: workspace TypeScript is always an ES
 * module, which saves Node from parsing each file twice to find out.
 *
 * @param url - The module's URL
 * @returns `module-typescript` for workspace sources, null otherwise
 */
export function formatOf(url: string): string | null {
  return url.startsWith('file:') && isWorkspaceSource(fileURLToPath(url)) ? 'module-typescript' : null
}

/**
 * Installs the hooks; a second call does nothing.
 */
export function install(): void {
  if (installed) return
  installed = true
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const url = resolveWorkspace(specifier, context.parentURL)
      return url === null ? nextResolve(specifier, context) : { url, shortCircuit: true }
    },
    load(url, context, nextLoad) {
      const format = formatOf(url)
      return format === null ? nextLoad(url, context) : nextLoad(url, { ...context, format })
    },
  })
}

install()
