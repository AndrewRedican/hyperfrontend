/**
 * VS Code configuration has one home, `.devcontainer/devcontainer.json`, so no `.vscode`
 * directory may exist anywhere in the workspace. The check runs once, from the workspace's own
 * `package.json`.
 *
 * @module rules/workspace/no-vscode-config
 */

import type { JsonTreeNode } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { wholeDocument } from '@hyperfrontend/linter/helpers'
import { sweep } from './shared/sweep.ts'

/** The rule's options. */
interface Options {
  /** The file that owns the configuration, named in the message. */
  readonly configFile?: string
}

/**
 * Every `.vscode` directory under a root, as POSIX paths relative to it.
 *
 * @param root - The workspace root
 * @returns The paths in walk order
 */
function vscodeDirectories(root: string): string[] {
  const found: string[] = []
  sweep(root, (entry) => {
    if (!entry.directory) return false
    if (entry.name !== '.vscode') return true
    found.push(entry.path)
    return false
  })
  return found
}

export default defineRule<Options | undefined, JsonTreeNode>({
  id: 'workspace/no-vscode-config',
  language: 'json',
  fixable: false,
  create(context) {
    const directory = dirname(context.file.path)
    if (basename(context.file.path) !== 'package.json' || !existsSync(join(directory, 'nx.json'))) return {}
    const configFile = context.options?.configFile ?? '.devcontainer/devcontainer.json'
    return {
      document() {
        for (const path of vscodeDirectories(directory)) {
          context.report({
            ...wholeDocument(context.file),
            message: `VS Code configuration belongs in ${configFile} under 'customizations.vscode', so the environment has one source of truth. Found '${path}': merge what it holds into that file and delete it.`,
          })
        }
      },
    }
  },
})
