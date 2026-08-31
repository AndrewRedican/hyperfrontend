import type { AliasTable } from './paths.ts'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { currentGeneration } from './generation.ts'
import { firstExistingFile, resolveAlias } from './paths.ts'

/**
 * A compiled `moduleNameMapper` entry.
 */
export type ModuleMapping = {
  /** The pattern a specifier must match. */
  pattern: RegExp
  /** The replacement path, supporting the `$1` capture references `String.replace` understands. */
  replacement: string
}

/**
 * Everything the resolver consults, assembled once at registration.
 */
export type ResolverContext = {
  /** Absolute path the alias targets are relative to. */
  workspaceRoot: string
  /** Workspace path aliases. */
  aliases: AliasTable
  /** Specifier redirects applied before anything else. */
  mappings: ModuleMapping[]
  /** Directory used when the importer has no file-backed URL. */
  entryDirectory: string
}

/**
 * Compiles the `moduleNameMapper` pairs the runner passes through the environment.
 *
 * @param serialised - A JSON array of `[pattern, replacement]` pairs, or undefined.
 * @param projectRoot - Directory substituted for `<rootDir>` in each replacement.
 * @returns The compiled mappings, in declaration order.
 */
export function compileModuleMappings(serialised: string | undefined, projectRoot: string): ModuleMapping[] {
  if (!serialised) return []

  return (JSON.parse(serialised) as [string, string][]).map(([pattern, replacement]) => ({
    // why: the pattern is authored in the project's own test.config.ts and travels no further than this process; it is repository source, not input.
    // eslint-disable-next-line workspace/no-unsafe-regex
    pattern: new RegExp(pattern),
    replacement: replacement.replace('<rootDir>', projectRoot),
  }))
}

/**
 * Turns a resolved file path into the URL handed back to Node, carrying the module
 * generation when one is in effect.
 *
 * @param filePath - Absolute path to an existing file.
 * @returns The `file:` URL, suffixed with the generation query once past generation zero.
 */
export function toModuleUrl(filePath: string): string {
  const generation = currentGeneration()
  const url = pathToFileURL(filePath).href
  return generation === 0 ? url : `${url}?__hfGeneration=${generation}`
}

/**
 * Finds the directory a relative specifier should resolve against.
 *
 * The generation query is stripped first, so a module re-imported after
 * `jest.resetModules` still resolves its own neighbours correctly.
 *
 * @param parentUrl - The importing module's URL, if any.
 * @param fallback - Directory to use when there is no file-backed parent.
 * @returns The directory to resolve against.
 */
export function parentDirectory(parentUrl: string | undefined, fallback: string): string {
  if (!parentUrl?.startsWith('file:')) return fallback
  const [withoutQuery] = parentUrl.split('?')
  return withoutQuery ? dirname(fileURLToPath(withoutQuery)) : fallback
}

/**
 * Resolves a specifier Node cannot resolve on its own.
 *
 * Redirects are applied first, then relative and absolute paths gain the extension the
 * source omitted, then workspace path aliases are consulted. Anything else is left alone
 * so `node:` builtins and real packages keep their normal behaviour.
 *
 * @param specifier - The specifier as written in the importing module.
 * @param parentUrl - The importing module's URL, if any.
 * @param context - The aliases, redirects, and roots to resolve against.
 * @returns The resolved module URL, or null when Node should resolve it.
 */
export function resolveSpecifier(specifier: string, parentUrl: string | undefined, context: ResolverContext): string | null {
  for (const { pattern, replacement } of context.mappings) {
    if (!pattern.test(specifier)) continue
    const mapped = firstExistingFile(resolve(specifier.replace(pattern, replacement)))
    if (mapped) return toModuleUrl(mapped)
  }

  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const relative = firstExistingFile(resolve(parentDirectory(parentUrl, context.entryDirectory), specifier))
    return relative ? toModuleUrl(relative) : null
  }

  const aliased = resolveAlias(specifier, context.aliases, context.workspaceRoot)
  return aliased ? toModuleUrl(aliased) : null
}
