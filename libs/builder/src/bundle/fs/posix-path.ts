import { join as nodeJoin } from 'node:path'

/**
 * POSIX-normalises a path so all separators are `/`.
 *
 * @param value - Raw path that may contain backslashes (Windows) or forward slashes.
 * @returns Path with all separators normalized to `/`.
 *
 * @example Normalising a Windows-style path
 * ```typescript
 * normalizeToForwardSlashes('a\\b\\index.d.ts') // => 'a/b/index.d.ts'
 * ```
 */
export const normalizeToForwardSlashes = (value: string): string => value.replace(/\\/g, '/')

/**
 * POSIX-style path joiner: joins segments via `node:path` then normalizes all
 * separators to `/`, so output is stable across Windows and POSIX hosts.
 *
 * Depends on nothing but `node:path` by design: worker-reachable callers bootstrap
 * from source before workspace packages are guaranteed loadable, so this module must
 * not import `@hyperfrontend/*`.
 *
 * @param segments - Path segments to join.
 * @returns Joined path with `/` separators.
 *
 * @example Joining segments into a POSIX path
 * ```typescript
 * join('/abs/dist/libs/foo', 'models', 'index.d.ts') // => '/abs/dist/libs/foo/models/index.d.ts'
 * ```
 */
export const join = (...segments: string[]): string => normalizeToForwardSlashes(nodeJoin(...segments))
