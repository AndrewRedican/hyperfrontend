/**
 * Formats the files a generator created or updated with the prettier the workspace installs and
 * the configuration it keeps, leaving alone what `.prettierignore` covers and what prettier has
 * no parser for, and answers one text as that formatting would leave it.
 *
 * @module generators/shared/format
 */

import type { Tree } from './tree'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** What a file's prettier support says about it. */
interface FileSupport {
  /** Whether `.prettierignore` covers the file. */
  readonly ignored: boolean
  /** The parser inferred from the file's name, or null when prettier has none for it. */
  readonly inferredParser: string | null
}

/** How a file's support is asked for. */
interface FileInfoOptions {
  /** The ignore file consulted. */
  readonly ignorePath: string
}

/** How a file's configuration is asked for. */
interface ResolveConfigOptions {
  /** Whether `.editorconfig` is read too. */
  readonly editorconfig: boolean
}

/** The part of prettier's API that formatting the tree uses. */
export interface Prettier {
  /** Formats a text with options. */
  format(source: string, options: Record<string, unknown>): Promise<string>
  /** Whether a file is ignored and which parser handles it. */
  getFileInfo(file: string, options: FileInfoOptions): Promise<FileSupport>
  /** The configuration that applies to a file, or null when none does. */
  resolveConfig(file: string, options: ResolveConfigOptions): Promise<Record<string, unknown> | null>
}

/**
 * The prettier a workspace installs, resolved from its root the way any module of the workspace
 * resolves it.
 *
 * @param root - The workspace root, absolute
 * @returns Its API
 * @throws {Error} When the workspace has no prettier
 *
 * @example Formatting a text with the workspace's prettier and configuration
 * ```typescript
 * const prettier = prettierOf(tree.root)
 * const options = { ...(await prettier.resolveConfig(`${tree.root}/libs/core/src/index.ts`, { editorconfig: true })), filepath: 'index.ts' }
 * await prettier.format('export const a={b:1}', options) // => "export const a = { b: 1 }\n"
 * ```
 */
export function prettierOf(root: string): Prettier {
  const prettier = installedPrettier(root)
  if (prettier === null) throw createError('prettier is not installed in the workspace; install it to format generated files')
  return prettier
}

/**
 * The prettier a workspace installs, or nothing where it installs none.
 *
 * @param root - The workspace root, absolute
 * @returns Its API, or null for a workspace without prettier
 */
function installedPrettier(root: string): Prettier | null {
  try {
    return createRequire(join(root, 'package.json'))('prettier') as Prettier
  } catch {
    return null
  }
}

/**
 * A text as formatting the tree would leave it at a path: formatted with the workspace's
 * prettier and the configuration that applies there. The text is answered as it is where
 * formatting would leave the file alone: where the workspace installs no prettier,
 * `.prettierignore` covers the path, or prettier has no parser for it.
 *
 * @param tree - The tree the path belongs to, whose root prettier and its configuration are resolved from
 * @param path - Where the text is, or would be, written, relative to the root
 * @param content - What the file holds, or would hold, before it is formatted
 * @param prettier - The prettier to format with; the workspace's own, when it installs one, when omitted
 * @returns The text as a formatting pass would write it there
 * @throws {Error} When prettier cannot parse the text
 *
 * @example Telling a file a generator wrote from one a hand has edited since, whether or not it was formatted
 * ```typescript
 * const written = '# @acme/globs\n\nReads *.ts files.\n'
 * await formatText(tree, 'libs/globs/README.md', written) // => '# @acme/globs\n\nReads \\*.ts files.\n'
 * await formatText(tree, 'libs/globs/notes.unknown', 'a   b') // => 'a   b'
 * ```
 */
export async function formatText(
  tree: Tree,
  path: string,
  content: string,
  prettier: Prettier | null = installedPrettier(tree.root)
): Promise<string> {
  if (prettier === null) return content
  const systemPath = join(tree.root, path)
  const support = await prettier.getFileInfo(systemPath, { ignorePath: join(tree.root, '.prettierignore') })
  if (support.ignored || support.inferredParser === null) return content
  return prettier.format(content, { ...(await prettier.resolveConfig(systemPath, { editorconfig: true })), filepath: systemPath })
}

/**
 * Formats the created and updated files of the tree that a predicate takes, in place: what a
 * generator uses when some of the files it wrote are copies it has no business reformatting.
 *
 * @param tree - The tree whose changes are formatted
 * @param wanted - Whether the file at a path, relative to the root, is formatted
 * @param prettier - The prettier to format with; the workspace's own when omitted
 * @returns Resolves when every file the predicate takes is written back
 * @throws {Error} When prettier cannot parse a file, which a generator wrote wrong
 *
 * @example Formatting what a move rewrote, not what it carried over
 * ```typescript
 * const carried = ['packages/core/src/index.ts']
 * await formatWhere(tree, (path) => !carried.includes(path))
 * // packages/core/package.json, rewritten by the move, is formatted; packages/core/src/index.ts keeps its bytes
 * ```
 */
export async function formatWhere(
  tree: Tree,
  wanted: (path: string) => boolean,
  prettier: Prettier = prettierOf(tree.root)
): Promise<void> {
  for (const change of tree.listChanges()) {
    const content = change.content ?? null
    if (change.type === 'DELETE' || content === null || !wanted(change.path)) continue
    const text = content.toString('utf-8')
    const formatted = await formatText(tree, change.path, text, prettier)
    // why: a file formatting leaves alone keeps the bytes it was written with
    if (formatted !== text) tree.write(change.path, formatted)
  }
}

/**
 * Formats every created or updated file of the tree in place.
 *
 * @param tree - The tree whose changes are formatted
 * @param prettier - The prettier to format with; the workspace's own when omitted
 * @returns Resolves when every file is written back
 * @throws {Error} When prettier cannot parse a file, which a generator wrote wrong
 *
 * @example The last step of a generator
 * ```typescript
 * import type { Generator } from '@hyperfrontend/workspace/generators'
 * import { formatFiles, writeJson } from '@hyperfrontend/workspace/generators'
 *
 * const addConfig: Generator<{ project: string; skipFormat?: boolean }> = async (tree, options) => {
 *   writeJson(tree, `libs/${options.project}/custom.json`, { enabled: true })
 *   if (!options.skipFormat) await formatFiles(tree)
 * }
 * ```
 */
export async function formatFiles(tree: Tree, prettier: Prettier = prettierOf(tree.root)): Promise<void> {
  await formatWhere(tree, () => true, prettier)
}
