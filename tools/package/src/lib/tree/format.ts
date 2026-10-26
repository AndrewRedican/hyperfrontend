/**
 * Formats the files a generator created or updated with the workspace's prettier
 * configuration, leaving alone what `.prettierignore` covers and what prettier has no parser
 * for.
 *
 * @module lib/tree/format
 */

import type { Tree } from './tree'
import { join } from 'node:path'
import { format, getFileInfo, resolveConfig } from 'prettier'

/**
 * Formats every created or updated file of the tree in place.
 *
 * @param tree - The tree whose changes are formatted
 * @returns Resolves when every file is written back
 * @throws {Error} When prettier cannot parse a file, which a generator wrote wrong
 */
export async function formatFiles(tree: Tree): Promise<void> {
  const ignorePath = join(tree.root, '.prettierignore')
  for (const change of tree.listChanges()) {
    const content = change.content ?? null
    if (change.type === 'DELETE' || content === null) continue
    const systemPath = join(tree.root, change.path)
    const support = await getFileInfo(systemPath, { ignorePath })
    if (support.ignored || support.inferredParser === null) continue
    const options = { ...(await resolveConfig(systemPath, { editorconfig: true })), filepath: systemPath }
    tree.write(change.path, await format(content.toString('utf-8'), options))
  }
}
