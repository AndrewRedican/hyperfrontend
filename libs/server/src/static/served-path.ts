import type { ServeStepContext } from './serve-pipeline'
import { realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { relativePath } from '@hyperfrontend/project-scope/core/path'

/** Looks up the path a file system stores a path under, or answers `null` when it cannot tell. */
export type RealPathLookup = (path: string) => string | null

/** Where the file system stores a file that is about to be served. */
export interface StoredFile {
  /** The file's path below the root in the stored spelling, starting with `/` and separated by `/` on every platform; the path as resolved from the request when the lookup has no answer or the file is not stored below the root. */
  readonly path: string
  /** The absolute path the file is stored under, every link resolved; the path as resolved from the request when the lookup has no answer. */
  readonly file: string
}

/** What one request was told about the file it resolved. */
interface Recorded {
  /** The absolute path the answer was looked up for. */
  readonly resolved: string
  /** The answer. */
  readonly stored: StoredFile
}

// note: Keyed by the context a request runs under, so the steps of one request share one pair of lookups and nothing is remembered once the request is answered.
const RECORDED = createWeakMap<ServeStepContext, Recorded>()

/**
 * Looks up the path the file system stores a path under: every link resolved
 * and every name in the spelling its directory lists, whatever letter case,
 * short name or Unicode normalisation the path was asked by.
 *
 * @param path - An absolute path, in any spelling the file system resolves.
 * @returns The stored path, or `null` when the path cannot be resolved.
 *
 * @example Reading the stored spelling of a path
 * ```typescript
 * realPathOnDisk('/abs/dist/HOST/index.html') // '/abs/dist/host/index.html' where the volume ignores letter case
 * realPathOnDisk('/abs/dist/missing.html') // null
 * ```
 */
export function realPathOnDisk(path: string): string | null {
  try {
    // why: Only the native lookup answers in the stored letter case and expands a Windows short name; the JavaScript one echoes each name as it was asked.
    return realpathSync.native(path)
  } catch {
    return null
  }
}

/**
 * Looks up where a file is stored: the stored root beside the stored file, so
 * a root that is a link is read from where the link leads.
 *
 * @param root - The absolute directory files are served from.
 * @param filePath - The absolute path of the file, as resolved from the request under `root`.
 * @param realPath - Looks up the stored path of the root and of the file.
 * @returns The stored path below the root and the stored whole path, each as resolved where the lookup cannot tell.
 */
function locate(root: string, filePath: string, realPath: RealPathLookup): StoredFile {
  const resolved = `/${relativePath(root, filePath)}`
  const storedRoot = realPath(root)
  const stored = storedRoot === null ? null : realPath(filePath)
  if (storedRoot === null || stored === null) {
    return { path: resolved, file: filePath }
  }
  // why: The root of a drive or of the file system already ends with the separator, and the prefix test below needs exactly one.
  const base = storedRoot.endsWith(sep) ? storedRoot : `${storedRoot}${sep}`
  return { path: stored.startsWith(base) ? `/${relativePath(storedRoot, stored)}` : resolved, file: stored }
}

/**
 * Reads the root-relative path header rules are matched against for a file
 * about to be served: the path as the file system stores it, so a request
 * that reached the file under another letter case, a short name or another
 * Unicode normalisation is sent the headers of the file it is served.
 *
 * The stored root is looked up beside the stored file, so a root that is a
 * link is read from where the link leads. When either lookup has no answer,
 * or the stored file does not sit below the stored root, the path as it was
 * resolved from the request is returned instead, which is the stored path on
 * a file system that tells every spelling apart.
 *
 * @param root - The absolute directory files are served from.
 * @param filePath - The absolute path of the file, as resolved from the request under `root`.
 * @param realPath - Looks up the stored path of the root and of the file.
 * @returns The path, starting with `/` and separated by `/` on every platform.
 *
 * @example Reading the path a respelled request is judged by
 * ```typescript
 * servedPath('/abs/dist', '/abs/dist/HOST/index.html', realPathOnDisk) // '/host/index.html' where the volume ignores letter case
 * servedPath('/abs/dist', '/abs/dist/host/index.html', () => null) // '/host/index.html'
 * ```
 */
export function servedPath(root: string, filePath: string, realPath: RealPathLookup): string {
  return locate(root, filePath, realPath).path
}

/**
 * Reads where the file one request resolved is stored, looking it up once per
 * request: the file step asks first, to judge what is hidden by the stored
 * names, and the header rules and the compression cache read the same answer.
 *
 * The answer is kept against the request's context and the path it was asked
 * for, so the next request is looked up afresh and a served root that was
 * pointed at another directory in between is read from where it now leads.
 *
 * @param context - The context the request runs under, read for the served root.
 * @param filePath - The absolute path of the file, as resolved from the request under the root.
 * @param realPath - Looks up the stored path of the root and of the file, on the first reading only.
 * @returns The stored path below the root and the stored whole path.
 *
 * @example Reading one answer from two steps of a request
 * ```typescript
 * const context = { config: { root: '/abs/dist', port: 0, log: false, headers: [] } }
 * storedFile(context, '/abs/dist/HOST/index.html', realPathOnDisk)
 * // => { path: '/host/index.html', file: '/abs/dist/host/index.html' } where the volume ignores letter case
 * storedFile(context, '/abs/dist/HOST/index.html', realPathOnDisk) // the same answer, with no second lookup
 * ```
 */
export function storedFile(context: ServeStepContext, filePath: string, realPath: RealPathLookup): StoredFile {
  const recorded = RECORDED.get(context)
  if (recorded !== undefined && recorded.resolved === filePath) {
    return recorded.stored
  }
  const stored = locate(context.config.root, filePath, realPath)
  RECORDED.set(context, { resolved: filePath, stored })
  return stored
}
