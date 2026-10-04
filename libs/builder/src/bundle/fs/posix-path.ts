import { join as nodeJoin, sep, posix } from 'node:path'

/**
 * POSIX-normalises a native path so all separators are `/`.
 *
 * Only the platform's own separator is rewritten: on POSIX a backslash is a
 * legal file-name character and is kept.
 *
 * @param value - Native path, with backslash separators on Windows.
 * @returns The path with every native separator replaced by `/`.
 *
 * @example Normalising a native Windows path
 * ```typescript
 * normalizeToForwardSlashes('a\\b\\index.d.ts') // => 'a/b/index.d.ts' on Windows
 * ```
 */
export const normalizeToForwardSlashes = (value: string): string => value.split(sep).join(posix.sep)

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
