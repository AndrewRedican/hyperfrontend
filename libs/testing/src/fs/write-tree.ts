import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

/**
 * What a file in a tree holds: text as written, bytes as given, or any other value as
 * pretty-printed JSON with a trailing newline.
 */
export type FileContent = string | Uint8Array | object

/**
 * Files to write, keyed by path relative to the directory they are written into. A key
 * may name nested directories with `/`, which are created as needed.
 */
export type FileTree = Record<string, FileContent>

/**
 * Renders file content for writing.
 *
 * @param content - Text, bytes, or a value to serialise.
 * @returns What to write to disk.
 */
function render(content: FileContent): string | Uint8Array {
  if (typeof content === 'string' || content instanceof Uint8Array) return content
  return `${JSON.stringify(content, null, 2)}\n`
}

/**
 * Resolves a relative path inside a root, refusing one that lands outside it.
 *
 * @param root - The directory the path must stay inside.
 * @param relativePath - The path to resolve.
 * @returns The absolute path.
 * @throws {Error} When the path is absolute or climbs out of the root.
 * @example Keeping a write inside its directory
 * ```ts
 * within('/tmp/hf-test-1', 'src/index.ts') // => '/tmp/hf-test-1/src/index.ts'
 * within('/tmp/hf-test-1', '../escape.ts') // throws
 * ```
 */
export function within(root: string, relativePath: string): string {
  const target = resolve(root, relativePath)
  const climb = relative(root, target)
  if (isAbsolute(relativePath) || climb.startsWith('..') || isAbsolute(climb))
    throw new Error(`${relativePath} is outside ${root}: write paths must be relative and stay inside the directory`)
  return target
}

/**
 * Writes one file under a root, creating its parent directories.
 *
 * @param root - The directory to write under.
 * @param relativePath - Where the file goes, relative to the root.
 * @param content - What the file holds.
 * @returns The absolute path of the written file.
 * @throws {Error} When the path is absolute or climbs out of the root.
 * @example Writing a manifest as JSON
 * ```ts
 * writeFile(root, 'packages/app/package.json', { name: 'app' })
 * // => '<root>/packages/app/package.json', holding '{\n  "name": "app"\n}\n'
 * ```
 */
export function writeFile(root: string, relativePath: string, content: FileContent): string {
  const target = within(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, render(content))
  return target
}

/**
 * Writes a tree of files under a root, creating every directory the paths name.
 *
 * Fixtures held as data in a spec, rather than checked in as files, never look like a real
 * manifest or lockfile to a dependency scanner, and a spec states exactly the files it
 * depends on. Every path must stay inside the root.
 *
 * @param root - The directory to write under. It is created when missing.
 * @param tree - The files to write.
 * @throws {Error} When a path is absolute or climbs out of the root.
 * @example Laying out a small workspace
 * ```ts
 * writeTree(root, {
 *   'package.json': { name: 'workspace', workspaces: ['packages/*'] },
 *   'packages/app/package.json': { name: 'app' },
 *   'packages/app/src/index.ts': 'export const ready = true\n',
 * })
 * ```
 */
export function writeTree(root: string, tree: FileTree): void {
  mkdirSync(root, { recursive: true })
  for (const [relativePath, content] of Object.entries(tree)) writeFile(root, relativePath, content)
}
