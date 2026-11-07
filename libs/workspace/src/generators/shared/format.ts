/**
 * Formats the files a generator created or updated with the prettier the workspace installs and
 * the configuration it keeps, leaving alone what `.prettierignore` covers and what prettier has
 * no parser for.
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
  try {
    return createRequire(join(root, 'package.json'))('prettier') as Prettier
  } catch {
    throw createError('prettier is not installed in the workspace; install it to format generated files')
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
  const ignorePath = join(tree.root, '.prettierignore')
  for (const change of tree.listChanges()) {
    const content = change.content ?? null
    if (change.type === 'DELETE' || content === null) continue
    const systemPath = join(tree.root, change.path)
    const support = await prettier.getFileInfo(systemPath, { ignorePath })
    if (support.ignored || support.inferredParser === null) continue
    const options = { ...(await prettier.resolveConfig(systemPath, { editorconfig: true })), filepath: systemPath }
    tree.write(change.path, await prettier.format(content.toString('utf-8'), options))
  }
}
