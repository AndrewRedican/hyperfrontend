import { realpathSync } from 'node:fs'
import { sep } from 'node:path'
import { relativePath } from '@hyperfrontend/project-scope/core/path'

/** Looks up the path a file system stores a path under, or answers `null` when it cannot tell. */
export type RealPathLookup = (path: string) => string | null

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
  const resolved = `/${relativePath(root, filePath)}`
  const storedRoot = realPath(root)
  const storedFile = storedRoot === null ? null : realPath(filePath)
  if (storedRoot === null || storedFile === null) {
    return resolved
  }
  // why: The root of a drive or of the file system already ends with the separator, and the prefix test below needs exactly one.
  const base = storedRoot.endsWith(sep) ? storedRoot : `${storedRoot}${sep}`
  return storedFile.startsWith(base) ? `/${relativePath(storedRoot, storedFile)}` : resolved
}
