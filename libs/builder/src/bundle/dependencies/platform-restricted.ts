/* lint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/** The manifest fields a package restricts its platforms with. */
interface PlatformManifest {
  /** The operating systems the package installs on, when it names any. */
  readonly os?: unknown
  /** The CPU architectures the package installs on, when it names any. */
  readonly cpu?: unknown
}

/**
 * The package a bare specifier names, scope included.
 *
 * @param specifier - A module specifier as written in an import.
 * @returns The package name, or null for a relative or absolute path, a `node:` builtin or a bundler-internal id.
 */
const packageNameOf = (specifier: string): string | null => {
  if (specifier.startsWith('.') || specifier.startsWith('\0') || specifier.startsWith('node:') || isAbsolute(specifier)) return null
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : (segments[0] as string)
}

/**
 * Whether a dependency's manifest restricts it to particular operating systems or CPU
 * architectures, in which case the pre-pass keeps it external: inlining such a package would
 * make the bundle depend on which host built it, since `npm` installs it on those platforms alone.
 *
 * The manifest is found the way Node resolves the package: in the nearest `node_modules`
 * directory above the importer that holds it.
 *
 * @param specifier - The specifier as the importer wrote it.
 * @param importer - The absolute path of the importing module, or undefined for an entry.
 * @returns `true` when the package's `os` or `cpu` field names any platform.
 *
 * @example Keeping rollup's macOS-only watcher dependency out of a bundle
 * ```typescript
 * isPlatformRestrictedDep('fsevents', '/repo/node_modules/rollup/dist/shared/watch.js') // => true
 * ```
 */
export const isPlatformRestrictedDep = (specifier: string, importer: string | undefined): boolean => {
  const name = importer === undefined ? null : packageNameOf(specifier)
  if (name === null) return false
  let directory = dirname(importer as string)
  let manifestPath = join(directory, 'node_modules', name, 'package.json')
  while (!existsSync(manifestPath)) {
    const parent = dirname(directory)
    if (parent === directory) return false
    directory = parent
    manifestPath = join(directory, 'node_modules', name, 'package.json')
  }
  const { os, cpu } = JSON.parse(readFileSync(manifestPath, 'utf8')) as PlatformManifest
  return (Array.isArray(os) && os.length > 0) || (Array.isArray(cpu) && cpu.length > 0)
}
